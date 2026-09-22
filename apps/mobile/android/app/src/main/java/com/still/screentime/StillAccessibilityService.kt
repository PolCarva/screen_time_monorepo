package com.still.screentime

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.Intent
import android.os.SystemClock
import android.provider.Settings
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.view.accessibility.AccessibilityWindowInfo
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

class StillAccessibilityService : AccessibilityService() {
  private val preferences by lazy { getSharedPreferences(StillRestrictionModule.PREFERENCES, Context.MODE_PRIVATE) }
  private var lastInterventionPackage: String? = null
  private var lastInterventionAt = 0L
  private var lastPipSweepAt = 0L

  override fun onServiceConnected() {
    super.onServiceConnected()
    StillSelfProtection.sanitizePreferences(preferences, packageName)
    // Keep a rewarded ad ready in this process so the shield can show it the
    // instant the user taps, with no jump to another screen.
    StillRewardedAdManager.preload(applicationContext, "service-connected")
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    val type = event?.eventType ?: return
    if (type != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED &&
      type != AccessibilityEvent.TYPE_WINDOWS_CHANGED
    ) {
      return
    }
    // Close any Picture-in-Picture window a chosen app slipped above the shield.
    closeLockedAppPictureInPicture()

    if (!preferences.getBoolean(StillRestrictionModule.KEY_RESTRICTIONS_ENABLED, false)) return

    // Resolve the foreground app from the window list rather than the event's
    // package: a warm re-open only resumes the activity and may not carry the
    // package on the event, which used to let the app slip through on reopen.
    val target = currentForegroundApp() ?: event.packageName?.toString() ?: return

    if (StillSelfProtection.isOwnPackage(packageName, target)) {
      // The shield itself is in front; nothing to do.
      return
    }
    val selected = preferences.getStringSet(StillRestrictionModule.KEY_SELECTED_PACKAGES, emptySet()) ?: emptySet()
    if (target !in selected) {
      // A non-chosen app is in front: forget the last target so the next open
      // of a chosen app always re-shields.
      if (preferences.getString(StillRestrictionModule.KEY_CURRENT_PACKAGE, null) != null &&
        currentForegroundApp() != null
      ) {
        preferences.edit().remove(StillRestrictionModule.KEY_CURRENT_PACKAGE).apply()
      }
      lastInterventionPackage = null
      return
    }
    if (isTemporarilyUnlocked(target) || isExternalAuthBrowser(target)) return

    val now = SystemClock.elapsedRealtime()
    val alreadyPending =
      lastInterventionPackage == target && now - lastInterventionAt < 1_200
    if (alreadyPending) return
    lastInterventionPackage = target
    lastInterventionAt = now

    val day = LocalDate.now(ZoneOffset.UTC).toString()
    val attemptsKey = "open_attempts:$day"
    val appAttemptsKey = StillRestrictionModule.appMetricKey(
      StillRestrictionModule.METRIC_APP_OPEN_ATTEMPTS,
      day,
      target,
    )
    val nextAttempts = preferences.getInt(appAttemptsKey, 0) + 1
    preferences.edit()
      .putString(StillRestrictionModule.KEY_CURRENT_PACKAGE, target)
      .putInt(attemptsKey, preferences.getInt(attemptsKey, 0) + 1)
      .putInt(appAttemptsKey, nextAttempts)
      .putString(
        StillRestrictionModule.appStateKey(StillRestrictionModule.STATE_LAST_PAUSE_AT, target),
        Instant.now().toString(),
      )
      .apply()

    // Refresh the ad if it expired since the last intervention. If it is not
    // ready in time the shield falls back to pass / emergency / timed pause.
    StillRewardedAdManager.preload(applicationContext, "intervention")

    launchShield(target, nextAttempts)
  }

  private fun launchShield(target: String, attempts: Int) {
    runCatching {
      startActivity(Intent(this, InterventionActivity::class.java).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS)
        putExtra(InterventionActivity.EXTRA_TARGET_PACKAGE, target)
        putExtra(InterventionActivity.EXTRA_TARGET_ATTEMPTS, attempts)
      })
    }
  }

  /**
   * The package of the app currently in front, from the window list. Ignores the
   * shield itself and floating Picture-in-Picture windows, so it reports the real
   * foreground app even when it was only resumed (warm re-open).
   */
  private fun currentForegroundApp(): String? {
    val wins = runCatching { windows }.getOrNull() ?: return null
    val appWindows = wins.filter {
      it.type == AccessibilityWindowInfo.TYPE_APPLICATION &&
        !runCatching { it.isInPictureInPictureMode }.getOrDefault(false)
    }
    val focused = appWindows.firstOrNull { it.isFocused }
    val candidate = focused ?: appWindows.maxByOrNull { it.layer } ?: return null
    val root = runCatching { candidate.root }.getOrNull() ?: return null
    return root.packageName?.toString()
  }

  /**
   * Finds any Picture-in-Picture window that belongs to a chosen, not-unlocked
   * app and closes it, so a floating video cannot sit above the shield. Window
   * content is used only to locate and dismiss the PiP, never read or stored.
   */
  private fun closeLockedAppPictureInPicture() {
    if (!preferences.getBoolean(StillRestrictionModule.KEY_RESTRICTIONS_ENABLED, false)) return
    val now = SystemClock.elapsedRealtime()
    if (now - lastPipSweepAt < 300) return
    lastPipSweepAt = now
    val selected = preferences.getStringSet(StillRestrictionModule.KEY_SELECTED_PACKAGES, emptySet()) ?: return
    if (selected.isEmpty()) return

    val currentWindows = runCatching { windows }.getOrNull() ?: return
    for (window in currentWindows) {
      if (!runCatching { window.isInPictureInPictureMode }.getOrDefault(false)) continue
      val root = runCatching { window.root }.getOrNull() ?: continue
      val pkg = root.packageName?.toString()
      if (pkg == null ||
        pkg !in selected ||
        StillSelfProtection.isOwnPackage(packageName, pkg) ||
        isTemporarilyUnlocked(pkg)
      ) {
        continue
      }
      val dismissed = runCatching {
        root.performAction(AccessibilityNodeInfo.ACTION_DISMISS)
      }.getOrDefault(false)
      if (!dismissed) clickCloseControl(root)
    }
  }

  /** Depth-first search for a clickable "close" control inside a PiP window. */
  private fun clickCloseControl(root: AccessibilityNodeInfo): Boolean {
    val stack = ArrayDeque<AccessibilityNodeInfo>()
    stack.addLast(root)
    var visited = 0
    while (stack.isNotEmpty() && visited < 200) {
      val node = stack.removeLast()
      visited += 1
      val label = ((node.contentDescription ?: node.text)?.toString() ?: "").lowercase()
      if (node.isClickable && CLOSE_LABELS.any { label.contains(it) }) {
        if (runCatching { node.performAction(AccessibilityNodeInfo.ACTION_CLICK) }.getOrDefault(false)) {
          return true
        }
      }
      for (index in 0 until node.childCount) {
        node.getChild(index)?.let(stack::addLast)
      }
    }
    return false
  }

  private fun isTemporarilyUnlocked(packageName: String): Boolean {
    val expectedBoot = preferences.getInt("unlocked_boot:$packageName", -1)
    val boot = Settings.Global.getInt(contentResolver, Settings.Global.BOOT_COUNT, 0)
    val deadline = preferences.getLong("unlocked:$packageName", 0)
    if (expectedBoot == boot && SystemClock.elapsedRealtime() < deadline) return true
    preferences.edit().remove("unlocked:$packageName").remove("unlocked_boot:$packageName").apply()
    return false
  }

  private fun isExternalAuthBrowser(packageName: String): Boolean {
    val expectedBoot = preferences.getInt(StillRestrictionModule.KEY_EXTERNAL_AUTH_BYPASS_BOOT, -1)
    val boot = Settings.Global.getInt(contentResolver, Settings.Global.BOOT_COUNT, 0)
    val deadline = preferences.getLong(StillRestrictionModule.KEY_EXTERNAL_AUTH_BYPASS_UNTIL, 0)
    val active = expectedBoot == boot && SystemClock.elapsedRealtime() < deadline
    if (!active) {
      preferences.edit()
        .remove(StillRestrictionModule.KEY_EXTERNAL_AUTH_BYPASS_PACKAGES)
        .remove(StillRestrictionModule.KEY_EXTERNAL_AUTH_BYPASS_UNTIL)
        .remove(StillRestrictionModule.KEY_EXTERNAL_AUTH_BYPASS_BOOT)
        .apply()
      return false
    }
    val browsers = preferences.getStringSet(
      StillRestrictionModule.KEY_EXTERNAL_AUTH_BYPASS_PACKAGES,
      emptySet(),
    ) ?: emptySet()
    return packageName in browsers
  }

  override fun onInterrupt() = Unit

  companion object {
    private val CLOSE_LABELS = listOf("close", "cerrar", "descartar", "dismiss")
  }
}

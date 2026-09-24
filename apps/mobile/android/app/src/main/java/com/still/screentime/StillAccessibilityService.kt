package com.still.screentime

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.view.accessibility.AccessibilityWindowInfo
import java.time.Instant

class StillAccessibilityService : AccessibilityService() {
  private val preferences by lazy { getSharedPreferences(StillRestrictionModule.PREFERENCES, Context.MODE_PRIVATE) }
  private var lastInterventionPackage: String? = null
  private var lastInterventionAt = 0L
  private var lastPipSweepAt = 0L
  private val expiryHandler = Handler(Looper.getMainLooper())
  /** One pending timer per app with a live access window, keyed by package. */
  private val armedWindows = mutableMapOf<String, Runnable>()

  override fun onServiceConnected() {
    super.onServiceConnected()
    active = this
    StillSelfProtection.sanitizePreferences(preferences, packageName)
    // Keep a rewarded ad ready in this process so the shield can show it the
    // instant the user taps, with no jump to another screen.
    StillRewardedAdManager.preload(applicationContext, "service-connected")
    // Windows granted before this service (re)started are honoured from here:
    // anything already past its deadline is closed on the spot.
    armAccessWindows()
  }

  override fun onUnbind(intent: Intent?): Boolean {
    if (active === this) active = null
    expiryHandler.removeCallbacksAndMessages(null)
    armedWindows.clear()
    return super.onUnbind(intent)
  }

  override fun onDestroy() {
    if (active === this) active = null
    expiryHandler.removeCallbacksAndMessages(null)
    armedWindows.clear()
    super.onDestroy()
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
    if (isTemporarilyUnlocked(target)) {
      // Self-heals a window whose timer was lost with the previous process.
      if (!armedWindows.containsKey(target)) armAccessWindows()
      return
    }
    if (isExternalAuthBrowser(target)) return

    val now = SystemClock.elapsedRealtime()
    val alreadyPending =
      lastInterventionPackage == target && now - lastInterventionAt < 1_200
    if (alreadyPending) return
    lastInterventionPackage = target
    lastInterventionAt = now

    val day = StillDay.today()
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
    // ready in time the shield waits for it, then falls back to the timed pause.
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

  /**
   * Schedules the exact end of every live access window, so the pause comes
   * back on time whether or not the user ever leaves the app. Deadlines are
   * stored on `elapsedRealtime`, which no clock change can move, and the boot
   * count they were taken with is checked before they are trusted.
   */
  private fun armAccessWindows() {
    val boot = currentBootCount()
    val now = SystemClock.elapsedRealtime()
    val windows = preferences.all
      .filterKeys { it.startsWith(StillRestrictionModule.UNLOCKED_PREFIX) }
      .mapNotNull { (key, value) ->
        val target = key.removePrefix(StillRestrictionModule.UNLOCKED_PREFIX)
        val deadline = value as? Long
        if (target.isEmpty() || deadline == null) null else target to deadline
      }
      .toMap()

    for (target in armedWindows.keys.toList()) {
      if (target !in windows) armedWindows.remove(target)?.let(expiryHandler::removeCallbacks)
    }

    for ((target, deadline) in windows) {
      armedWindows.remove(target)?.let(expiryHandler::removeCallbacks)
      val sameBoot = preferences.getInt(
        "${StillRestrictionModule.UNLOCKED_BOOT_PREFIX}$target",
        -1,
      ) == boot
      if (!sameBoot || deadline <= now) {
        expireAccessWindow(target)
        continue
      }
      val task = Runnable { expireAccessWindow(target) }
      armedWindows[target] = task
      expiryHandler.postDelayed(task, deadline - now)
    }
  }

  /**
   * The window is over. The grant is cleared first so nothing can slip through,
   * and if the app is still in front the shield is brought back immediately —
   * the pause does not wait for the user to close and reopen the app.
   */
  private fun expireAccessWindow(target: String) {
    armedWindows.remove(target)?.let(expiryHandler::removeCallbacks)
    preferences.edit()
      .remove("${StillRestrictionModule.UNLOCKED_PREFIX}$target")
      .remove("${StillRestrictionModule.UNLOCKED_BOOT_PREFIX}$target")
      .apply()
    if (!preferences.getBoolean(StillRestrictionModule.KEY_RESTRICTIONS_ENABLED, false)) return
    val selected = preferences.getStringSet(
      StillRestrictionModule.KEY_SELECTED_PACKAGES,
      emptySet(),
    ) ?: emptySet()
    if (target !in selected || StillSelfProtection.isOwnPackage(packageName, target)) return
    reshieldIfInFront(target)
  }

  /**
   * Puts the shield back over [target] while it is still the app in front.
   *
   * Starting an activity from a service is refused by some OEMs, so one check
   * follows. It waits long enough for the window transition to finish —
   * checking too early reads the target as still focused and would send the
   * shield it just opened to the background. If the target really is still
   * there, `GLOBAL_ACTION_HOME` (an accessibility action, never refused) takes
   * it off screen and the shield is opened again from the Home Screen.
   */
  private fun reshieldIfInFront(target: String) {
    if (currentForegroundApp() != target) return
    if (isTemporarilyUnlocked(target)) return

    // The window ending is not a new open attempt, so today's counter is read
    // rather than raised; the pause timestamp is what actually changed.
    val day = StillDay.today()
    val attempts = preferences.getInt(
      StillRestrictionModule.appMetricKey(
        StillRestrictionModule.METRIC_APP_OPEN_ATTEMPTS,
        day,
        target,
      ),
      1,
    ).coerceAtLeast(1)
    preferences.edit()
      .putString(StillRestrictionModule.KEY_CURRENT_PACKAGE, target)
      .putString(
        StillRestrictionModule.appStateKey(StillRestrictionModule.STATE_LAST_PAUSE_AT, target),
        Instant.now().toString(),
      )
      .apply()
    // Keep the window-change path from launching a second shield right after.
    lastInterventionPackage = target
    lastInterventionAt = SystemClock.elapsedRealtime()
    StillRewardedAdManager.preload(applicationContext, "window-ended")
    launchShield(target, attempts)

    expiryHandler.postDelayed({
      // Anything other than the target in front means the shield came up.
      if (currentForegroundApp() != target || isTemporarilyUnlocked(target)) return@postDelayed
      runCatching { performGlobalAction(GLOBAL_ACTION_HOME) }
      expiryHandler.postDelayed({ launchShield(target, attempts) }, SHIELD_AFTER_HOME_MS)
    }, RESHIELD_VERIFY_MS)
  }

  private fun currentBootCount() =
    Settings.Global.getInt(contentResolver, Settings.Global.BOOT_COUNT, 0)

  private fun isTemporarilyUnlocked(packageName: String): Boolean {
    val expectedBoot = preferences.getInt(
      "${StillRestrictionModule.UNLOCKED_BOOT_PREFIX}$packageName",
      -1,
    )
    val deadline = preferences.getLong(
      "${StillRestrictionModule.UNLOCKED_PREFIX}$packageName",
      0,
    )
    if (expectedBoot == currentBootCount() && SystemClock.elapsedRealtime() < deadline) return true
    preferences.edit()
      .remove("${StillRestrictionModule.UNLOCKED_PREFIX}$packageName")
      .remove("${StillRestrictionModule.UNLOCKED_BOOT_PREFIX}$packageName")
      .apply()
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
    /**
     * How long to wait before checking that the shield actually came up. Long
     * enough for the window transition to settle: the grant is already gone,
     * so these are seconds of a window that has ended, not of one still valid.
     */
    private const val RESHIELD_VERIFY_MS = 1_500L
    /** Time for the Home Screen to settle before the shield is opened over it. */
    private const val SHIELD_AFTER_HOME_MS = 350L

    /**
     * The connected service, or null while it is not running. Only the running
     * service can watch a deadline; a grant written while it is down is picked
     * up by `onServiceConnected`, which closes anything already expired.
     */
    @Volatile
    private var active: StillAccessibilityService? = null

    /** Called whenever an access window is granted, from any path. */
    fun watchAccessWindows() {
      val service = active ?: return
      service.expiryHandler.post { service.armAccessWindows() }
    }
  }
}

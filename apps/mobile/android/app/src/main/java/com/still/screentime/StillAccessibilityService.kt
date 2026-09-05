package com.still.screentime

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.Intent
import android.os.SystemClock
import android.provider.Settings
import android.view.accessibility.AccessibilityEvent
import java.time.LocalDate
import java.time.ZoneOffset

class StillAccessibilityService : AccessibilityService() {
  private val preferences by lazy { getSharedPreferences(StillRestrictionModule.PREFERENCES, Context.MODE_PRIVATE) }
  private var lastInterventionPackage: String? = null
  private var lastInterventionAt = 0L

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (!preferences.getBoolean(StillRestrictionModule.KEY_RESTRICTIONS_ENABLED, false)) return
    if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
    val target = event.packageName?.toString() ?: return
    val selected = preferences.getStringSet(StillRestrictionModule.KEY_SELECTED_PACKAGES, emptySet()) ?: emptySet()
    if (target !in selected || isTemporarilyUnlocked(target) || isExternalAuthBrowser(target)) return

    val now = SystemClock.elapsedRealtime()
    if (lastInterventionPackage == target && now - lastInterventionAt < 1_200) return
    lastInterventionPackage = target
    lastInterventionAt = now
    val day = LocalDate.now(ZoneOffset.UTC).toString()
    val attemptsKey = "open_attempts:$day"
    preferences.edit()
      .putString(StillRestrictionModule.KEY_CURRENT_PACKAGE, target)
      .putInt(attemptsKey, preferences.getInt(attemptsKey, 0) + 1)
      .apply()

    startActivity(Intent(this, InterventionActivity::class.java).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS)
      putExtra(InterventionActivity.EXTRA_TARGET_PACKAGE, target)
    })
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
}

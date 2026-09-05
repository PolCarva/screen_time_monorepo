package com.still.screentime

import android.app.Activity
import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.os.Process
import android.os.SystemClock
import android.provider.Settings
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import java.util.UUID
import java.time.LocalDate
import java.time.ZoneOffset
import java.util.Calendar

class StillRestrictionModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context), ActivityEventListener, LifecycleEventListener {

  private val preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
  private var authorizationPromise: Promise? = null
  private var wellbeingAuthorizationPromise: Promise? = null
  private var pickerPromise: Promise? = null

  init {
    context.addActivityEventListener(this)
    context.addLifecycleEventListener(this)
  }

  override fun getName() = "StillRestrictionEngine"

  @ReactMethod
  fun requestAuthorization(promise: Promise) {
    if (isAccessibilityEnabled()) {
      promise.resolve("authorized")
      return
    }
    authorizationPromise?.reject("authorization_replaced", "A newer authorization request replaced this one")
    authorizationPromise = promise
    val opened = runCatching {
      context.currentActivity?.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        ?: context.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }.isSuccess
    if (!opened) {
      authorizationPromise = null
      promise.resolve("unavailable")
    }
  }

  @ReactMethod
  fun requestWellbeingAuthorization(promise: Promise) {
    if (hasUsageAccess()) {
      promise.resolve("authorized")
      return
    }
    wellbeingAuthorizationPromise?.reject("authorization_replaced", "A newer authorization request replaced this one")
    wellbeingAuthorizationPromise = promise
    val opened = runCatching {
      context.currentActivity?.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
        ?: context.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }.isSuccess
    if (!opened) {
      wellbeingAuthorizationPromise = null
      promise.resolve("unavailable")
    }
  }

  @ReactMethod
  fun presentAppPicker(promise: Promise) {
    val activity = context.currentActivity
    if (activity == null) {
      promise.reject("no_activity", "Still must be open to choose apps")
      return
    }
    pickerPromise?.reject("picker_replaced", "A newer picker request replaced this one")
    pickerPromise = promise
    activity.startActivityForResult(Intent(activity, AppPickerActivity::class.java), PICKER_REQUEST)
  }

  @ReactMethod
  fun beginExternalAuthSession(promise: Promise) {
    val browserPackages = browserPackages()
    if (browserPackages.isEmpty()) {
      promise.reject("browser_unavailable", "No browser is available for authentication")
      return
    }
    preferences.edit()
      .putStringSet(KEY_EXTERNAL_AUTH_BYPASS_PACKAGES, browserPackages)
      .putLong(KEY_EXTERNAL_AUTH_BYPASS_UNTIL, SystemClock.elapsedRealtime() + EXTERNAL_AUTH_BYPASS_TIMEOUT_MS)
      .putInt(KEY_EXTERNAL_AUTH_BYPASS_BOOT, currentBootCount())
      .apply()
    promise.resolve(null)
  }

  @ReactMethod
  fun endExternalAuthSession(promise: Promise) {
    clearExternalAuthBypass()
    promise.resolve(null)
  }

  @ReactMethod
  fun applyRestrictions(selection: ReadableMap, promise: Promise) {
    // AppPickerActivity persists only opaque local package selections.
    promise.resolve(null)
  }

  @ReactMethod
  fun startUnlock(target: ReadableMap, durationSeconds: Int, promise: Promise) {
    if (!preferences.getBoolean(KEY_RESTRICTIONS_ENABLED, false)) {
      promise.reject("restrictions_disabled", "Restrictions are temporarily disabled")
      return
    }
    val requested = target.getString("opaqueId")
    val packageName = if (requested == "current") preferences.getString(KEY_CURRENT_PACKAGE, null) else requested
    if (packageName.isNullOrBlank()) {
      promise.reject("missing_target", "No restricted app is waiting")
      return
    }

    val duration = durationSeconds.coerceIn(60, 86400)
    val now = SystemClock.elapsedRealtime()
    val endsElapsed = now + duration * 1_000L
    val sessionId = UUID.randomUUID().toString()
    preferences.edit()
      .putLong("unlocked:$packageName", endsElapsed)
      .putInt("unlocked_boot:$packageName", currentBootCount())
      .putString("session:$sessionId", packageName)
      .apply()

    val day = LocalDate.now(ZoneOffset.UTC).toString()
    val unlocksKey = "unlocks:$day"
    preferences.edit().putInt(unlocksKey, preferences.getInt(unlocksKey, 0) + 1).apply()

    Handler(Looper.getMainLooper()).postDelayed({ restoreSession(sessionId) }, duration * 1_000L)
    context.packageManager.getLaunchIntentForPackage(packageName)?.let {
      it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
      context.startActivity(it)
    }

    val result = Arguments.createMap().apply {
      putString("id", sessionId)
      putString("endsAt", java.time.Instant.now().plusSeconds(duration.toLong()).toString())
    }
    promise.resolve(result)
  }

  @ReactMethod
  fun restoreRestriction(sessionId: String, promise: Promise) {
    restoreSession(sessionId)
    promise.resolve(null)
  }

  @ReactMethod
  fun getHealth(promise: Promise) {
    val selected = preferences.getStringSet(KEY_SELECTED_PACKAGES, emptySet())?.size ?: 0
    val accessibilityEnabled = isAccessibilityEnabled()
    val usageAccessEnabled = hasUsageAccess()
    val restrictionsEnabled = preferences.getBoolean(KEY_RESTRICTIONS_ENABLED, false)
    promise.resolve(Arguments.createMap().apply {
      putString("authorization", if (accessibilityEnabled) "authorized" else "denied")
      putBoolean("engineActive", restrictionsEnabled && accessibilityEnabled && selected > 0)
      putInt("selectedCount", selected)
      preferences.getString(KEY_LAST_RESTORED, null)?.let { putString("lastRestoredAt", it) }
      if (!restrictionsEnabled) putString("issue", "restrictions_disabled")
      else if (!accessibilityEnabled) putString("issue", "accessibility_disabled")
      else if (!usageAccessEnabled) putString("issue", "usage_access_disabled")
    })
  }

  @ReactMethod
  fun syncWallet(
    rewarded: Int,
    emergency: Int,
    resetAt: String,
    estimatedMinutesPerAvoidedOpen: Double,
    unlockDurationSeconds: Int,
    restrictionsEnabled: Boolean,
    promise: Promise,
  ) {
    preferences.edit()
      .putInt(KEY_REWARDED_BALANCE, rewarded.coerceAtLeast(0))
      .putInt(KEY_EMERGENCY_REMAINING, emergency.coerceAtLeast(0))
      .putString(KEY_WALLET_RESET_AT, resetAt)
      .putFloat(KEY_ESTIMATED_MINUTES_PER_AVOIDED_OPEN, estimatedMinutesPerAvoidedOpen.coerceIn(0.0, 60.0).toFloat())
      .putInt(KEY_UNLOCK_DURATION_SECONDS, unlockDurationSeconds.coerceIn(60, 86400))
      .putBoolean(KEY_RESTRICTIONS_ENABLED, restrictionsEnabled)
      .apply()
    promise.resolve(null)
  }

  @ReactMethod
  fun getPendingUnlockEvents(promise: Promise) = promise.resolve(Arguments.createArray())

  @ReactMethod
  fun acknowledgeUnlockEvent(clientSessionId: String, promise: Promise) = promise.resolve(null)

  @ReactMethod
  fun hasPendingIntervention(promise: Promise) = promise.resolve(false)

  @ReactMethod
  fun getLocalWellbeing(promise: Promise) {
    val day = LocalDate.now(ZoneOffset.UTC).toString()
    val selected = preferences.getStringSet(KEY_SELECTED_PACKAGES, emptySet()) ?: emptySet()
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val usageAllowed = hasUsageAccess()
    var foregroundMillis = 0L
    var pickups = 0
    val weeklyMillis = LongArray(7)
    if (usageAllowed) {
      val calendar = Calendar.getInstance().apply {
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
      }
      val manager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val events = manager.queryEvents(calendar.timeInMillis, System.currentTimeMillis())
      val event = UsageEvents.Event()
      while (events.hasNextEvent()) {
        events.getNextEvent(event)
        if (event.eventType == UsageEvents.Event.SCREEN_INTERACTIVE) pickups += 1
      }
      val aggregate = manager.queryAndAggregateUsageStats(calendar.timeInMillis, System.currentTimeMillis())
      foregroundMillis = selected.sumOf { aggregate[it]?.totalTimeInForeground ?: 0L }
      for (index in 0 until 7) {
        val start = (calendar.clone() as Calendar).apply { add(Calendar.DAY_OF_YEAR, index - 6) }
        val end = (start.clone() as Calendar).apply { add(Calendar.DAY_OF_YEAR, 1) }
        val dayStats = manager.queryAndAggregateUsageStats(start.timeInMillis, minOf(end.timeInMillis, System.currentTimeMillis()))
        weeklyMillis[index] = selected.sumOf { dayStats[it]?.totalTimeInForeground ?: 0L }
      }
    }
    promise.resolve(Arguments.createMap().apply {
      putDouble("controlledScreenTimeSeconds", foregroundMillis / 1_000.0)
      putInt("pickups", pickups)
      putInt("openAttempts", preferences.getInt("open_attempts:$day", 0))
      putInt("avoidedOpens", preferences.getInt("avoided_opens:$day", 0))
      putInt("unlocks", preferences.getInt("unlocks:$day", 0))
      putArray("weeklyScreenTimeSeconds", Arguments.createArray().apply {
        weeklyMillis.forEach { pushDouble(it / 1_000.0) }
      })
    })
  }

  @ReactMethod
  fun resetLocalData(promise: Promise) {
    preferences.edit().clear().apply()
    promise.resolve(null)
  }

  @ReactMethod fun addListener(eventName: String) = Unit
  @ReactMethod fun removeListeners(count: Int) = Unit

  private fun restoreSession(sessionId: String) {
    val packageName = preferences.getString("session:$sessionId", null) ?: return
    preferences.edit()
      .remove("session:$sessionId")
      .remove("unlocked:$packageName")
      .remove("unlocked_boot:$packageName")
      .putString(KEY_LAST_RESTORED, java.time.Instant.now().toString())
      .apply()
  }

  private fun isAccessibilityEnabled(): Boolean {
    val component = ComponentName(context, StillAccessibilityService::class.java)
    val enabled = Settings.Secure.getString(context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)
    return enabled
      ?.split(':')
      ?.mapNotNull { ComponentName.unflattenFromString(it) }
      ?.any { it == component } == true
  }

  private fun hasUsageAccess(): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    return appOps.unsafeCheckOpNoThrow(
      AppOpsManager.OPSTR_GET_USAGE_STATS,
      Process.myUid(),
      context.packageName,
    ) == AppOpsManager.MODE_ALLOWED
  }

  private fun browserPackages(): Set<String> {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://accounts.google.com"))
      .addCategory(Intent.CATEGORY_BROWSABLE)
    val packages = context.packageManager
      .queryIntentActivities(intent, PackageManager.MATCH_ALL)
      .mapNotNull { it.activityInfo?.packageName }
      .filterNot { it == context.packageName }
      .toMutableSet()
    context.packageManager
      .resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)
      ?.activityInfo
      ?.packageName
      ?.takeIf { it != context.packageName }
      ?.let(packages::add)
    return packages
  }

  private fun clearExternalAuthBypass() {
    preferences.edit()
      .remove(KEY_EXTERNAL_AUTH_BYPASS_PACKAGES)
      .remove(KEY_EXTERNAL_AUTH_BYPASS_UNTIL)
      .remove(KEY_EXTERNAL_AUTH_BYPASS_BOOT)
      .apply()
  }

  private fun currentBootCount(): Int = Settings.Global.getInt(context.contentResolver, Settings.Global.BOOT_COUNT, 0)

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != PICKER_REQUEST) return
    val count = data?.getIntExtra(AppPickerActivity.RESULT_COUNT, 0) ?: 0
    pickerPromise?.resolve(Arguments.createMap().apply {
      putInt("count", count)
      putString("localReference", "android-shared-preferences")
    })
    pickerPromise = null
  }

  override fun onNewIntent(intent: Intent) = Unit

  override fun onHostResume() {
    authorizationPromise?.let {
      authorizationPromise = null
      it.resolve(if (isAccessibilityEnabled()) "authorized" else "denied")
    }
    wellbeingAuthorizationPromise?.let {
      wellbeingAuthorizationPromise = null
      it.resolve(if (hasUsageAccess()) "authorized" else "denied")
    }
  }

  override fun onHostPause() = Unit

  override fun onHostDestroy() {
    authorizationPromise = null
    wellbeingAuthorizationPromise = null
    pickerPromise = null
  }

  companion object {
    const val PREFERENCES = "still_restrictions"
    const val KEY_SELECTED_PACKAGES = "selected_packages"
    const val KEY_CURRENT_PACKAGE = "current_package"
    const val KEY_LAST_RESTORED = "last_restored_at"
    const val KEY_REWARDED_BALANCE = "rewarded_balance"
    const val KEY_EMERGENCY_REMAINING = "emergency_remaining"
    const val KEY_WALLET_RESET_AT = "wallet_reset_at"
    const val KEY_ESTIMATED_MINUTES_PER_AVOIDED_OPEN = "estimated_minutes_per_avoided_open"
    const val KEY_UNLOCK_DURATION_SECONDS = "unlock_duration_seconds"
    const val KEY_RESTRICTIONS_ENABLED = "restrictions_enabled"
    const val KEY_EXTERNAL_AUTH_BYPASS_PACKAGES = "external_auth_bypass_packages"
    const val KEY_EXTERNAL_AUTH_BYPASS_UNTIL = "external_auth_bypass_until"
    const val KEY_EXTERNAL_AUTH_BYPASS_BOOT = "external_auth_bypass_boot"
    private const val EXTERNAL_AUTH_BYPASS_TIMEOUT_MS = 10 * 60 * 1_000L
    private const val PICKER_REQUEST = 4270
  }
}

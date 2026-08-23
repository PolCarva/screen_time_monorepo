package com.still.screentime

import android.app.Activity
import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.os.Process
import android.os.SystemClock
import android.provider.Settings
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
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
  ReactContextBaseJavaModule(context), ActivityEventListener {

  private val preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
  private var pickerPromise: Promise? = null

  init { context.addActivityEventListener(this) }

  override fun getName() = "StillRestrictionEngine"

  @ReactMethod
  fun requestAuthorization(promise: Promise) {
    if (isAccessibilityEnabled()) {
      promise.resolve("authorized")
      return
    }
    runCatching {
      context.currentActivity?.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        ?: context.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }.onFailure { promise.resolve("unavailable"); return }
    promise.resolve("notDetermined")
  }

  @ReactMethod
  fun requestWellbeingAuthorization(promise: Promise) {
    if (hasUsageAccess()) {
      promise.resolve("authorized")
      return
    }
    runCatching {
      context.currentActivity?.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
        ?: context.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }.onFailure { promise.resolve("unavailable"); return }
    promise.resolve("notDetermined")
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
  fun applyRestrictions(selection: ReadableMap, promise: Promise) {
    // AppPickerActivity persists only opaque local package selections.
    promise.resolve(null)
  }

  @ReactMethod
  fun startUnlock(target: ReadableMap, durationSeconds: Int, promise: Promise) {
    val requested = target.getString("opaqueId")
    val packageName = if (requested == "current") preferences.getString(KEY_CURRENT_PACKAGE, null) else requested
    if (packageName.isNullOrBlank()) {
      promise.reject("missing_target", "No restricted app is waiting")
      return
    }

    val now = SystemClock.elapsedRealtime()
    val endsElapsed = now + durationSeconds.coerceIn(60, 3600) * 1_000L
    val sessionId = UUID.randomUUID().toString()
    preferences.edit()
      .putLong("unlocked:$packageName", endsElapsed)
      .putInt("unlocked_boot:$packageName", currentBootCount())
      .putString("session:$sessionId", packageName)
      .apply()

    val day = LocalDate.now(ZoneOffset.UTC).toString()
    val unlocksKey = "unlocks:$day"
    preferences.edit().putInt(unlocksKey, preferences.getInt(unlocksKey, 0) + 1).apply()

    Handler(Looper.getMainLooper()).postDelayed({ restoreSession(sessionId) }, durationSeconds * 1_000L)
    context.packageManager.getLaunchIntentForPackage(packageName)?.let {
      it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
      context.startActivity(it)
    }

    val result = Arguments.createMap().apply {
      putString("id", sessionId)
      putString("endsAt", java.time.Instant.now().plusSeconds(durationSeconds.toLong()).toString())
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
    promise.resolve(Arguments.createMap().apply {
      putString("authorization", if (isAccessibilityEnabled()) "authorized" else "denied")
      putBoolean("engineActive", isAccessibilityEnabled() && selected > 0)
      putInt("selectedCount", selected)
      preferences.getString(KEY_LAST_RESTORED, null)?.let { putString("lastRestoredAt", it) }
      if (!isAccessibilityEnabled()) putString("issue", "accessibility_disabled")
    })
  }

  @ReactMethod
  fun syncWallet(rewarded: Int, emergency: Int, resetAt: String, promise: Promise) {
    preferences.edit()
      .putInt(KEY_REWARDED_BALANCE, rewarded.coerceAtLeast(0))
      .putInt(KEY_EMERGENCY_REMAINING, emergency.coerceAtLeast(0))
      .putString(KEY_WALLET_RESET_AT, resetAt)
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
    val weeklyMillis = LongArray(7)
    if (usageAllowed) {
      val calendar = Calendar.getInstance().apply {
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
      }
      val manager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
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
      putInt("openAttempts", preferences.getInt("open_attempts:$day", 0))
      putInt("avoidedOpens", preferences.getInt("avoided_opens:$day", 0))
      putInt("unlocks", preferences.getInt("unlocks:$day", 0))
      putArray("weeklyScreenTimeSeconds", Arguments.createArray().apply {
        weeklyMillis.forEach { pushDouble(it / 1_000.0) }
      })
    })
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
    val component = "${context.packageName}/${StillAccessibilityService::class.java.name}"
    val enabled = Settings.Secure.getString(context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)
    return enabled?.split(':')?.any { it.equals(component, ignoreCase = true) } == true
  }

  private fun hasUsageAccess(): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    return appOps.unsafeCheckOpNoThrow(
      AppOpsManager.OPSTR_GET_USAGE_STATS,
      Process.myUid(),
      context.packageName,
    ) == AppOpsManager.MODE_ALLOWED
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

  companion object {
    const val PREFERENCES = "still_restrictions"
    const val KEY_SELECTED_PACKAGES = "selected_packages"
    const val KEY_CURRENT_PACKAGE = "current_package"
    const val KEY_LAST_RESTORED = "last_restored_at"
    const val KEY_REWARDED_BALANCE = "rewarded_balance"
    const val KEY_EMERGENCY_REMAINING = "emergency_remaining"
    const val KEY_WALLET_RESET_AT = "wallet_reset_at"
    private const val PICKER_REQUEST = 4270
  }
}

package com.still.screentime

import android.app.Activity
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import java.time.LocalDate
import java.util.UUID

class StillRestrictionModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context), ActivityEventListener, LifecycleEventListener {

  private val preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
  private var authorizationPromise: Promise? = null
  private var pickerPromise: Promise? = null

  init {
    StillSelfProtection.sanitizePreferences(preferences, context.packageName)
    context.addActivityEventListener(this)
    context.addLifecycleEventListener(this)
  }

  override fun getName() = "StillRestrictionEngine"

  @ReactMethod
  fun requestAuthorization(promise: Promise) {
    StillSelfProtection.sanitizePreferences(preferences, context.packageName)
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

  /**
   * How Still was installed and on what device, so onboarding and the repair
   * screen can explain OEM quirks and the Android 13+ "restricted settings" gate
   * that blocks enabling Accessibility for a downloaded (non-store) build. There
   * is no API to read the restricted-settings state directly; the install source
   * is the documented heuristic.
   */
  @ReactMethod
  fun getInstallEnvironment(promise: Promise) {
    val sdkInt = android.os.Build.VERSION.SDK_INT
    var packageSource = -1
    if (sdkInt >= 33) {
      packageSource = runCatching {
        context.packageManager.getInstallSourceInfo(context.packageName).packageSource
      }.getOrDefault(-1)
    }
    // PACKAGE_SOURCE_LOCAL_FILE (3) / DOWNLOADED_FILE (4) are the sources Android
    // marks as restricted; store and other installs are not.
    val likelyRestricted = sdkInt >= 33 && (packageSource == 3 || packageSource == 4)
    promise.resolve(Arguments.createMap().apply {
      putInt("sdkInt", sdkInt)
      putInt("packageSource", packageSource)
      putBoolean("likelyRestricted", likelyRestricted)
      putString("manufacturer", android.os.Build.MANUFACTURER ?: "")
    })
  }

  /** Opens Still's own App info screen, where the user allows restricted settings. */
  @ReactMethod
  fun openAppInfo(promise: Promise) {
    val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
      .setData(Uri.fromParts("package", context.packageName, null))
    val opened = runCatching {
      context.currentActivity?.startActivity(intent)
        ?: context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }.isSuccess
    promise.resolve(opened)
  }

  /**
   * Opens Accessibility without waiting for a result, as close to Still's
   * switch as the phone allows (onboarding, repair screen).
   */
  @ReactMethod
  fun openAccessibilitySettings(promise: Promise) {
    promise.resolve(StillSetup.openAccessibilitySettings(context, ::startFromStill))
  }

  /** Remembers that Settings was opened for [step] so the service can bring Still back. */
  @ReactMethod
  fun setSetupAwaiting(step: String?, promise: Promise) {
    StillSetup.setAwaiting(preferences, step)
    promise.resolve(null)
  }

  /** Arms a two-minute setup test for [packageName]; returns when it began (epoch ms). */
  @ReactMethod
  fun beginSetupProbe(packageName: String, promise: Promise) {
    if (StillSelfProtection.isOwnPackage(context.packageName, packageName)) {
      promise.reject("invalid_target", "Still cannot test itself")
      return
    }
    promise.resolve(StillSetup.beginProbe(preferences, packageName).toDouble())
  }

  /** When the pause last showed in test mode (epoch ms), or null. */
  @ReactMethod
  fun getSetupProbeResult(promise: Promise) {
    val verifiedAt = preferences.getLong(StillSetup.KEY_PROBE_VERIFIED_AT, 0)
    promise.resolve(Arguments.createMap().apply {
      if (verifiedAt > 0) putDouble("verifiedAt", verifiedAt.toDouble())
      StillSetup.probePackage(preferences)?.let { putString("waitingFor", it) }
    })
  }

  /** Opens a chosen app the way the launcher does, for the setup test. */
  @ReactMethod
  fun openApp(packageName: String, promise: Promise) {
    val intent = context.packageManager.getLaunchIntentForPackage(packageName)
    if (intent == null) {
      promise.resolve(false)
      return
    }
    promise.resolve(runCatching { startFromStill(intent) }.isSuccess)
  }

  @ReactMethod
  fun isIgnoringBatteryOptimizations(promise: Promise) {
    promise.resolve(StillSetup.isIgnoringBatteryOptimizations(context))
  }

  @ReactMethod
  fun openBatterySettings(promise: Promise) {
    promise.resolve(StillSetup.openBatterySettings(context, ::startFromStill))
  }

  private fun startFromStill(intent: Intent) {
    val activity = context.currentActivity
    if (activity != null) activity.startActivity(intent)
    else context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
  }

  /** Usage access: the onboarding story and the time given back (docs/real-savings-estimate-plan.md). */
  @ReactMethod
  fun hasUsageAccess(promise: Promise) {
    promise.resolve(StillUsageInsights.hasUsageAccess(context))
  }

  /** Opens Usage access without waiting: React Native checks again on its return. */
  @ReactMethod
  fun openUsageAccessSettings(promise: Promise) {
    val activity = context.currentActivity
    promise.resolve(
      StillUsageInsights.openUsageAccessSettings(context) { intent ->
        if (activity != null) activity.startActivity(intent)
        else context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      },
    )
  }

  /**
   * Seven complete local days and today: foreground time, unlocks and screen-ons
   * per day, and the most used apps with their time per day. Read off the main
   * thread, returned once and never stored.
   */
  @ReactMethod
  fun getUsageSummary(promise: Promise) {
    if (!StillUsageInsights.hasUsageAccess(context)) {
      promise.reject("usage_access_denied", "Usage access is not granted")
      return
    }
    Thread {
      runCatching {
        val summary = StillUsageInsights.readSummary(context)
        Arguments.createMap().apply {
          putArray("days", Arguments.createArray().apply {
            summary.days.forEachIndexed { index, day ->
              pushMap(Arguments.createMap().apply {
                putString("date", day.date.toString())
                putDouble("foregroundSeconds", day.foregroundMillis / 1_000.0)
                putInt("unlocks", day.unlocks)
                putInt("screenOns", day.screenOns)
                putBoolean("complete", index != summary.todayIndex)
              })
            }
          })
          putArray("apps", Arguments.createArray().apply {
            for ((packageName, label) in summary.apps) {
              pushMap(Arguments.createMap().apply {
                putString("packageName", packageName)
                putString("label", label)
                putArray("seconds", Arguments.createArray().apply {
                  for (day in summary.days) pushDouble((day.appMillis[packageName] ?: 0L) / 1_000.0)
                })
              })
            }
          })
        }
      }.onSuccess { promise.resolve(it) }
        .onFailure { promise.reject("usage_read_failed", it.message, it) }
    }.start()
  }

  /**
   * Every app used from `from` (local `yyyy-MM-dd`) until `toExclusive` or now:
   * sessions, their median and time per day (docs/real-savings-estimate-plan.md
   * §3.1). React Native keeps only what it needs, on the phone.
   */
  @ReactMethod
  fun getUsageStats(from: String, toExclusive: String?, promise: Promise) {
    if (!StillUsageInsights.hasUsageAccess(context)) {
      promise.reject("usage_access_denied", "Usage access is not granted")
      return
    }
    val start = runCatching { LocalDate.parse(from) }.getOrNull()
    val end = toExclusive?.let { runCatching { LocalDate.parse(it) }.getOrNull() }
    if (start == null || (toExclusive != null && end == null)) {
      promise.reject("invalid_range", "Dates must be yyyy-MM-dd")
      return
    }
    Thread {
      runCatching {
        val stats = StillUsageInsights.readStats(context, start, end)
        Arguments.createMap().apply {
          stats.firstEventMillis?.let { putDouble("firstEventAt", it.toDouble()) }
            ?: putNull("firstEventAt")
          putArray("days", Arguments.createArray().apply {
            for (day in stats.days) {
              pushMap(Arguments.createMap().apply {
                putString("date", day.toString())
                putBoolean("complete", day.isBefore(stats.today))
              })
            }
          })
          putArray("apps", Arguments.createArray().apply {
            for (app in stats.apps) {
              pushMap(Arguments.createMap().apply {
                putString("packageName", app.packageName)
                putInt("sessions", app.sessions)
                putDouble("medianSeconds", app.medianMillis / 1_000.0)
                putArray("seconds", Arguments.createArray().apply {
                  for (millis in app.millisByDay) pushDouble(millis / 1_000.0)
                })
              })
            }
          })
        }
      }.onSuccess { promise.resolve(it) }
        .onFailure { promise.reject("usage_read_failed", it.message, it) }
    }.start()
  }

  /** An installed app's icon as a PNG `data:` URI, for the onboarding's pictures. */
  @ReactMethod
  fun getAppIcon(packageName: String, sizeDp: Int, promise: Promise) {
    val sizePx = (sizeDp * context.resources.displayMetrics.density).toInt().coerceIn(24, 288)
    promise.resolve(StillUsageInsights.iconDataUri(context, packageName, sizePx))
  }

  @ReactMethod
  fun presentAppPicker(promise: Promise) {
    openPicker(Intent(), promise)
  }

  /**
   * The same picker with the most used apps offered first, none of them
   * ticked (onboarding v2, D11). [suggested] holds `{packageName, dailyMinutes}`.
   */
  @ReactMethod
  fun presentAppPickerSuggesting(suggested: ReadableArray, promise: Promise) {
    val packages = ArrayList<String>()
    val minutes = ArrayList<Int>()
    for (index in 0 until suggested.size()) {
      val item = suggested.getMap(index) ?: continue
      val packageName = item.getString("packageName") ?: continue
      packages += packageName
      minutes += if (item.hasKey("dailyMinutes")) item.getDouble("dailyMinutes").toInt() else 0
    }
    openPicker(
      Intent()
        .putStringArrayListExtra(AppPickerActivity.EXTRA_SUGGESTED_PACKAGES, packages)
        .putIntegerArrayListExtra(AppPickerActivity.EXTRA_SUGGESTED_MINUTES, minutes),
      promise,
    )
  }

  private fun openPicker(extras: Intent, promise: Promise) {
    StillSelfProtection.sanitizePreferences(preferences, context.packageName)
    val activity = context.currentActivity
    if (activity == null) {
      promise.reject("no_activity", "Still must be open to choose apps")
      return
    }
    pickerPromise?.reject("picker_replaced", "A newer picker request replaced this one")
    pickerPromise = promise
    activity.startActivityForResult(
      Intent(activity, AppPickerActivity::class.java).putExtras(extras),
      PICKER_REQUEST,
    )
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
    StillSelfProtection.sanitizePreferences(preferences, context.packageName)
    promise.resolve(null)
  }

  @ReactMethod
  fun cancelCurrentIntervention(promise: Promise) {
    val packageName = preferences.getString(KEY_CURRENT_PACKAGE, null)
    val day = StillDay.today()
    val totalKey = "avoided_opens:$day"
    val editor = preferences.edit()
      .remove(KEY_CURRENT_PACKAGE)
    if (!packageName.isNullOrBlank() && !StillSelfProtection.isOwnPackage(context.packageName, packageName)) {
      val appKey = appMetricKey(METRIC_APP_AVOIDED_OPENS, day, packageName)
      editor
        .putInt(totalKey, preferences.getInt(totalKey, 0) + 1)
        .putInt(appKey, preferences.getInt(appKey, 0) + 1)
    }
    editor.apply()

    val opened = runCatching {
      context.startActivity(
        Intent(Intent.ACTION_MAIN)
          .addCategory(Intent.CATEGORY_HOME)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      )
    }.isSuccess
    if (opened) promise.resolve(null)
    else promise.reject("home_unavailable", "Android could not return to Home")
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
    if (StillSelfProtection.isOwnPackage(context.packageName, packageName)) {
      StillSelfProtection.clearOwnTarget(preferences, context.packageName)
      promise.reject("invalid_target", "Still cannot restrict or unlock itself")
      return
    }
    val launchIntent = context.packageManager.getLaunchIntentForPackage(packageName)
    if (launchIntent == null) {
      promise.reject("target_unavailable", "The restricted app is no longer available")
      return
    }

    val duration = durationSeconds.coerceIn(60, 86400)
    val now = SystemClock.elapsedRealtime()
    val endsElapsed = now + duration * 1_000L
    val sessionId = UUID.randomUUID().toString()
    preferences.edit()
      .putLong("$UNLOCKED_PREFIX$packageName", endsElapsed)
      .putInt("$UNLOCKED_BOOT_PREFIX$packageName", currentBootCount())
      .putString("session:$sessionId", packageName)
      .apply()
    // The window has to end on time even if the user never leaves the app.
    StillAccessibilityService.watchAccessWindows()

    launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
    try {
      context.startActivity(launchIntent)
    } catch (error: Exception) {
      preferences.edit()
        .remove("session:$sessionId")
        .remove("unlocked:$packageName")
        .remove("unlocked_boot:$packageName")
        .apply()
      promise.reject("target_launch_failed", "Android could not reopen the restricted app", error)
      return
    }

    val day = StillDay.today()
    val unlocksKey = "unlocks:$day"
    val appUnlocksKey = appMetricKey(METRIC_APP_UNLOCKS, day, packageName)
    preferences.edit()
      .remove(KEY_CURRENT_PACKAGE)
      .putInt(unlocksKey, preferences.getInt(unlocksKey, 0) + 1)
      .putInt(appUnlocksKey, preferences.getInt(appUnlocksKey, 0) + 1)
      .apply()

    Handler(Looper.getMainLooper()).postDelayed({ restoreSession(sessionId) }, duration * 1_000L)

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
    val selected = StillSelfProtection
      .sanitizePreferences(preferences, context.packageName)
      .size
    val accessibilityEnabled = isAccessibilityEnabled()
    val restrictionsEnabled = preferences.getBoolean(KEY_RESTRICTIONS_ENABLED, false)
    promise.resolve(Arguments.createMap().apply {
      putString("authorization", if (accessibilityEnabled) "authorized" else "denied")
      // Enabled in Settings and actually bound: the onboarding needs both (§4.3).
      putBoolean("serviceRunning", accessibilityEnabled && StillAccessibilityService.isRunning)
      putBoolean("engineActive", restrictionsEnabled && accessibilityEnabled && selected > 0)
      putInt("selectedCount", selected)
      preferences.getString(KEY_LAST_RESTORED, null)?.let { putString("lastRestoredAt", it) }
      if (!restrictionsEnabled) putString("issue", "restrictions_disabled")
      else if (!accessibilityEnabled) putString("issue", "accessibility_disabled")
    })
  }

  @ReactMethod
  fun syncWallet(
    rewarded: Int,
    resetAt: String,
    estimatedMinutesPerAvoidedOpen: Double,
    unlockDurationSeconds: Int,
    restrictionsEnabled: Boolean,
    promise: Promise,
  ) {
    preferences.edit()
      // Saved passes are gone (docs/ads-only-pause-plan.md): `rewarded` stays
      // for the bridge signature, and the balance older builds stored is
      // dropped. Emergency access was removed before that.
      .remove(KEY_REWARDED_BALANCE)
      .remove(LEGACY_KEY_EMERGENCY_REMAINING)
      .putString(KEY_WALLET_RESET_AT, resetAt)
      .putFloat(KEY_ESTIMATED_MINUTES_PER_AVOIDED_OPEN, estimatedMinutesPerAvoidedOpen.coerceIn(0.0, 60.0).toFloat())
      .putInt(KEY_UNLOCK_DURATION_SECONDS, unlockDurationSeconds.coerceIn(60, 86400))
      .putBoolean(KEY_RESTRICTIONS_ENABLED, restrictionsEnabled)
      .apply()
    promise.resolve(null)
  }

  /**
   * React Native mirrors the reward eligibility it already computes
   * (`canRequestReward` + kill switch) and the resolved ad unit into native
   * storage, so the shield's ad manager can preload without duplicating that
   * logic. Passing `adsEligible = false` stops preloading and drops any held ad.
   */
  @ReactMethod
  fun syncRewardConfig(
    adsEligible: Boolean,
    adUnitId: String,
    rewardProvider: String,
    promise: Promise,
  ) {
    preferences.edit()
      .putBoolean(KEY_ADS_ELIGIBLE, adsEligible)
      .putString(KEY_ADMOB_REWARDED_UNIT, adUnitId)
      .putString(KEY_REWARD_PROVIDER, rewardProvider)
      .apply()
    StillRewardedAdManager.preload(context, "sync-reward-config")
    promise.resolve(null)
  }

  /**
   * React Native drops a small buffer of pre-signed reward intents here while it
   * is in the foreground. The shield consumes one to attach SSV before showing
   * the ad, so the ad flow never has to reach the network mid-intervention.
   */
  @ReactMethod
  fun setPresignedRewardIntents(intents: com.facebook.react.bridge.ReadableArray, promise: Promise) {
    val array = org.json.JSONArray()
    for (index in 0 until intents.size()) {
      val item = intents.getMap(index) ?: continue
      val id = item.getString("id") ?: continue
      val customData = item.getString("customData") ?: continue
      val expiresAt = item.getString("expiresAt") ?: continue
      array.put(
        org.json.JSONObject()
          .put("id", id)
          .put("customData", customData)
          .put("userId", if (item.hasKey("userId")) item.getString("userId") else "anonymous")
          .put("expiresAt", expiresAt),
      )
    }
    preferences.edit().putString(KEY_PRESIGNED_INTENTS, array.toString()).apply()
    promise.resolve(null)
  }

  /**
   * Earned rewards recorded by the shield while React Native was not running.
   * React Native claims each one on foreground and then acknowledges it.
   */
  @ReactMethod
  fun getPendingAdResults(promise: Promise) {
    val raw = preferences.getString(KEY_AD_OUTBOX, null)
    val results = Arguments.createArray()
    runCatching {
      if (raw != null) {
        val array = org.json.JSONArray(raw)
        for (index in 0 until array.length()) {
          val item = array.optJSONObject(index) ?: continue
          results.pushMap(Arguments.createMap().apply {
            putString("clientEventId", item.optString("clientEventId"))
            putString("intentId", item.optString("intentId"))
            putString("earnedAt", item.optString("earnedAt"))
            // What the SDK said the impression paid, when it said anything.
            if (item.has("adValueMicros")) {
              putDouble("adValueMicros", item.optLong("adValueMicros").toDouble())
              putString("adValueCurrency", item.optString("adValueCurrency"))
              putInt("adValuePrecision", item.optInt("adValuePrecision"))
            }
          })
        }
      }
    }
    promise.resolve(results)
  }

  @ReactMethod
  fun acknowledgeAdResult(clientEventId: String, promise: Promise) {
    val raw = preferences.getString(KEY_AD_OUTBOX, null)
    if (raw == null) {
      promise.resolve(null)
      return
    }
    val remaining = org.json.JSONArray()
    runCatching {
      val array = org.json.JSONArray(raw)
      for (index in 0 until array.length()) {
        val item = array.optJSONObject(index) ?: continue
        if (item.optString("clientEventId") != clientEventId) remaining.put(item)
      }
    }
    preferences.edit().putString(KEY_AD_OUTBOX, remaining.toString()).apply()
    promise.resolve(null)
  }

  /**
   * Unlocks the shield performed by itself (camino A2). React Native reports
   * each one to the server on foreground and then acknowledges it, so the wallet
   * reconciles even though the unlock happened while React Native was not running.
   */
  @ReactMethod
  fun getPendingUnlockEvents(promise: Promise) {
    val raw = preferences.getString(KEY_UNLOCK_OUTBOX, null)
    val events = Arguments.createArray()
    runCatching {
      if (raw != null) {
        val array = org.json.JSONArray(raw)
        for (index in 0 until array.length()) {
          val item = array.optJSONObject(index) ?: continue
          events.pushMap(Arguments.createMap().apply {
            putString("clientSessionId", item.optString("clientSessionId"))
            putString("source", item.optString("source"))
            putInt("durationSeconds", item.optInt("durationSeconds"))
            putString("startedAt", item.optString("startedAt"))
            // The ad that paid for the visit: the server charges it to that ad.
            item.optString("rewardIntentId").takeIf { it.isNotEmpty() }?.let {
              putString("rewardIntentId", it)
            }
          })
        }
      }
    }
    promise.resolve(events)
  }

  @ReactMethod
  fun acknowledgeUnlockEvent(clientSessionId: String, promise: Promise) {
    val raw = preferences.getString(KEY_UNLOCK_OUTBOX, null)
    if (raw == null) {
      promise.resolve(null)
      return
    }
    val remaining = org.json.JSONArray()
    runCatching {
      val array = org.json.JSONArray(raw)
      for (index in 0 until array.length()) {
        val item = array.optJSONObject(index) ?: continue
        if (item.optString("clientSessionId") != clientSessionId) remaining.put(item)
      }
    }
    preferences.edit().putString(KEY_UNLOCK_OUTBOX, remaining.toString()).apply()
    promise.resolve(null)
  }

  @ReactMethod
  fun hasPendingIntervention(promise: Promise) = promise.resolve(false)

  /**
   * The apps the user chose, each with today's activity and when Still last
   * paused it, for the per-app state in Settings and the apps screen. Labels are
   * resolved here so the bridge never has to carry icons.
   */
  @ReactMethod
  fun getSelectedAppsState(promise: Promise) {
    val selected = StillSelfProtection.sanitizePreferences(preferences, context.packageName)
    val day = StillDay.today()
    val apps = Arguments.createArray()
    selected
      .map { packageName ->
        val label = runCatching {
          context.packageManager.getApplicationLabel(
            context.packageManager.getApplicationInfo(packageName, 0),
          ).toString()
        }.getOrDefault(packageName)
        packageName to label
      }
      .sortedBy { it.second.lowercase() }
      .forEach { (packageName, label) ->
        apps.pushMap(Arguments.createMap().apply {
          putString("packageName", packageName)
          putString("label", label)
          preferences.getString(appStateKey(STATE_LAST_PAUSE_AT, packageName), null)
            ?.let { putString("lastPauseAt", it) }
          putInt(
            "openAttemptsToday",
            preferences.getInt(appMetricKey(METRIC_APP_OPEN_ATTEMPTS, day, packageName), 0),
          )
          putInt(
            "avoidedOpensToday",
            preferences.getInt(appMetricKey(METRIC_APP_AVOIDED_OPENS, day, packageName), 0),
          )
          putInt(
            "unlocksToday",
            preferences.getInt(appMetricKey(METRIC_APP_UNLOCKS, day, packageName), 0),
          )
        })
      }
    promise.resolve(apps)
  }

  /**
   * The access windows running right now. Deadlines are monotonic and owned by
   * the shield, so this reports when each app is actually paused again rather
   * than a countdown JavaScript keeps.
   */
  @ReactMethod
  fun getAccessWindows(promise: Promise) {
    val boot = currentBootCount()
    val now = SystemClock.elapsedRealtime()
    val windows = Arguments.createArray()
    preferences.all
      .filterKeys { it.startsWith(UNLOCKED_PREFIX) }
      .mapNotNull { (key, value) ->
        val target = key.removePrefix(UNLOCKED_PREFIX)
        val deadline = value as? Long
        if (target.isEmpty() || deadline == null) null else target to deadline
      }
      .filter {
        preferences.getInt("$UNLOCKED_BOOT_PREFIX${it.first}", -1) == boot && it.second > now
      }
      .sortedBy { it.second }
      .forEach { (target, deadline) ->
        windows.pushMap(Arguments.createMap().apply {
          putString(
            "label",
            runCatching {
              context.packageManager.getApplicationLabel(
                context.packageManager.getApplicationInfo(target, 0),
              ).toString()
            }.getOrDefault(target),
          )
          putString(
            "endsAt",
            java.time.Instant.now().plusMillis(deadline - now).toString(),
          )
        })
      }
    promise.resolve(windows)
  }

  /**
   * Still's own counters: today plus the last seven local days for Today's
   * week, identical in shape to iOS so both platforms show the same numbers.
   */
  @ReactMethod
  fun getLocalWellbeing(promise: Promise) {
    val today = StillDay.today()
    promise.resolve(Arguments.createMap().apply {
      putInt("openAttempts", preferences.getInt("open_attempts:$today", 0))
      putInt("avoidedOpens", preferences.getInt("avoided_opens:$today", 0))
      putInt("unlocks", preferences.getInt("unlocks:$today", 0))
      putArray("history", Arguments.createArray().apply {
        StillDay.lastDays(HISTORY_DAYS).forEach { day ->
          pushMap(Arguments.createMap().apply {
            putString("date", day)
            putInt("openAttempts", preferences.getInt("open_attempts:$day", 0))
            putInt("avoidedOpens", preferences.getInt("avoided_opens:$day", 0))
            putInt("unlocks", preferences.getInt("unlocks:$day", 0))
          })
        }
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
    if (StillSelfProtection.isOwnPackage(context.packageName, packageName)) {
      StillSelfProtection.clearOwnTarget(preferences, context.packageName)
      return
    }
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
    StillSelfProtection.sanitizePreferences(preferences, context.packageName)
    authorizationPromise?.let {
      authorizationPromise = null
      it.resolve(if (isAccessibilityEnabled()) "authorized" else "denied")
    }
  }

  override fun onHostPause() = Unit

  override fun onHostDestroy() {
    authorizationPromise = null
    pickerPromise = null
  }

  companion object {
    const val PREFERENCES = "still_restrictions"
    /** Days of history Today's week shows, ending today. */
    const val HISTORY_DAYS = 7
    const val KEY_SELECTED_PACKAGES = "selected_packages"
    const val KEY_CURRENT_PACKAGE = "current_package"
    const val METRIC_APP_OPEN_ATTEMPTS = "app_open_attempts"
    const val METRIC_APP_AVOIDED_OPENS = "app_avoided_opens"
    const val METRIC_APP_UNLOCKS = "app_unlocks"
    const val KEY_LAST_RESTORED = "last_restored_at"
    /** Saved passes were removed; only cleared, never read. */
    private const val KEY_REWARDED_BALANCE = "rewarded_balance"
    /** Emergency access was removed; only cleared, never read. */
    private const val LEGACY_KEY_EMERGENCY_REMAINING = "emergency_remaining"
    const val KEY_WALLET_RESET_AT = "wallet_reset_at"
    const val KEY_ESTIMATED_MINUTES_PER_AVOIDED_OPEN = "estimated_minutes_per_avoided_open"
    const val KEY_UNLOCK_DURATION_SECONDS = "unlock_duration_seconds"
    /**
     * The last window the user chose on the shield's slider. It only seeds the
     * slider next time; the window granted is always the one just chosen.
     */
    const val KEY_LAST_ACCESS_DURATION = "last_access_duration_seconds"
    const val UNLOCKED_PREFIX = "unlocked:"
    const val UNLOCKED_BOOT_PREFIX = "unlocked_boot:"
    const val KEY_RESTRICTIONS_ENABLED = "restrictions_enabled"
    const val KEY_ADS_ELIGIBLE = "ads_eligible"
    const val KEY_ADMOB_REWARDED_UNIT = "admob_rewarded_unit"
    const val KEY_REWARD_PROVIDER = "reward_provider"
    const val KEY_PRESIGNED_INTENTS = "presigned_reward_intents"
    const val KEY_AD_OUTBOX = "ad_result_outbox"
    const val KEY_UNLOCK_OUTBOX = "unlock_report_outbox"
    const val KEY_EXTERNAL_AUTH_BYPASS_PACKAGES = "external_auth_bypass_packages"
    const val KEY_EXTERNAL_AUTH_BYPASS_UNTIL = "external_auth_bypass_until"
    const val KEY_EXTERNAL_AUTH_BYPASS_BOOT = "external_auth_bypass_boot"

    const val STATE_LAST_PAUSE_AT = "app_last_pause_at"

    fun appMetricKey(metric: String, day: String, packageName: String) =
      "$metric:$day:$packageName"

    fun appStateKey(state: String, packageName: String) = "$state:$packageName"
    private const val EXTERNAL_AUTH_BYPASS_TIMEOUT_MS = 10 * 60 * 1_000L
    private const val PICKER_REQUEST = 4270
  }
}

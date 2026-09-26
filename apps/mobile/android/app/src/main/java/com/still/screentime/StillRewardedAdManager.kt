package com.still.screentime

import android.app.Activity
import android.content.Context
import android.content.SharedPreferences
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.util.Log
import com.google.android.gms.ads.AdError
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdValue
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback
import com.google.android.gms.ads.rewarded.ServerSideVerificationOptions
import java.time.Instant
import java.util.UUID
import org.json.JSONArray
import org.json.JSONObject

/**
 * Keeps two rewarded ads loaded in the app process so the shield can show one
 * the instant the user taps, with no jump to another screen (Android parity
 * plan §2, camino A2). An ad is never started on its own: only [show] presents
 * it, and only after an explicit tap (D1).
 *
 * This object lives in whatever process first touches it. The
 * AccessibilityService runs in the app's main process and is kept alive by the
 * system while accessibility is on, so the ads survive between interventions.
 * The pool follows docs/ad-preload-plan.md (P1–P4, rules in [AdPool]): two ads,
 * the oldest shown first; each renewed from 50 min on and dropped at 55, before
 * the SDK expires it; a failed load retried after 30 s, 1, 2, 5 and then every
 * 10 min. Loads only start with the screen on (P3): with it off the ads are
 * left to expire, and the service refills them when it comes back on, when the
 * phone is unlocked and when the network returns. A load still in flight with
 * nothing ready is reported as [AdState.LOADING], so the shield can wait for it
 * a moment (see [awaitLoad]).
 */
object StillRewardedAdManager {
  private const val TAG = "StillRewardedAd"

  // The SDK normally answers a load within seconds. Past this, a load that
  // never called back no longer blocks a fresh one.
  private const val LOAD_STUCK_MS = 60_000L

  /**
   * Debug builds only: a shorter ad lifetime (ms) so QA can watch ads expire
   * and renew without waiting an hour. Release builds ignore it.
   */
  const val KEY_DEBUG_AD_TTL_MS = "debug_ad_ttl_ms"

  private val main = Handler(Looper.getMainLooper())

  @Volatile private var initialized = false
  @Volatile private var loading = false
  @Volatile private var loadStartedAtElapsed = 0L
  /** The loaded ads with their load time. Changed on the main thread only. */
  @Volatile private var pool: List<PooledAd<RewardedAd>> = emptyList()
  /** Failed loads in a row; the next retry waits [AdPool.retryDelayMs]. */
  private var failures = 0
  private var lastAttemptAtElapsed: Long? = null
  /** Set on the first preload, so timers can refill on their own. */
  @Volatile private var appContext: Context? = null
  /** The next renewal or retry. */
  private val scheduledFill = Runnable { appContext?.let { fill(it, "scheduled") } }

  /** Told once when the load in flight ends: true when an ad is now ready. */
  private val loadWaiters = mutableListOf<(Boolean) -> Unit>()

  /** What the shield can count on right now. */
  enum class AdState { READY, LOADING, NONE }

  /**
   * How the ad ended. [intentId] is the pre-signed intent it was shown with, so
   * the visit it pays for can name it; null when the buffer was empty and the
   * ad ran without one.
   */
  data class AdOutcome(val earned: Boolean, val reason: String, val intentId: String? = null)

  fun isAdReady(): Boolean {
    val now = SystemClock.elapsedRealtime()
    val ttl = ttlMs()
    val valid = AdPool.pruneExpired(pool, now, ttl)
    if (valid.size != pool.size) {
      Log.i(TAG, "dropped ${pool.size - valid.size} expired ad(s)")
      pool = valid
      // Replace them now rather than at the next shield, which would then have
      // to wait for the load.
      appContext?.let { preload(it, "expired") }
    }
    return valid.isNotEmpty()
  }

  fun state(): AdState = when {
    isAdReady() -> AdState.READY
    isLoading() -> AdState.LOADING
    else -> AdState.NONE
  }

  private fun isLoading(): Boolean =
    loading && SystemClock.elapsedRealtime() - loadStartedAtElapsed < LOAD_STUCK_MS

  /**
   * Calls [onSettled] on the main thread once the load in flight ends (true
   * when an ad is ready), or right away when nothing is loading. The returned
   * function cancels the wait.
   */
  fun awaitLoad(onSettled: (Boolean) -> Unit): () -> Unit {
    if (!isLoading()) {
      val ready = isAdReady()
      main.post { onSettled(ready) }
      return {}
    }
    onMain { loadWaiters.add(onSettled) }
    return { onMain { loadWaiters.remove(onSettled) } }
  }

  private fun onMain(block: () -> Unit) {
    if (Looper.myLooper() == Looper.getMainLooper()) block() else main.post(block)
  }

  private fun settleWaiters(ready: Boolean) {
    val waiters = loadWaiters.toList()
    loadWaiters.clear()
    waiters.forEach { it(ready) }
  }

  /**
   * Initialize the SDK once and, when rewards are eligible, top the pool up.
   * Safe to call repeatedly (service connect, screen on, unlock, network back,
   * the shield, after use). During a retry wait it only loads when the last
   * attempt is 30 s old (P4). On the main thread it runs at once, so a caller
   * reading [state] right after already sees the load it started.
   */
  fun preload(context: Context, reason: String) {
    val applicationContext = context.applicationContext
    appContext = applicationContext
    onMain {
      val now = SystemClock.elapsedRealtime()
      if (failures > 0 && !AdPool.triggerMayBypassBackoff(lastAttemptAtElapsed, now)) {
        schedule(applicationContext)
        return@onMain
      }
      fill(applicationContext, reason)
    }
  }

  /**
   * The network is available: refills only when a load failed before it came
   * back. The call Android makes on registering, with nothing failed, loads
   * nothing.
   */
  fun onNetworkAvailable(context: Context) {
    val applicationContext = context.applicationContext
    onMain {
      if (failures > 0) preload(applicationContext, "network")
    }
  }

  /** The screen went off: no renewals or retries until it is back on (P3). */
  fun onScreenOff() {
    onMain { main.removeCallbacks(scheduledFill) }
  }

  private fun fill(appContext: Context, reason: String) {
    val preferences = preferencesOf(appContext)
    if (!adsEligible(preferences)) {
      // Rewards disabled or another provider: drop any held ad instead of
      // holding inventory that policy would not let us grant.
      pool = emptyList()
      failures = 0
      main.removeCallbacks(scheduledFill)
      return
    }
    if (!initialized) {
      initialized = true
      runCatching { MobileAds.initialize(appContext) {} }
        .onFailure { Log.w(TAG, "SDK init failed", it) }
    }
    val now = SystemClock.elapsedRealtime()
    val ttl = ttlMs()
    pool = AdPool.pruneExpired(pool, now, ttl)
    if (isLoading()) return
    if (AdPool.slotsToFill(pool, now, AdPool.SIZE, AdPool.refreshAfterFor(ttl)) == 0) {
      schedule(appContext)
      return
    }
    if (!isInteractive(appContext)) {
      // Screen off: leave it for the screen-on refill (P3).
      main.removeCallbacks(scheduledFill)
      return
    }
    val unitId = preferences.getString(StillRestrictionModule.KEY_ADMOB_REWARDED_UNIT, null)
      ?: return
    main.removeCallbacks(scheduledFill)
    loading = true
    loadStartedAtElapsed = now
    lastAttemptAtElapsed = now
    Log.i(TAG, "loading ($reason), ${pool.size} ready")
    runCatching {
      RewardedAd.load(
        appContext,
        unitId,
        AdRequest.Builder().build(),
        object : RewardedAdLoadCallback() {
          override fun onAdLoaded(ad: RewardedAd) {
            loading = false
            failures = 0
            if (!adsEligible(preferencesOf(appContext))) {
              settleWaiters(ready = false)
              return
            }
            pool = AdPool.addAndTrim(pool, PooledAd(ad, SystemClock.elapsedRealtime()))
            Log.i(TAG, "loaded ($reason), ${pool.size} ready")
            settleWaiters(ready = true)
            // Another slot may still be empty, or due for renewal.
            fill(appContext, "top-up")
          }

          override fun onAdFailedToLoad(error: LoadAdError) {
            Log.w(TAG, "load failed ($reason): ${error.code} ${error.message}")
            loadFailed(appContext)
          }
        },
      )
    }.onFailure {
      Log.w(TAG, "load threw ($reason)", it)
      loadFailed(appContext)
    }
  }

  private fun loadFailed(appContext: Context) {
    loading = false
    failures += 1
    settleWaiters(ready = isAdReady())
    schedule(appContext)
  }

  /** Posts the next retry, or the next renewal, whichever applies. */
  private fun schedule(appContext: Context) {
    main.removeCallbacks(scheduledFill)
    if (isLoading()) return
    val now = SystemClock.elapsedRealtime()
    val at = if (failures > 0) {
      (lastAttemptAtElapsed ?: now) + AdPool.retryDelayMs(failures)
    } else {
      AdPool.nextRefreshAt(pool, AdPool.refreshAfterFor(ttlMs()))
    } ?: return
    if (!isInteractive(appContext)) return
    val delay = maxOf(0L, at - now)
    if (failures > 0) Log.i(TAG, "retry #$failures in ${delay / 1_000} s")
    main.postDelayed(scheduledFill, delay)
  }

  private fun isInteractive(context: Context): Boolean =
    (context.getSystemService(Context.POWER_SERVICE) as? PowerManager)?.isInteractive ?: true

  private fun ttlMs(): Long {
    if (!BuildConfig.DEBUG) return AdPool.TTL_MS
    val context = appContext ?: return AdPool.TTL_MS
    // Written by hand over adb, so it may be stored as an int or a long.
    val preferences = preferencesOf(context)
    val override = runCatching { preferences.getLong(KEY_DEBUG_AD_TTL_MS, 0L) }
      .recoverCatching { preferences.getInt(KEY_DEBUG_AD_TTL_MS, 0).toLong() }
      .getOrDefault(0L)
    return override.takeIf { it > 0 } ?: AdPool.TTL_MS
  }

  private fun preferencesOf(context: Context): SharedPreferences =
    context.getSharedPreferences(StillRestrictionModule.PREFERENCES, Context.MODE_PRIVATE)

  /**
   * Present the preloaded ad from [activity]. Attaches SSV from a pre-signed
   * intent when one is available, records the earned result in the native
   * outbox for React Native to claim, and reloads for next time.
   *
   * Returns false when no ad is ready, so the caller can fall back to the
   * timed pause.
   */
  fun show(activity: Activity, onOutcome: (AdOutcome) -> Unit): Boolean {
    val ad = if (isAdReady()) {
      AdPool.oldest(pool, SystemClock.elapsedRealtime(), ttlMs())?.also { taken ->
        pool = pool - taken
      }?.item
    } else {
      null
    }
    if (ad == null) {
      onOutcome(AdOutcome(earned = false, reason = "unavailable"))
      return false
    }
    val preferences = activity.getSharedPreferences(
      StillRestrictionModule.PREFERENCES,
      Context.MODE_PRIVATE,
    )
    val intent = takePresignedIntent(preferences)
    if (intent != null) {
      ad.setServerSideVerificationOptions(
        ServerSideVerificationOptions.Builder()
          .setCustomData(intent.customData)
          .setUserId(intent.userId)
          .build(),
      )
    }

    var earned = false
    // What this impression paid (impression-level ad revenue). It fires on the
    // impression, before the reward, and only once the AdMob account has the
    // feature on; without it the server prices the ad by eCPM.
    var paid: AdValue? = null
    ad.onPaidEventListener = com.google.android.gms.ads.OnPaidEventListener { value ->
      paid = value
    }
    ad.fullScreenContentCallback = object : FullScreenContentCallback() {
      override fun onAdDismissedFullScreenContent() {
        if (earned && intent != null) {
          enqueueAdResult(preferences, intent.id, paid)
        }
        preload(activity, "after-dismiss")
        onOutcome(
          AdOutcome(
            earned = earned,
            reason = if (earned) "earned" else "dismissed",
            intentId = intent?.id,
          ),
        )
      }

      override fun onAdFailedToShowFullScreenContent(error: AdError) {
        Log.w(TAG, "show failed: ${error.code} ${error.message}")
        preload(activity, "after-failure")
        onOutcome(AdOutcome(earned = false, reason = "failed"))
      }
    }
    ad.show(activity) { earned = true }
    return true
  }

  private fun adsEligible(preferences: SharedPreferences): Boolean {
    if (!preferences.getBoolean(StillRestrictionModule.KEY_RESTRICTIONS_ENABLED, false)) return false
    if (!preferences.getBoolean(StillRestrictionModule.KEY_ADS_ELIGIBLE, false)) return false
    return preferences.getString(StillRestrictionModule.KEY_REWARD_PROVIDER, null) == "admob"
  }

  private data class PresignedIntent(val id: String, val customData: String, val userId: String)

  /** Pull the freshest non-expired pre-signed intent and persist the remainder. */
  private fun takePresignedIntent(preferences: SharedPreferences): PresignedIntent? {
    val raw = preferences.getString(StillRestrictionModule.KEY_PRESIGNED_INTENTS, null) ?: return null
    val now = Instant.now()
    val remaining = JSONArray()
    var chosen: PresignedIntent? = null
    var chosenExpiry: Instant? = null
    runCatching {
      val array = JSONArray(raw)
      for (index in 0 until array.length()) {
        val item = array.optJSONObject(index) ?: continue
        val id = item.optString("id")
        val customData = item.optString("customData")
        val expiresAt = item.optString("expiresAt")
        if (id.isEmpty() || customData.length < 16 || expiresAt.isEmpty()) continue
        val expiry = runCatching { Instant.parse(expiresAt) }.getOrNull() ?: continue
        if (!expiry.isAfter(now)) continue
        val candidate = PresignedIntent(id, customData, item.optString("userId", "anonymous"))
        if (chosenExpiry == null || expiry.isAfter(chosenExpiry)) {
          // A previously chosen (less fresh) intent goes back into the buffer.
          chosen?.let { previous -> remaining.put(intentJson(previous, chosenExpiry!!)) }
          chosen = candidate
          chosenExpiry = expiry
        } else {
          remaining.put(intentJson(candidate, expiry))
        }
      }
    }
    preferences.edit()
      .putString(StillRestrictionModule.KEY_PRESIGNED_INTENTS, remaining.toString())
      .apply()
    return chosen
  }

  private fun intentJson(intent: PresignedIntent, expiry: Instant): JSONObject =
    JSONObject()
      .put("id", intent.id)
      .put("customData", intent.customData)
      .put("userId", intent.userId)
      .put("expiresAt", expiry.toString())

  /** Queue an earned result for React Native to claim (idempotent by clientEventId). */
  private fun enqueueAdResult(preferences: SharedPreferences, intentId: String, paid: AdValue?) {
    val raw = preferences.getString(StillRestrictionModule.KEY_AD_OUTBOX, null)
    val array = runCatching { if (raw != null) JSONArray(raw) else JSONArray() }.getOrDefault(JSONArray())
    val result = JSONObject()
      .put("clientEventId", UUID.randomUUID().toString())
      .put("intentId", intentId)
      .put("earnedAt", Instant.now().toString())
    if (paid != null) {
      result
        .put("adValueMicros", paid.valueMicros)
        .put("adValueCurrency", paid.currencyCode)
        .put("adValuePrecision", paid.precisionType)
    }
    array.put(result)
    preferences.edit().putString(StillRestrictionModule.KEY_AD_OUTBOX, array.toString()).apply()
  }
}

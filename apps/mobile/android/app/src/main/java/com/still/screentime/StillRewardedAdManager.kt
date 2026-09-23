package com.still.screentime

import android.app.Activity
import android.content.Context
import android.content.SharedPreferences
import android.os.Handler
import android.os.Looper
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
 * Keeps a rewarded ad loaded in the app process so the shield can show it the
 * instant the user taps, with no jump to another screen (Android parity plan
 * §2, camino A2). The ad is never started on its own: only [show] presents it,
 * and only after an explicit tap (D1).
 *
 * This object lives in whatever process first touches it. The
 * AccessibilityService runs in the app's main process and is kept alive by the
 * system while accessibility is on, so a preload done there survives between
 * interventions (measured >30 min). The Google Mobile Ads SDK still expires a
 * loaded ad after about an hour, so [preload] refreshes before that and after
 * every use.
 */
object StillRewardedAdManager {
  private const val TAG = "StillRewardedAd"

  // A loaded rewarded ad expires after ~1 hour (Google Mobile Ads SDK). Refresh
  // comfortably before that so a tap never meets a stale ad.
  private const val AD_TTL_MS = 55 * 60 * 1_000L

  private val main = Handler(Looper.getMainLooper())

  @Volatile private var initialized = false
  @Volatile private var loading = false
  @Volatile private var loadedAd: RewardedAd? = null
  @Volatile private var loadedAtElapsed = 0L

  /**
   * How the ad ended. [intentId] is the pre-signed intent it was shown with, so
   * the visit it pays for can name it; null when the buffer was empty and the
   * ad ran without one.
   */
  data class AdOutcome(val earned: Boolean, val reason: String, val intentId: String? = null)

  fun isAdReady(): Boolean {
    val ad = loadedAd ?: return false
    if (SystemClock.elapsedRealtime() - loadedAtElapsed >= AD_TTL_MS) {
      loadedAd = null
      return false
    }
    return true
  }

  /**
   * Initialize the SDK once and, when rewards are eligible, keep an ad ready.
   * Safe to call repeatedly (service connect, foreground event, after use).
   */
  fun preload(context: Context, reason: String) {
    val appContext = context.applicationContext
    main.post {
      val preferences = appContext.getSharedPreferences(
        StillRestrictionModule.PREFERENCES,
        Context.MODE_PRIVATE,
      )
      if (!adsEligible(preferences)) {
        // Rewards disabled, wallet full, or daily cap reached: drop any stale ad
        // instead of holding inventory that policy would not let us grant.
        loadedAd = null
        return@post
      }
      if (!initialized) {
        initialized = true
        runCatching { MobileAds.initialize(appContext) {} }
          .onFailure { Log.w(TAG, "SDK init failed", it) }
      }
      if (isAdReady() || loading) return@post
      val unitId = preferences.getString(StillRestrictionModule.KEY_ADMOB_REWARDED_UNIT, null)
        ?: return@post
      loading = true
      runCatching {
        RewardedAd.load(
          appContext,
          unitId,
          AdRequest.Builder().build(),
          object : RewardedAdLoadCallback() {
            override fun onAdLoaded(ad: RewardedAd) {
              loading = false
              loadedAd = ad
              loadedAtElapsed = SystemClock.elapsedRealtime()
            }

            override fun onAdFailedToLoad(error: LoadAdError) {
              loading = false
              loadedAd = null
              Log.w(TAG, "load failed ($reason): ${error.code} ${error.message}")
            }
          },
        )
      }.onFailure {
        loading = false
        Log.w(TAG, "load threw ($reason)", it)
      }
    }
  }

  /**
   * Present the preloaded ad from [activity]. Attaches SSV from a pre-signed
   * intent when one is available, records the earned result in the native
   * outbox for React Native to claim, and reloads for next time.
   *
   * Returns false when no ad is ready, so the caller can fall back to the
   * saved pass or the timed pause (D3).
   */
  fun show(activity: Activity, onOutcome: (AdOutcome) -> Unit): Boolean {
    val ad = if (isAdReady()) loadedAd else null
    if (ad == null) {
      onOutcome(AdOutcome(earned = false, reason = "unavailable"))
      return false
    }
    loadedAd = null
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

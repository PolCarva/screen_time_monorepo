package com.still.screentime

import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

/**
 * What each shield offered when it opened, for the `pause_ad_gate` event
 * (docs/ad-preload-plan.md, P9): the ad state it met (`ready`, `preparing` or
 * `none`), what it ended up offering (`ready` or `none`) and how long that took.
 * The shield appends here; React Native drains the queue on foreground and
 * sends it only when analytics is on. Nothing names the app or the time.
 */
object PauseAdGateLog {
  const val KEY = "pause_ad_gate_log"
  private const val MAX_ENTRIES = 50

  fun record(preferences: SharedPreferences, ad: String, offered: String, waitedMs: Long) {
    val entries = read(preferences)
    entries.put(
      JSONObject()
        .put("ad", ad)
        .put("offered", offered)
        .put("waitedMs", waitedMs.coerceAtLeast(0L)),
    )
    val kept = JSONArray()
    for (index in maxOf(0, entries.length() - MAX_ENTRIES) until entries.length()) {
      kept.put(entries.get(index))
    }
    preferences.edit().putString(KEY, kept.toString()).apply()
  }

  /** Every entry recorded so far, oldest first; the queue is left empty. */
  fun drain(preferences: SharedPreferences): JSONArray {
    val entries = read(preferences)
    preferences.edit().remove(KEY).apply()
    return entries
  }

  private fun read(preferences: SharedPreferences): JSONArray =
    runCatching { JSONArray(preferences.getString(KEY, null) ?: "[]") }.getOrDefault(JSONArray())
}

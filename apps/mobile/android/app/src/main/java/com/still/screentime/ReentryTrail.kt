package com.still.screentime

/**
 * The last counted pause of an app, to tell a real skip from one undone right
 * after (docs/real-savings-estimate-plan.md §2.3, D6): a pause that did not end
 * in the app, followed within [WINDOW_MILLIS] by going into that same app,
 * gives no time back. Pure Kotlin so ReentryTrailTest pins it down; the same
 * rule lives in StillShortcutIntent.swift for iOS.
 */
object ReentryTrail {
  const val WINDOW_MILLIS = 10 * 60_000L

  data class Trail(val atMillis: Long, val entered: Boolean, val followsSkip: Boolean)

  /** A new counted pause at `nowMillis`, after `previous` (the app's last one). */
  fun onPause(previous: Trail?, nowMillis: Long): Trail = Trail(
    atMillis = nowMillis,
    entered = false,
    followsSkip = previous != null &&
      !previous.entered &&
      nowMillis - previous.atMillis in 0..WINDOW_MILLIS,
  )

  /**
   * The user goes into the app from its last pause. Returns the updated trail
   * and whether this entry undoes a skipped pause (one re-entry).
   */
  fun onEnter(trail: Trail?): Pair<Trail?, Boolean> =
    if (trail == null || trail.entered) trail to false
    else trail.copy(entered = true) to trail.followsSkip

  fun encode(trail: Trail): String = "${trail.atMillis}|${trail.entered}|${trail.followsSkip}"

  fun decode(value: String?): Trail? {
    val parts = value?.split('|') ?: return null
    if (parts.size != 3) return null
    val at = parts[0].toLongOrNull() ?: return null
    return Trail(at, parts[1] == "true", parts[2] == "true")
  }
}

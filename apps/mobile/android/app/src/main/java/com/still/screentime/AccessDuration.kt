package com.still.screentime

import java.time.LocalDate
import java.time.ZoneId

/**
 * The window the user chooses after paying for access.
 *
 * Mirror of `ACCESS_DURATION_STEPS` and friends in
 * `packages/contracts/src/domain.ts`, which is the tested source of truth. The
 * scale is deliberately uneven: minutes get most of the slider's travel and the
 * last stop is the rest of the day.
 */
object AccessDuration {
  val STEPS = intArrayOf(
    60, 120, 180, 300, 600, 900, 1_200, 1_800, 2_700, 3_600, 7_200, 10_800,
    14_400, 21_600, 28_800, 43_200, 86_400,
  )

  /**
   * The last stop. Stored as a whole day so it stays inside every existing
   * duration bound, and resolved to the time left until local midnight the
   * moment access is granted.
   */
  const val REST_OF_DAY_SECONDS = 86_400

  /** Where the slider starts before this device has ever chosen a window. */
  const val DEFAULT_SECONDS = 600

  fun isRestOfDay(seconds: Int) = seconds >= REST_OF_DAY_SECONDS

  /**
   * Seconds until the next local midnight, so "the rest of the day" ends with
   * the day. Never shorter than the smallest stop: a minute before midnight
   * still buys a usable minute.
   */
  fun secondsUntilEndOfDay(zone: ZoneId = ZoneId.systemDefault()): Int {
    val now = java.time.ZonedDateTime.now(zone)
    val midnight = LocalDate.now(zone).plusDays(1).atStartOfDay(zone)
    val seconds = java.time.Duration.between(now, midnight).seconds
    return seconds.coerceIn(STEPS.first().toLong(), REST_OF_DAY_SECONDS.toLong()).toInt()
  }

  /** Turns a slider stop into the window actually granted. */
  fun resolve(step: Int, zone: ZoneId = ZoneId.systemDefault()): Int =
    if (isRestOfDay(step)) secondsUntilEndOfDay(zone)
    else step.coerceIn(STEPS.first(), REST_OF_DAY_SECONDS)

  /** The index of the stop closest to [seconds], for seeding the slider. */
  fun nearestIndex(seconds: Int): Int {
    var closest = 0
    for (index in STEPS.indices) {
      if (Math.abs(STEPS[index] - seconds) < Math.abs(STEPS[closest] - seconds)) {
        closest = index
      }
    }
    return closest
  }

  /** Mirror of `formatAccessDuration`. */
  fun label(seconds: Int, spanish: Boolean): String {
    if (isRestOfDay(seconds)) return if (spanish) "Resto del día" else "Rest of day"
    if (seconds >= 3_600) {
      val hours = seconds / 3_600
      val minutes = Math.round((seconds % 3_600) / 60.0).toInt()
      val hoursLabel = if (spanish) {
        "$hours ${if (hours == 1) "hora" else "horas"}"
      } else {
        "$hours ${if (hours == 1) "hour" else "hours"}"
      }
      return if (minutes > 0) "$hoursLabel $minutes min" else hoursLabel
    }
    return "${Math.max(1, Math.round(seconds / 60.0).toInt())} min"
  }
}

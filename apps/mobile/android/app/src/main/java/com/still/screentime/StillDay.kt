package com.still.screentime

import java.time.LocalDate

/**
 * The day Still's counters belong to: the phone's own calendar day, so "today"
 * starts at local midnight (not at UTC midnight, which is 21:00 in Uruguay).
 * Mirrored by `localDay()` in iOS's SharedRestrictionState.
 */
object StillDay {
  fun today(): String = LocalDate.now().toString()

  /** The last [count] local days as `yyyy-MM-dd`, oldest first, ending today. */
  fun lastDays(count: Int): List<String> {
    val today = LocalDate.now()
    return (count - 1 downTo 0).map { today.minusDays(it.toLong()).toString() }
  }
}

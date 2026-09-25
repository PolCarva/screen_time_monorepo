package com.still.screentime

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * Turns the phone's usage events into foreground time per app and local day,
 * plus unlocks and screen-ons (docs/onboarding-v2-plan.md §6.1.1). Pure Kotlin,
 * no Android types, so UsageSessionsTest can pin every rule down.
 *
 * An app is in front from its first activity resuming until its last one
 * pauses; two activities of the same app count once. The screen going off, the
 * lock screen and a shutdown end everything that was open. Time is split at
 * local midnight, and a session still open at the end runs until `now`.
 */
object UsageSessions {
  enum class Kind { RESUMED, PAUSED, SCREEN_ON, SCREEN_OFF, LOCKED, UNLOCKED, SHUTDOWN }

  data class Event(
    val timeMillis: Long,
    val kind: Kind,
    val packageName: String? = null,
    val className: String? = null,
  )

  data class Day(
    val date: LocalDate,
    val appMillis: Map<String, Long>,
    val unlocks: Int,
    val screenOns: Int,
  ) {
    val foregroundMillis: Long get() = appMillis.values.sum()
  }

  fun summarize(
    events: List<Event>,
    days: List<LocalDate>,
    zone: ZoneId,
    nowMillis: Long,
    excluded: (String) -> Boolean,
  ): List<Day> {
    val bounds = days.map { day ->
      day to (day.atStartOfDay(zone).toInstant().toEpochMilli() to
        day.plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli())
    }
    val appMillis = days.associateWith { mutableMapOf<String, Long>() }
    val unlocks = days.associateWith { 0 }.toMutableMap()
    val screenOns = days.associateWith { 0 }.toMutableMap()

    fun dayOf(time: Long): LocalDate =
      Instant.ofEpochMilli(time).atZone(zone).toLocalDate()

    fun addInterval(packageName: String, start: Long, end: Long) {
      if (end <= start || excluded(packageName)) return
      for ((day, range) in bounds) {
        val from = maxOf(start, range.first)
        val to = minOf(end, range.second)
        if (to > from) {
          val totals = appMillis.getValue(day)
          totals[packageName] = (totals[packageName] ?: 0L) + (to - from)
        }
      }
    }

    // Package → (open activities, when the package came to the front).
    val openActivities = mutableMapOf<String, MutableSet<String>>()
    val frontSince = mutableMapOf<String, Long>()

    fun closeAll(time: Long) {
      for ((packageName, since) in frontSince) addInterval(packageName, since, time)
      frontSince.clear()
      openActivities.clear()
    }

    for (event in events.sortedBy { it.timeMillis }) {
      val time = minOf(event.timeMillis, nowMillis)
      when (event.kind) {
        Kind.RESUMED -> {
          val packageName = event.packageName ?: continue
          val activities = openActivities.getOrPut(packageName) { mutableSetOf() }
          if (activities.isEmpty()) frontSince[packageName] = time
          activities.add(event.className ?: packageName)
        }
        Kind.PAUSED -> {
          val packageName = event.packageName ?: continue
          val activities = openActivities[packageName] ?: continue
          activities.remove(event.className ?: packageName)
          if (activities.isEmpty()) {
            frontSince.remove(packageName)?.let { addInterval(packageName, it, time) }
            openActivities.remove(packageName)
          }
        }
        Kind.SCREEN_OFF, Kind.LOCKED, Kind.SHUTDOWN -> closeAll(time)
        Kind.UNLOCKED -> dayOf(time).let { day ->
          if (day in unlocks) unlocks[day] = unlocks.getValue(day) + 1
        }
        Kind.SCREEN_ON -> dayOf(time).let { day ->
          if (day in screenOns) screenOns[day] = screenOns.getValue(day) + 1
        }
      }
    }
    closeAll(nowMillis)

    return days.map { day ->
      Day(
        date = day,
        appMillis = appMillis.getValue(day).toMap(),
        unlocks = unlocks.getValue(day),
        screenOns = screenOns.getValue(day),
      )
    }
  }
}

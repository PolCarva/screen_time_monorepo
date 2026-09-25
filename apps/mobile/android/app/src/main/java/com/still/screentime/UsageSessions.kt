package com.still.screentime

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * Turns the phone's usage events into foreground time per app and local day,
 * plus unlocks and screen-ons (docs/onboarding-v2-plan.md §6.1.1), and into
 * sessions per app (docs/real-savings-estimate-plan.md §2.1). Pure Kotlin, no
 * Android types, so UsageSessionsTest can pin every rule down.
 *
 * An app is in front from its first activity resuming until its last one
 * pauses; two activities of the same app count once. The screen going off, the
 * lock screen and a shutdown end everything that was open. Time is split at
 * local midnight, and a session still open at the end runs until `now`.
 */
object UsageSessions {
  /** Two stretches of one app closer than this are one session (Still's pause, a share sheet). */
  const val MERGE_GAP_MILLIS = 30_000L
  /** Shorter sessions don't count: the open Still's pause cut before "Go back". */
  const val MIN_SESSION_MILLIS = 5_000L

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

  /** One stretch of an app in front, not split at midnight. */
  data class Interval(val packageName: String, val startMillis: Long, val endMillis: Long)

  /**
   * One visit to an app: stretches of it with nothing else in between and gaps
   * under [MERGE_GAP_MILLIS]. `activeMillis` leaves the gaps out.
   */
  data class Session(
    val packageName: String,
    val startMillis: Long,
    val endMillis: Long,
    val activeMillis: Long,
  )

  data class AppStats(val sessions: Int, val medianMillis: Long)

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

    for (interval in intervals(events, nowMillis, excluded)) {
      for ((day, range) in bounds) {
        val from = maxOf(interval.startMillis, range.first)
        val to = minOf(interval.endMillis, range.second)
        if (to > from) {
          val totals = appMillis.getValue(day)
          totals[interval.packageName] = (totals[interval.packageName] ?: 0L) + (to - from)
        }
      }
    }

    for (event in events) {
      val time = minOf(event.timeMillis, nowMillis)
      when (event.kind) {
        Kind.UNLOCKED -> dayOf(time).let { day ->
          if (day in unlocks) unlocks[day] = unlocks.getValue(day) + 1
        }
        Kind.SCREEN_ON -> dayOf(time).let { day ->
          if (day in screenOns) screenOns[day] = screenOns.getValue(day) + 1
        }
        else -> Unit
      }
    }

    return days.map { day ->
      Day(
        date = day,
        appMillis = appMillis.getValue(day).toMap(),
        unlocks = unlocks.getValue(day),
        screenOns = screenOns.getValue(day),
      )
    }
  }

  /** Every stretch an app spent in front, in the order they ended. */
  fun intervals(
    events: List<Event>,
    nowMillis: Long,
    excluded: (String) -> Boolean,
  ): List<Interval> {
    val result = mutableListOf<Interval>()

    fun add(packageName: String, start: Long, end: Long) {
      if (end > start && !excluded(packageName)) result += Interval(packageName, start, end)
    }

    // Package → (open activities, when the package came to the front).
    val openActivities = mutableMapOf<String, MutableSet<String>>()
    val frontSince = mutableMapOf<String, Long>()

    fun closeAll(time: Long) {
      for ((packageName, since) in frontSince) add(packageName, since, time)
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
            frontSince.remove(packageName)?.let { add(packageName, it, time) }
            openActivities.remove(packageName)
          }
        }
        Kind.SCREEN_OFF, Kind.LOCKED, Kind.SHUTDOWN -> closeAll(time)
        Kind.UNLOCKED, Kind.SCREEN_ON -> Unit
      }
    }
    closeAll(nowMillis)
    return result
  }

  /**
   * Visits per app (docs/real-savings-estimate-plan.md §2.1): stretches of one
   * app with no other app in between and less than [MERGE_GAP_MILLIS] apart are
   * one session; sessions under [MIN_SESSION_MILLIS] are dropped. Excluded
   * packages (Still's own pause among them) never break a session.
   */
  fun sessions(
    events: List<Event>,
    nowMillis: Long,
    excluded: (String) -> Boolean,
  ): List<Session> {
    val result = mutableListOf<Session>()
    var current: Session? = null
    for (interval in intervals(events, nowMillis, excluded).sortedBy { it.startMillis }) {
      val open = current
      current = if (
        open != null &&
        open.packageName == interval.packageName &&
        interval.startMillis - open.endMillis < MERGE_GAP_MILLIS
      ) {
        open.copy(
          endMillis = maxOf(open.endMillis, interval.endMillis),
          activeMillis = open.activeMillis + (interval.endMillis - interval.startMillis),
        )
      } else {
        open?.let { result += it }
        Session(
          interval.packageName,
          interval.startMillis,
          interval.endMillis,
          interval.endMillis - interval.startMillis,
        )
      }
    }
    current?.let { result += it }
    return result.filter { it.activeMillis >= MIN_SESSION_MILLIS }
  }

  /** Sessions and their median per app, counting sessions that start on `days`. */
  fun appStats(
    sessions: List<Session>,
    days: Collection<LocalDate>,
    zone: ZoneId,
  ): Map<String, AppStats> {
    val wanted = days.toSet()
    return sessions
      .filter { Instant.ofEpochMilli(it.startMillis).atZone(zone).toLocalDate() in wanted }
      .groupBy { it.packageName }
      .mapValues { (_, visits) ->
        AppStats(visits.size, median(visits.map { it.activeMillis }))
      }
  }

  fun median(values: List<Long>): Long {
    if (values.isEmpty()) return 0L
    val sorted = values.sorted()
    val middle = sorted.size / 2
    return if (sorted.size % 2 == 1) sorted[middle]
    else (sorted[middle - 1] + sorted[middle]) / 2
  }
}

package com.still.screentime

import com.still.screentime.UsageSessions.Event
import com.still.screentime.UsageSessions.Kind
import java.time.LocalDate
import java.time.ZoneId
import org.junit.Assert.assertEquals
import org.junit.Test

class UsageSessionsTest {
  private val zone: ZoneId = ZoneId.of("America/Montevideo")
  private val day1: LocalDate = LocalDate.of(2026, 9, 22)
  private val day2: LocalDate = LocalDate.of(2026, 9, 23)
  private val days = listOf(day1, day2)
  private val none: (String) -> Boolean = { false }

  private fun at(day: LocalDate, hour: Int, minute: Int = 0): Long =
    day.atTime(hour, minute).atZone(zone).toInstant().toEpochMilli()

  private fun minutes(millis: Long?) = (millis ?: 0L) / 60_000

  @Test
  fun countsTimeBetweenResumeAndPause() {
    val result = UsageSessions.summarize(
      listOf(
        Event(at(day1, 10), Kind.RESUMED, "app.a", "Main"),
        Event(at(day1, 10, 30), Kind.PAUSED, "app.a", "Main"),
      ),
      days, zone, at(day2, 23), none,
    )
    assertEquals(30, minutes(result[0].appMillis["app.a"]))
    assertEquals(30, minutes(result[0].foregroundMillis))
    assertEquals(0, minutes(result[1].foregroundMillis))
  }

  @Test
  fun countsTwoActivitiesOfOneAppOnce() {
    val result = UsageSessions.summarize(
      listOf(
        Event(at(day1, 9), Kind.RESUMED, "app.a", "Feed"),
        Event(at(day1, 9, 10), Kind.RESUMED, "app.a", "Story"),
        Event(at(day1, 9, 11), Kind.PAUSED, "app.a", "Feed"),
        Event(at(day1, 9, 20), Kind.PAUSED, "app.a", "Story"),
      ),
      days, zone, at(day2, 23), none,
    )
    assertEquals(20, minutes(result[0].appMillis["app.a"]))
  }

  @Test
  fun splitsASessionAtLocalMidnight() {
    val result = UsageSessions.summarize(
      listOf(
        Event(at(day1, 23, 40), Kind.RESUMED, "app.a", "Main"),
        Event(at(day2, 0, 15), Kind.PAUSED, "app.a", "Main"),
      ),
      days, zone, at(day2, 23), none,
    )
    assertEquals(20, minutes(result[0].appMillis["app.a"]))
    assertEquals(15, minutes(result[1].appMillis["app.a"]))
  }

  @Test
  fun screenOffEndsWhatWasOpen() {
    val result = UsageSessions.summarize(
      listOf(
        Event(at(day1, 12), Kind.RESUMED, "app.a", "Main"),
        Event(at(day1, 12, 5), Kind.SCREEN_OFF),
        // The pause Android writes after the screen went off adds nothing.
        Event(at(day1, 14), Kind.PAUSED, "app.a", "Main"),
      ),
      days, zone, at(day2, 23), none,
    )
    assertEquals(5, minutes(result[0].appMillis["app.a"]))
  }

  @Test
  fun anOpenSessionRunsUntilNow() {
    val result = UsageSessions.summarize(
      listOf(Event(at(day2, 8), Kind.RESUMED, "app.a", "Main")),
      days, zone, at(day2, 8, 45), none,
    )
    assertEquals(45, minutes(result[1].appMillis["app.a"]))
  }

  @Test
  fun leavesOutExcludedPackages() {
    val result = UsageSessions.summarize(
      listOf(
        Event(at(day1, 8), Kind.RESUMED, "launcher", "Home"),
        Event(at(day1, 8, 30), Kind.PAUSED, "launcher", "Home"),
        Event(at(day1, 8, 30), Kind.RESUMED, "app.a", "Main"),
        Event(at(day1, 8, 40), Kind.PAUSED, "app.a", "Main"),
      ),
      days, zone, at(day2, 23), { it == "launcher" },
    )
    assertEquals(null, result[0].appMillis["launcher"])
    assertEquals(10, minutes(result[0].foregroundMillis))
  }

  @Test
  fun countsUnlocksAndScreenOnsPerDay() {
    val result = UsageSessions.summarize(
      listOf(
        Event(at(day1, 7), Kind.SCREEN_ON),
        Event(at(day1, 7), Kind.UNLOCKED),
        Event(at(day1, 13), Kind.SCREEN_ON),
        Event(at(day1, 13), Kind.UNLOCKED),
        Event(at(day2, 9), Kind.SCREEN_ON),
      ),
      days, zone, at(day2, 23), none,
    )
    assertEquals(2, result[0].unlocks)
    assertEquals(2, result[0].screenOns)
    assertEquals(0, result[1].unlocks)
    assertEquals(1, result[1].screenOns)
  }

  @Test
  fun ignoresEventsOutsideTheDays() {
    val before = LocalDate.of(2026, 9, 21)
    val result = UsageSessions.summarize(
      listOf(
        Event(at(before, 10), Kind.UNLOCKED),
        Event(at(before, 23, 50), Kind.RESUMED, "app.a", "Main"),
        Event(at(day1, 0, 10), Kind.PAUSED, "app.a", "Main"),
      ),
      days, zone, at(day2, 23), none,
    )
    assertEquals(10, minutes(result[0].appMillis["app.a"]))
    assertEquals(0, result[0].unlocks)
  }

  private fun seconds(day: LocalDate, hour: Int, minute: Int, second: Int): Long =
    day.atTime(hour, minute, second).atZone(zone).toInstant().toEpochMilli()

  @Test
  fun dropsTheOpenThePauseCutBeforeGoBack() {
    val sessions = UsageSessions.sessions(
      listOf(
        Event(seconds(day1, 10, 0, 0), Kind.RESUMED, "app.a", "Main"),
        // Still's pause covers the app half a second later; the user goes back.
        Event(seconds(day1, 10, 0, 0) + 500, Kind.PAUSED, "app.a", "Main"),
        Event(seconds(day1, 10, 0, 0) + 500, Kind.RESUMED, "still", "Pause"),
        Event(seconds(day1, 10, 0, 4), Kind.PAUSED, "still", "Pause"),
      ),
      at(day2, 23), { it == "still" },
    )
    assertEquals(emptyList<UsageSessions.Session>(), sessions)
  }

  @Test
  fun joinsTheCutOpenAndTheVisitAfterThePause() {
    val start = seconds(day1, 10, 0, 0)
    val sessions = UsageSessions.sessions(
      listOf(
        Event(start, Kind.RESUMED, "app.a", "Main"),
        Event(start + 500, Kind.PAUSED, "app.a", "Main"),
        Event(start + 500, Kind.RESUMED, "still", "Pause"),
        Event(start + 20_000, Kind.PAUSED, "still", "Pause"),
        Event(start + 20_000, Kind.RESUMED, "app.a", "Main"),
        Event(start + 20_000 + 6 * 60_000, Kind.PAUSED, "app.a", "Main"),
      ),
      at(day2, 23), { it == "still" },
    )
    assertEquals(1, sessions.size)
    // The 19.5 s of the pause in between are not time in the app.
    assertEquals(6 * 60_000L + 500, sessions[0].activeMillis)
  }

  @Test
  fun aLongerGapStartsANewSession() {
    val start = seconds(day1, 10, 0, 0)
    val sessions = UsageSessions.sessions(
      listOf(
        Event(start, Kind.RESUMED, "app.a", "Main"),
        Event(start + 60_000, Kind.PAUSED, "app.a", "Main"),
        Event(start + 100_000, Kind.RESUMED, "app.a", "Main"),
        Event(start + 160_000, Kind.PAUSED, "app.a", "Main"),
      ),
      at(day2, 23), none,
    )
    assertEquals(listOf(60_000L, 60_000L), sessions.map { it.activeMillis })
  }

  @Test
  fun anotherAppInBetweenStartsANewSession() {
    val start = seconds(day1, 10, 0, 0)
    val sessions = UsageSessions.sessions(
      listOf(
        Event(start, Kind.RESUMED, "app.a", "Main"),
        Event(start + 60_000, Kind.PAUSED, "app.a", "Main"),
        Event(start + 60_000, Kind.RESUMED, "app.b", "Main"),
        Event(start + 70_000, Kind.PAUSED, "app.b", "Main"),
        Event(start + 70_000, Kind.RESUMED, "app.a", "Main"),
        Event(start + 130_000, Kind.PAUSED, "app.a", "Main"),
      ),
      at(day2, 23), none,
    )
    assertEquals(listOf("app.a", "app.b", "app.a"), sessions.map { it.packageName })
  }

  @Test
  fun screenOffEndsASession() {
    val sessions = UsageSessions.sessions(
      listOf(
        Event(at(day1, 12), Kind.RESUMED, "app.a", "Main"),
        Event(at(day1, 12, 5), Kind.SCREEN_OFF),
        Event(at(day1, 14), Kind.PAUSED, "app.a", "Main"),
      ),
      at(day2, 23), none,
    )
    assertEquals(listOf(5 * 60_000L), sessions.map { it.activeMillis })
  }

  @Test
  fun aSessionAcrossMidnightCountsOnTheDayItStarted() {
    val sessions = UsageSessions.sessions(
      listOf(
        Event(at(day1, 23, 50), Kind.RESUMED, "app.a", "Main"),
        Event(at(day2, 0, 10), Kind.PAUSED, "app.a", "Main"),
      ),
      at(day2, 23), none,
    )
    assertEquals(1, UsageSessions.appStats(sessions, listOf(day1), zone)["app.a"]?.sessions)
    assertEquals(null, UsageSessions.appStats(sessions, listOf(day2), zone)["app.a"])
    assertEquals(20 * 60_000L, sessions[0].activeMillis)
  }

  @Test
  fun takesTheMedianNotTheMean() {
    fun visit(hour: Int, minutes: Int) = listOf(
      Event(at(day1, hour), Kind.RESUMED, "app.a", "Main"),
      Event(at(day1, hour, minutes), Kind.PAUSED, "app.a", "Main"),
    )
    val odd = UsageSessions.sessions(visit(8, 2) + visit(9, 4) + visit(10, 50), at(day2, 23), none)
    assertEquals(4 * 60_000L, UsageSessions.appStats(odd, days, zone)["app.a"]?.medianMillis)
    val even = UsageSessions.sessions(
      visit(8, 2) + visit(9, 4) + visit(10, 6) + visit(11, 50), at(day2, 23), none,
    )
    val stats = UsageSessions.appStats(even, days, zone)["app.a"]
    assertEquals(4, stats?.sessions)
    assertEquals(5 * 60_000L, stats?.medianMillis)
  }
}

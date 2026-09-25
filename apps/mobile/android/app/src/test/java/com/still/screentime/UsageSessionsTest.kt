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
}

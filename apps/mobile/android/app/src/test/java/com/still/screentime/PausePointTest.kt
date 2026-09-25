package com.still.screentime

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PausePointTest {
  private val grace = 75L

  @Test
  fun timeAwayFromTheShieldDoesNotCount() {
    // Left with 12 s to go; back 40 s later: still 12 s, not 0.
    val point = PausePoint(boot = 3, savedAtMillis = 1_000, secondsLeft = 12)
    assertEquals(12, point.secondsLeftAt(3, 41_000, grace))
  }

  @Test
  fun aFinishedPauseStaysFinished() {
    val point = PausePoint(boot = 3, savedAtMillis = 1_000, secondsLeft = 0)
    assertEquals(0, point.secondsLeftAt(3, 20_000, grace))
  }

  @Test
  fun tooLongAwayStartsOver() {
    val point = PausePoint(boot = 3, savedAtMillis = 1_000, secondsLeft = 5)
    assertNull(point.secondsLeftAt(3, 1_000 + 76_000, grace))
  }

  @Test
  fun anotherBootOrABackwardClockStartsOver() {
    val point = PausePoint(boot = 3, savedAtMillis = 50_000, secondsLeft = 5)
    assertNull(point.secondsLeftAt(4, 51_000, grace))
    assertNull(point.secondsLeftAt(3, 49_000, grace))
  }

  @Test
  fun roundTripsAndDropsOlderFormats() {
    val point = PausePoint(boot = 7, savedAtMillis = 123_456, secondsLeft = 9)
    assertEquals(point, PausePoint.decode(point.encode()))
    // The older "boot:startedAt" form never shortens a pause: it is dropped.
    assertNull(PausePoint.decode("7:123456"))
    assertNull(PausePoint.decode("7:123456:-1"))
    assertNull(PausePoint.decode("x:1:2"))
    assertNull(PausePoint.decode(null))
  }
}

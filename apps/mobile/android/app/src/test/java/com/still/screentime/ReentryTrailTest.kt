package com.still.screentime

import com.still.screentime.ReentryTrail.Trail
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ReentryTrailTest {
  private val minute = 60_000L

  @Test
  fun aFirstPauseFollowsNothing() {
    assertEquals(Trail(0, entered = false, followsSkip = false), ReentryTrail.onPause(null, 0))
  }

  @Test
  fun goingBackThenInWithinTenMinutesIsOneReentry() {
    val skipped = ReentryTrail.onPause(null, 0)
    val again = ReentryTrail.onPause(skipped, 9 * minute)
    val (entered, reentry) = ReentryTrail.onEnter(again)
    assertEquals(true, reentry)
    assertEquals(true, entered?.entered)
  }

  @Test
  fun afterTenMinutesTheSkipStands() {
    val skipped = ReentryTrail.onPause(null, 0)
    val later = ReentryTrail.onPause(skipped, 11 * minute)
    assertEquals(false, ReentryTrail.onEnter(later).second)
  }

  @Test
  fun aPauseAfterAnEntryFollowsNoSkip() {
    val (entered, _) = ReentryTrail.onEnter(ReentryTrail.onPause(null, 0))
    val next = ReentryTrail.onPause(entered, 2 * minute)
    assertEquals(false, ReentryTrail.onEnter(next).second)
  }

  @Test
  fun enteringTwiceCountsOnce() {
    val again = ReentryTrail.onPause(ReentryTrail.onPause(null, 0), minute)
    val (first, reentry) = ReentryTrail.onEnter(again)
    assertEquals(true, reentry)
    assertEquals(false, ReentryTrail.onEnter(first).second)
  }

  @Test
  fun twoSkipsThenInIsOneReentry() {
    val first = ReentryTrail.onPause(null, 0)
    val second = ReentryTrail.onPause(first, 3 * minute)
    val third = ReentryTrail.onPause(second, 6 * minute)
    assertEquals(true, ReentryTrail.onEnter(third).second)
  }

  @Test
  fun survivesEncoding() {
    val trail = Trail(1_727_000_000_000, entered = true, followsSkip = true)
    assertEquals(trail, ReentryTrail.decode(ReentryTrail.encode(trail)))
    assertNull(ReentryTrail.decode(null))
    assertNull(ReentryTrail.decode("garbage"))
  }
}

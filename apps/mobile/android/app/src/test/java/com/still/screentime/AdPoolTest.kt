package com.still.screentime

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AdPoolTest {
  private val minute = 60_000L
  private val now = 10 * 60 * minute

  private fun ad(id: String, ageMinutes: Long) = PooledAd(id, now - ageMinutes * minute)

  private fun ids(pool: List<PooledAd<String>>) = pool.map { it.item }

  @Test
  fun dropsAdsFrom55MinutesAndFromTheFuture() {
    val pool = listOf(ad("young", 10), ad("edge", 55), ad("old", 70), ad("future", -5))
    assertEquals(listOf("young"), ids(AdPool.pruneExpired(pool, now)))
  }

  @Test
  fun showsTheOldestValidAdFirst() {
    val pool = listOf(ad("newer", 5), ad("expired", 60), ad("older", 40))
    assertEquals("older", AdPool.oldest(pool, now)?.item)
    assertNull(AdPool.oldest(listOf(ad("expired", 56)), now))
  }

  @Test
  fun fillsToTwoAndRenewsFrom50Minutes() {
    assertEquals(2, AdPool.slotsToFill(emptyList<PooledAd<String>>(), now))
    assertEquals(1, AdPool.slotsToFill(listOf(ad("a", 1)), now))
    assertEquals(0, AdPool.slotsToFill(listOf(ad("a", 1), ad("b", 49)), now))
    val due = listOf(ad("fresh", 1), ad("due", 50))
    assertEquals(1, AdPool.slotsToFill(due, now))
    // Still usable until its replacement arrives.
    assertEquals("due", AdPool.oldest(due, now)?.item)
  }

  @Test
  fun aNewAdDropsTheOneItRenews() {
    assertEquals(listOf("a", "b"), ids(AdPool.addAndTrim(listOf(ad("a", 3)), ad("b", 0))))
    assertEquals(
      listOf("fresh", "new"),
      ids(AdPool.addAndTrim(listOf(ad("fresh", 20), ad("due", 51)), ad("new", 0))),
    )
  }

  @Test
  fun nextRenewalIsTheEarliest50MinuteMark() {
    assertEquals(
      now - 30 * minute + AdPool.REFRESH_AFTER_MS,
      AdPool.nextRefreshAt(listOf(ad("a", 10), ad("b", 30))),
    )
    assertNull(AdPool.nextRefreshAt(emptyList<PooledAd<String>>()))
  }

  @Test
  fun retriesAfter30Seconds1_2_5ThenEvery10Minutes() {
    assertEquals(
      listOf(0L, 30_000L, minute, 2 * minute, 5 * minute, 10 * minute, 10 * minute),
      listOf(0, 1, 2, 3, 4, 5, 9).map(AdPool::retryDelayMs),
    )
  }

  @Test
  fun aTriggerWaits30SecondsAfterTheLastAttempt() {
    assertTrue(AdPool.triggerMayBypassBackoff(null, now))
    assertFalse(AdPool.triggerMayBypassBackoff(now - 29_999, now))
    assertTrue(AdPool.triggerMayBypassBackoff(now - 30_000, now))
  }

  @Test
  fun aShorterDebugLifetimeKeepsTheRenewalRatio() {
    assertEquals(AdPool.REFRESH_AFTER_MS, AdPool.refreshAfterFor(AdPool.TTL_MS))
    assertEquals(109_090L, AdPool.refreshAfterFor(120_000L))
  }
}

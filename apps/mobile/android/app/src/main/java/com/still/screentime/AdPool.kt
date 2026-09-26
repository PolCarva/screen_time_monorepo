package com.still.screentime

/** A loaded ad and when its load finished (`elapsedRealtime`). */
data class PooledAd<T>(val item: T, val loadedAt: Long)

/**
 * The rewarded ads kept ready for the shield (docs/ad-preload-plan.md, P1–P5):
 * two at a time, each renewed after 50 min and never offered past 55, when
 * the SDK would expire it, and a failed load retried on a growing delay.
 * Mirror of `src/lib/ad-pool.ts`. Pure Kotlin so AdPoolTest pins it down.
 */
object AdPool {
  const val SIZE = 2
  const val TTL_MS = 55 * 60 * 1_000L
  const val REFRESH_AFTER_MS = 50 * 60 * 1_000L
  const val TRIGGER_MIN_GAP_MS = 30_000L
  private val RETRY_DELAYS_MS = longArrayOf(30_000L, 60_000L, 120_000L, 300_000L, 600_000L)

  /** The renewal age that goes with a [ttlMs]: the same 50/55 ratio. */
  fun refreshAfterFor(ttlMs: Long): Long =
    if (ttlMs == TTL_MS) REFRESH_AFTER_MS else ttlMs * 10 / 11

  /** Drop what the SDK may have expired, and anything loaded "in the future". */
  fun <T> pruneExpired(pool: List<PooledAd<T>>, now: Long, ttlMs: Long = TTL_MS): List<PooledAd<T>> =
    pool.filter { now - it.loadedAt in 0 until ttlMs }

  /** The ad to show: the oldest still valid, so fewer expire unseen. */
  fun <T> oldest(pool: List<PooledAd<T>>, now: Long, ttlMs: Long = TTL_MS): PooledAd<T>? =
    pruneExpired(pool, now, ttlMs).minByOrNull { it.loadedAt }

  /**
   * How many loads the pool still wants. An ad due for renewal does not count,
   * but it stays usable until its replacement arrives.
   */
  fun <T> slotsToFill(
    pool: List<PooledAd<T>>,
    now: Long,
    size: Int = SIZE,
    refreshAfterMs: Long = REFRESH_AFTER_MS,
  ): Int = maxOf(0, size - pool.count { now - it.loadedAt in 0 until refreshAfterMs })

  /** Add a freshly loaded ad and drop the oldest past [size]: the one it renews. */
  fun <T> addAndTrim(pool: List<PooledAd<T>>, ad: PooledAd<T>, size: Int = SIZE): List<PooledAd<T>> {
    val sorted = (pool + ad).sortedBy { it.loadedAt }
    return sorted.drop(maxOf(0, sorted.size - size))
  }

  /** When the next ad becomes due for renewal, or null with nothing to renew. */
  fun <T> nextRefreshAt(pool: List<PooledAd<T>>, refreshAfterMs: Long = REFRESH_AFTER_MS): Long? =
    pool.minOfOrNull { it.loadedAt + refreshAfterMs }

  /** How long to wait after [failures] failed loads in a row (0: no wait). */
  fun retryDelayMs(failures: Int): Long =
    if (failures <= 0) 0L else RETRY_DELAYS_MS[minOf(failures, RETRY_DELAYS_MS.size) - 1]

  /** A trigger may start a load during a retry wait only 30 s after the last attempt. */
  fun triggerMayBypassBackoff(lastAttemptAt: Long?, now: Long, minGapMs: Long = TRIGGER_MIN_GAP_MS): Boolean =
    lastAttemptAt == null || now - lastAttemptAt >= minGapMs
}

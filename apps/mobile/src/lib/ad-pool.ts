/**
 * The rewarded ads kept ready for the pause (docs/ad-preload-plan.md, P1–P5).
 * Two are held so a pause right after another still finds one; each is
 * renewed after 50 min and never offered past 55, when AdMob would expire it.
 * A failed load is retried on a growing delay.
 *
 * Pure and React-Native-free so it can be unit tested. Android keeps the same
 * rules in `AdPool.kt`.
 */
export type PooledAd<T> = {
  item: T;
  /** When the load finished (ms). */
  loadedAt: number;
};

/** Ads held at once (P1). */
export const AD_POOL_SIZE = 2;
/** Dropped at this age: AdMob expires a loaded ad after about an hour (P2). */
export const AD_TTL_MS = 55 * 60_000;
/** Replaced from this age on, one at a time, while it still works (P2). */
export const AD_REFRESH_AFTER_MS = 50 * 60_000;
/** How long the pause waits for an ad before it breathes instead (P5). */
export const AD_GATE_WAIT_MS = 3_000;
/** Delays before retrying after 1, 2, 3… failed loads in a row (P4). */
export const AD_RETRY_DELAYS_MS = [
  30_000, 60_000, 120_000, 300_000, 600_000,
] as const;
/** A trigger (foreground, pause) skips the retry delay only past this (P4). */
export const AD_TRIGGER_MIN_GAP_MS = 30_000;

function ageOf(ad: PooledAd<unknown>, now: number): number {
  return now - ad.loadedAt;
}

/** Drop what AdMob may have expired, and anything a clock change made odd. */
export function pruneExpired<T>(
  pool: readonly PooledAd<T>[],
  now: number,
  ttlMs = AD_TTL_MS,
): PooledAd<T>[] {
  return pool.filter((ad) => {
    const age = ageOf(ad, now);
    return age >= 0 && age < ttlMs;
  });
}

/** The ad to show: the oldest one still valid, so fewer expire unseen. */
export function takeOldest<T>(
  pool: readonly PooledAd<T>[],
  now: number,
  ttlMs = AD_TTL_MS,
): { taken: PooledAd<T> | null; rest: PooledAd<T>[] } {
  const valid = pruneExpired(pool, now, ttlMs).sort(
    (a, b) => a.loadedAt - b.loadedAt,
  );
  const [taken = null, ...rest] = valid;
  return { taken, rest };
}

/**
 * How many loads the pool still wants. An ad due for renewal does not count,
 * but it stays usable until its replacement arrives.
 */
export function slotsToFill(
  pool: readonly PooledAd<unknown>[],
  now: number,
  size = AD_POOL_SIZE,
  refreshAfterMs = AD_REFRESH_AFTER_MS,
): number {
  const fresh = pool.filter((ad) => {
    const age = ageOf(ad, now);
    return age >= 0 && age < refreshAfterMs;
  }).length;
  return Math.max(0, size - fresh);
}

/**
 * Add a freshly loaded ad and drop the oldest past the pool size: the one it
 * renews. The dropped ones are returned so their intents can be reused.
 */
export function addAndTrim<T>(
  pool: readonly PooledAd<T>[],
  ad: PooledAd<T>,
  size = AD_POOL_SIZE,
): { pool: PooledAd<T>[]; dropped: PooledAd<T>[] } {
  const sorted = [...pool, ad].sort((a, b) => a.loadedAt - b.loadedAt);
  const excess = Math.max(0, sorted.length - size);
  return { pool: sorted.slice(excess), dropped: sorted.slice(0, excess) };
}

/** When the next ad becomes due for renewal, or null with nothing to renew. */
export function nextRefreshAt(
  pool: readonly PooledAd<unknown>[],
  refreshAfterMs = AD_REFRESH_AFTER_MS,
): number | null {
  if (pool.length === 0) return null;
  return Math.min(...pool.map((ad) => ad.loadedAt + refreshAfterMs));
}

/** How long to wait after `failures` failed loads in a row (0: no wait). */
export function retryDelayMs(failures: number): number {
  if (failures <= 0) return 0;
  const index = Math.min(failures, AD_RETRY_DELAYS_MS.length) - 1;
  return AD_RETRY_DELAYS_MS[index]!;
}

/**
 * Whether a trigger may start a load while a retry is still waiting: only
 * when the last attempt is at least `minGapMs` old.
 */
export function triggerMayBypassBackoff(
  lastAttemptAt: number | null,
  now: number,
  minGapMs = AD_TRIGGER_MIN_GAP_MS,
): boolean {
  return lastAttemptAt === null || now - lastAttemptAt >= minGapMs;
}

/**
 * What the pause offers: the ad when one is ready; "preparing" while one is on
 * its way and the pause has waited less than `waitMs`; otherwise nothing, and
 * the user breathes.
 */
export function gateOffer(input: {
  ready: boolean;
  loading: boolean;
  waitedMs: number;
  waitMs?: number;
}): "ready" | "preparing" | "none" {
  if (input.ready) return "ready";
  if (input.loading && input.waitedMs < (input.waitMs ?? AD_GATE_WAIT_MS))
    return "preparing";
  return "none";
}

import { describe, expect, it } from "vitest";

import {
  AD_GATE_WAIT_MS,
  AD_REFRESH_AFTER_MS,
  AD_TTL_MS,
  addAndTrim,
  gateOffer,
  nextRefreshAt,
  pruneExpired,
  retryDelayMs,
  slotsToFill,
  takeOldest,
  triggerMayBypassBackoff,
  type PooledAd,
} from "./ad-pool";

const minute = 60_000;
const now = 10 * 60 * minute;
const ad = (id: string, ageMinutes: number): PooledAd<string> => ({
  item: id,
  loadedAt: now - ageMinutes * minute,
});
const ids = (pool: readonly PooledAd<string>[]) => pool.map((it) => it.item);

describe("pruneExpired", () => {
  it("keeps ads younger than 55 min and drops the rest", () => {
    expect(
      ids(pruneExpired([ad("young", 10), ad("edge", 55), ad("old", 70)], now)),
    ).toEqual(["young"]);
  });

  it("drops an ad loaded in the future, after the clock went back", () => {
    expect(ids(pruneExpired([ad("future", -5)], now))).toEqual([]);
  });
});

describe("takeOldest", () => {
  it("shows the oldest valid ad first, so fewer expire unseen", () => {
    const { taken, rest } = takeOldest(
      [ad("newer", 5), ad("expired", 60), ad("older", 40)],
      now,
    );
    expect(taken?.item).toBe("older");
    expect(ids(rest)).toEqual(["newer"]);
  });

  it("returns nothing from an empty or expired pool", () => {
    expect(takeOldest([ad("expired", 56)], now)).toEqual({
      taken: null,
      rest: [],
    });
  });
});

describe("slotsToFill", () => {
  it("fills an empty pool to two", () => {
    expect(slotsToFill([], now)).toBe(2);
  });

  it("wants one more with one fresh ad, none with two", () => {
    expect(slotsToFill([ad("a", 1)], now)).toBe(1);
    expect(slotsToFill([ad("a", 1), ad("b", 49)], now)).toBe(0);
  });

  it("renews an ad from 50 min on while it stays usable", () => {
    const pool = [ad("fresh", 1), ad("due", 50)];
    expect(slotsToFill(pool, now)).toBe(1);
    expect(takeOldest(pool, now).taken?.item).toBe("due");
  });
});

describe("addAndTrim", () => {
  it("keeps adding up to the pool size", () => {
    const result = addAndTrim([ad("a", 3)], ad("b", 0));
    expect(ids(result.pool)).toEqual(["a", "b"]);
    expect(result.dropped).toEqual([]);
  });

  it("drops the ad the new one renews", () => {
    const result = addAndTrim([ad("fresh", 20), ad("due", 51)], ad("new", 0));
    expect(ids(result.pool)).toEqual(["fresh", "new"]);
    expect(ids(result.dropped)).toEqual(["due"]);
  });
});

describe("nextRefreshAt", () => {
  it("is the earliest ad's 50 min mark", () => {
    expect(nextRefreshAt([ad("a", 10), ad("b", 30)])).toBe(
      now - 30 * minute + AD_REFRESH_AFTER_MS,
    );
  });

  it("is null with nothing to renew", () => {
    expect(nextRefreshAt([])).toBeNull();
  });

  it("renews before the ad expires", () => {
    expect(AD_REFRESH_AFTER_MS).toBeLessThan(AD_TTL_MS);
  });
});

describe("retryDelayMs", () => {
  it("waits 30 s, 1, 2, 5 and then 10 min at most", () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(retryDelayMs)).toEqual([
      0,
      30_000,
      minute,
      2 * minute,
      5 * minute,
      10 * minute,
      10 * minute,
    ]);
  });
});

describe("triggerMayBypassBackoff", () => {
  it("lets a trigger load when nothing was tried yet", () => {
    expect(triggerMayBypassBackoff(null, now)).toBe(true);
  });

  it("holds a trigger for 30 s after the last attempt", () => {
    expect(triggerMayBypassBackoff(now - 29_999, now)).toBe(false);
    expect(triggerMayBypassBackoff(now - 30_000, now)).toBe(true);
  });
});

describe("gateOffer", () => {
  it("offers a ready ad at once", () => {
    expect(gateOffer({ ready: true, loading: false, waitedMs: 0 })).toBe(
      "ready",
    );
  });

  it("waits for a load in flight for 3 s, then breathes", () => {
    expect(gateOffer({ ready: false, loading: true, waitedMs: 2_999 })).toBe(
      "preparing",
    );
    expect(
      gateOffer({ ready: false, loading: true, waitedMs: AD_GATE_WAIT_MS }),
    ).toBe("none");
  });

  it("breathes at once with nothing on its way", () => {
    expect(gateOffer({ ready: false, loading: false, waitedMs: 0 })).toBe(
      "none",
    );
  });
});

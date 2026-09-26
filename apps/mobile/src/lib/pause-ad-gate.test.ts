import { describe, expect, it } from "vitest";

import { pauseAdGateEventsFromShield } from "./pause-ad-gate";

describe("pauseAdGateEventsFromShield", () => {
  it("turns what the shield recorded into Android events, in order", () => {
    expect(
      pauseAdGateEventsFromShield([
        { ad: "ready", offered: "ready", waitedMs: 0 },
        { ad: "preparing", offered: "none", waitedMs: 3_004.4 },
        { ad: "none", offered: "none", waitedMs: 0 },
      ]),
    ).toEqual([
      { platform: "android", ad: "ready", offered: "ready", waitedMs: 0 },
      {
        platform: "android",
        ad: "preparing",
        offered: "none",
        waitedMs: 3_004,
      },
      { platform: "android", ad: "none", offered: "none", waitedMs: 0 },
    ]);
  });

  it("drops malformed entries", () => {
    expect(
      pauseAdGateEventsFromShield([
        null,
        "ready",
        { ad: "loading", offered: "ready", waitedMs: 0 },
        { ad: "ready", offered: "preparing", waitedMs: 0 },
        { ad: "ready", offered: "ready", waitedMs: Number.NaN },
        { ad: "ready", offered: "ready" },
      ]),
    ).toEqual([]);
  });

  it("keeps waits between 0 and a minute", () => {
    expect(
      pauseAdGateEventsFromShield([
        { ad: "preparing", offered: "ready", waitedMs: -5 },
        { ad: "preparing", offered: "ready", waitedMs: 9_999_999 },
      ]).map((event) => event.waitedMs),
    ).toEqual([0, 60_000]);
  });
});

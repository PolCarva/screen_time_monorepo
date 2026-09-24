import { describe, expect, it } from "vitest";

import {
  isDefinitiveUnlockRefusal,
  mergePendingUnlockEvents,
  splitReportableUnlocks,
  unlockReportBody,
} from "./offline-policy";

const visit = (id: string, rewardIntentId?: string) => ({
  clientSessionId: id,
  source: "rewarded" as const,
  durationSeconds: 600,
  startedAt: "2026-08-23T12:00:00.000Z",
  ...(rewardIntentId ? { rewardIntentId } : {}),
});

describe("offline visit reports", () => {
  it("deduplicates native and JavaScript outboxes by session id", () => {
    expect(mergePendingUnlockEvents([visit("event-1")], [visit("event-1")])).toEqual([
      visit("event-1"),
    ]);
  });

  it("names the ad that paid for the visit", () => {
    expect(unlockReportBody(visit("event-1", "intent-1"), "device-1")).toEqual({
      clientSessionId: "event-1",
      source: "rewarded",
      durationSeconds: 600,
      startedAt: "2026-08-23T12:00:00.000Z",
      deviceId: "device-1",
      appCategory: "other",
      rewardIntentId: "intent-1",
    });
  });

  it("sends no ad for a visit that has none, so the server can refuse it", () => {
    expect(unlockReportBody(visit("event-1"), "device-1")).not.toHaveProperty(
      "rewardIntentId",
    );
  });
});

describe("reporting visits paid by a fresh ad", () => {
  it("holds a visit until the ad that paid for it is claimed", () => {
    const events = [visit("older"), visit("fresh", "intent-1"), visit("claimed", "intent-2")];
    expect(splitReportableUnlocks(events, new Set(["intent-1"]))).toEqual({
      now: [visit("older"), visit("claimed", "intent-2")],
      later: [visit("fresh", "intent-1")],
    });
  });

  it("drops refusals no retry can fix and keeps the rest", () => {
    expect(isDefinitiveUnlockRefusal("invalid_unlock_source")).toBe(true);
    expect(isDefinitiveUnlockRefusal("insufficient_balance")).toBe(true);
    expect(isDefinitiveUnlockRefusal("request_timeout")).toBe(false);
    expect(isDefinitiveUnlockRefusal("restrictions_disabled")).toBe(false);
    expect(isDefinitiveUnlockRefusal(undefined)).toBe(false);
  });
});

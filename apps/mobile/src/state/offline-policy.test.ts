import type { Wallet } from "@screen-time/contracts";
import { describe, expect, it } from "vitest";

import {
  addProvisionalReward,
  isDefinitiveUnlockRefusal,
  mergePendingUnlockEvents,
  projectPendingUnlocks,
  spendLocalWallet,
  splitReportableUnlocks,
} from "./offline-policy";

const wallet: Wallet = {
  rewardedBalance: 2,
  rewardedPassesRemainingToday: 2,
  unresolvedRewardClaims: 0,
  rewardAdsRemainingToday: 8,
  resetAt: "2026-08-24T00:00:00.000Z",
};

const visit = (id: string, rewardIntentId?: string) => ({
  clientSessionId: id,
  source: "rewarded" as const,
  durationSeconds: 600,
  startedAt: "2026-08-23T12:00:00.000Z",
  ...(rewardIntentId ? { rewardIntentId } : {}),
});

describe("offline wallet policy", () => {
  it("caps provisional rewards while tracking reconciliation", () => {
    expect(addProvisionalReward(wallet, 2)).toMatchObject({
      rewardedBalance: 2,
      unresolvedRewardClaims: 1,
    });
  });

  it("spends a pass and today's allowance together", () => {
    expect(spendLocalWallet(wallet)).toMatchObject({
      rewardedBalance: 1,
      rewardedPassesRemainingToday: 1,
    });
  });

  it("does not permit an offline daily pass-limit overdraft", () => {
    expect(() =>
      spendLocalWallet({ ...wallet, rewardedPassesRemainingToday: 0 }),
    ).toThrow("daily_pass_limit_reached");
  });

  it("does not spend a pass that is not there", () => {
    expect(() => spendLocalWallet({ ...wallet, rewardedBalance: 0 })).toThrow(
      "insufficient_rewarded_balance",
    );
  });

  it("deduplicates native and JavaScript outboxes by session id", () => {
    expect(mergePendingUnlockEvents([visit("event-1")], [visit("event-1")])).toEqual([
      visit("event-1"),
    ]);
  });

  it("projects unreported native spends over a fresh server wallet", () => {
    expect(projectPendingUnlocks(wallet, [visit("event-1")])).toMatchObject({
      rewardedBalance: 1,
    });
    expect(
      projectPendingUnlocks({ ...wallet, rewardedBalance: 0 }, [visit("event-1")]),
    ).toMatchObject({ rewardedBalance: 0 });
  });
});

describe("reporting visits paid by a fresh ad", () => {
  it("holds a visit until the ad that paid for it is claimed", () => {
    const events = [visit("saved"), visit("fresh", "intent-1"), visit("claimed", "intent-2")];
    expect(splitReportableUnlocks(events, new Set(["intent-1"]))).toEqual({
      now: [visit("saved"), visit("claimed", "intent-2")],
      later: [visit("fresh", "intent-1")],
    });
  });

  it("drops refusals no retry can fix and keeps the rest", () => {
    expect(isDefinitiveUnlockRefusal("invalid_unlock_source")).toBe(true);
    expect(isDefinitiveUnlockRefusal("insufficient_balance")).toBe(true);
    expect(isDefinitiveUnlockRefusal("daily_pass_limit")).toBe(true);
    expect(isDefinitiveUnlockRefusal("request_timeout")).toBe(false);
    expect(isDefinitiveUnlockRefusal("restrictions_disabled")).toBe(false);
    expect(isDefinitiveUnlockRefusal(undefined)).toBe(false);
  });
});

import type { Wallet } from "@screen-time/contracts";
import { describe, expect, it } from "vitest";

import {
  addProvisionalReward,
  mergePendingUnlockEvents,
  projectPendingUnlocks,
  spendLocalWallet,
} from "./offline-policy";

const wallet: Wallet = {
  rewardedBalance: 2,
  rewardedPassesRemainingToday: 2,
  emergencyRemaining: 3,
  unresolvedRewardClaims: 0,
  rewardAdsRemainingToday: 8,
  resetAt: "2026-08-24T00:00:00.000Z",
};

describe("offline wallet policy", () => {
  it("caps provisional rewards while tracking reconciliation", () => {
    expect(addProvisionalReward(wallet, 2)).toMatchObject({
      rewardedBalance: 2,
      unresolvedRewardClaims: 1,
    });
  });

  it("spends emergency and rewarded balances independently", () => {
    expect(spendLocalWallet(wallet, "rewarded").rewardedBalance).toBe(1);
    expect(
      spendLocalWallet(wallet, "rewarded").rewardedPassesRemainingToday,
    ).toBe(1);
    expect(spendLocalWallet(wallet, "emergency").emergencyRemaining).toBe(2);
  });

  it("does not permit an offline daily pass-limit overdraft", () => {
    expect(() =>
      spendLocalWallet(
        { ...wallet, rewardedPassesRemainingToday: 0 },
        "rewarded",
      ),
    ).toThrow("daily_pass_limit_reached");
  });

  it("does not permit an offline emergency overdraft", () => {
    expect(() =>
      spendLocalWallet({ ...wallet, emergencyRemaining: 0 }, "emergency"),
    ).toThrow("daily_emergency_limit_reached");
  });

  it("deduplicates native and JavaScript outboxes by session id", () => {
    const event = {
      clientSessionId: "event-1",
      source: "emergency" as const,
      durationSeconds: 600,
      startedAt: "2026-08-23T12:00:00.000Z",
    };
    expect(mergePendingUnlockEvents([event], [event])).toEqual([event]);
  });

  it("projects unreported native spends over a fresh server wallet", () => {
    expect(
      projectPendingUnlocks(wallet, [
        {
          clientSessionId: "event-1",
          source: "rewarded",
          durationSeconds: 600,
          startedAt: "2026-08-23T12:00:00.000Z",
        },
      ]),
    ).toMatchObject({ rewardedBalance: 1, emergencyRemaining: 3 });
  });
});

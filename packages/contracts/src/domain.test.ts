import { describe, expect, it } from "vitest";

import {
  calculateImpactFundMinor,
  canRequestReward,
  estimateMinutesAvoided,
  formatUnlockDuration,
  transitionRestriction,
  transitionReward,
} from "./domain";
import { defaultRemoteConfig, remoteConfigSchema } from "./schemas";

describe("restriction state machine", () => {
  it("runs the intentional unlock path", () => {
    let state = transitionRestriction("restricted", {
      type: "APP_OPEN_ATTEMPT",
    });
    state = transitionRestriction(state, { type: "REQUEST_UNLOCK" });
    state = transitionRestriction(state, { type: "UNLOCK_GRANTED" });
    expect(transitionRestriction(state, { type: "SESSION_EXPIRED" })).toBe(
      "restricted",
    );
  });

  it("rejects an impossible transition", () => {
    expect(() =>
      transitionRestriction("restricted", { type: "UNLOCK_GRANTED" }),
    ).toThrow("Invalid restriction transition");
  });
});

describe("reward state machine", () => {
  it("moves a client reward through SSV verification", () => {
    let state = transitionReward("intent", "AD_READY");
    state = transitionReward(state, "AD_STARTED");
    state = transitionReward(state, "CLIENT_EARNED");
    expect(transitionReward(state, "SSV_VERIFIED")).toBe("verified");
  });
});

describe("wallet rules", () => {
  const operationalConfig = {
    ...defaultRemoteConfig,
    version: 1,
    dailyEmergencyUnlocks: 3,
    maxRewardedAdsPerUtcDay: 10,
    maxRewardTokenBalance: 3,
    impactPercentage: 80,
    platformPercentage: 20,
    estimatedMinutesPerAvoidedOpen: 2,
    rewardProvider: "admob" as const,
    votingEnabled: true,
    iosRestrictionEnabled: true,
    androidRestrictionEnabled: true,
    publishedAt: "2026-08-24T00:00:00.000Z",
  };
  const wallet = {
    rewardedBalance: 2,
    rewardedPassesRemainingToday: 2,
    emergencyRemaining: 3,
    unresolvedRewardClaims: 0,
    rewardAdsRemainingToday: 8,
    resetAt: "2026-08-24T00:00:00.000Z",
  };

  it("allows a reward below the balance cap", () => {
    expect(canRequestReward(wallet, operationalConfig)).toBe(true);
  });

  it("blocks a reward at the balance cap", () => {
    expect(
      canRequestReward({ ...wallet, rewardedBalance: 3 }, operationalConfig),
    ).toBe(false);
  });

  it("allows another ad while earlier rewards are awaiting verification", () => {
    expect(
      canRequestReward(
        { ...wallet, unresolvedRewardClaims: 3 },
        operationalConfig,
      ),
    ).toBe(true);
  });

  it("honors the operational reward switch", () => {
    expect(
      canRequestReward(wallet, {
        ...operationalConfig,
        rewardProvider: "disabled",
      }),
    ).toBe(false);
  });

  it("fails closed before a production policy has been published", () => {
    expect(canRequestReward(wallet, defaultRemoteConfig)).toBe(false);
  });

  it("rejects an unimplemented reward provider", () => {
    expect(
      remoteConfigSchema.safeParse({
        ...operationalConfig,
        rewardProvider: "house",
      }).success,
    ).toBe(false);
  });
});

describe("unlock duration formatting", () => {
  it("formats the supported minute, hour, and all-day choices", () => {
    expect(formatUnlockDuration(600, "es")).toBe("10 min");
    expect(formatUnlockDuration(3_600, "en")).toBe("1 hour");
    expect(formatUnlockDuration(86_400, "es")).toBe("Todo el día");
  });
});

describe("impact calculations", () => {
  it("uses integer minor units and rounds down", () => {
    expect(calculateImpactFundMinor(2_421, 80)).toBe(1_936);
  });

  it("labels avoided time as a simple estimate", () => {
    expect(estimateMinutesAvoided(13, 2)).toBe(26);
  });
});

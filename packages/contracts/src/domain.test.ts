import { describe, expect, it } from "vitest";

import {
  calculateImpactFundMinor,
  canRequestReward,
  estimateMinutesAvoided,
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
  const wallet = {
    rewardedBalance: 2,
    emergencyRemaining: 3,
    unresolvedRewardClaims: 0,
    rewardAdsRemainingToday: 8,
    resetAt: "2026-08-24T00:00:00.000Z",
  };

  it("allows a reward below the balance cap", () => {
    expect(canRequestReward(wallet, defaultRemoteConfig)).toBe(true);
  });

  it("blocks a reward at the balance cap", () => {
    expect(
      canRequestReward({ ...wallet, rewardedBalance: 3 }, defaultRemoteConfig),
    ).toBe(false);
  });

  it("allows another ad while earlier rewards are awaiting verification", () => {
    expect(
      canRequestReward(
        { ...wallet, unresolvedRewardClaims: 3 },
        defaultRemoteConfig,
      ),
    ).toBe(true);
  });

  it("honors the operational reward switch", () => {
    expect(
      canRequestReward(wallet, {
        ...defaultRemoteConfig,
        rewardProvider: "disabled",
      }),
    ).toBe(false);
  });

  it("rejects an unimplemented reward provider", () => {
    expect(
      remoteConfigSchema.safeParse({
        ...defaultRemoteConfig,
        rewardProvider: "house",
      }).success,
    ).toBe(false);
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

import { describe, expect, it } from "vitest";

import {
  ACCESS_DURATION_STEPS,
  DEFAULT_ACCESS_DURATION_SECONDS,
  REST_OF_DAY_SECONDS,
  calculateImpactFundMinor,
  canRequestReward,
  estimateMinutesAvoided,
  formatAccessDuration,
  nearestAccessDurationStep,
  resolveAccessDurationSeconds,
  secondsUntilEndOfDay,
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

describe("impact calculations", () => {
  it("uses integer minor units and rounds down", () => {
    expect(calculateImpactFundMinor(2_421, 80)).toBe(1_936);
  });

  it("labels avoided time as a simple estimate", () => {
    expect(estimateMinutesAvoided(13, 2)).toBe(26);
  });
});

describe("access duration slider", () => {
  it("offers stops from one minute to the rest of the day, in order", () => {
    expect(ACCESS_DURATION_STEPS[0]).toBe(60);
    expect(ACCESS_DURATION_STEPS.at(-1)).toBe(REST_OF_DAY_SECONDS);
    expect(ACCESS_DURATION_STEPS).toContain(DEFAULT_ACCESS_DURATION_SECONDS);
    const sorted = [...ACCESS_DURATION_STEPS].sort((a, b) => a - b);
    expect([...ACCESS_DURATION_STEPS]).toEqual(sorted);
    expect(new Set(ACCESS_DURATION_STEPS).size).toBe(
      ACCESS_DURATION_STEPS.length,
    );
  });

  it("resolves the last stop to the time left until local midnight", () => {
    const evening = new Date(2026, 8, 22, 22, 30, 0);
    expect(resolveAccessDurationSeconds(REST_OF_DAY_SECONDS, evening)).toBe(
      90 * 60,
    );
    expect(secondsUntilEndOfDay(new Date(2026, 8, 22, 0, 0, 0))).toBe(86_400);
  });

  it("never resolves the rest of the day to less than the shortest stop", () => {
    const almostMidnight = new Date(2026, 8, 22, 23, 59, 50);
    expect(
      resolveAccessDurationSeconds(REST_OF_DAY_SECONDS, almostMidnight),
    ).toBe(60);
  });

  it("keeps every other stop exactly as chosen", () => {
    for (const step of ACCESS_DURATION_STEPS.slice(0, -1)) {
      expect(resolveAccessDurationSeconds(step)).toBe(step);
    }
  });

  it("clamps a duration that arrived from outside the slider", () => {
    expect(resolveAccessDurationSeconds(10)).toBe(60);
    expect(resolveAccessDurationSeconds(999_999)).toBe(
      secondsUntilEndOfDay(),
    );
  });

  it("seeds the slider from the nearest stop", () => {
    expect(nearestAccessDurationStep(0)).toBe(60);
    expect(nearestAccessDurationStep(660)).toBe(600);
    expect(nearestAccessDurationStep(100_000)).toBe(REST_OF_DAY_SECONDS);
  });

  it("labels the last stop as the rest of the day, not a whole day", () => {
    expect(formatAccessDuration(60, "es")).toBe("1 min");
    expect(formatAccessDuration(2_700, "en")).toBe("45 min");
    expect(formatAccessDuration(3_600, "es")).toBe("1 hora");
    expect(formatAccessDuration(7_200, "en")).toBe("2 hours");
    expect(formatAccessDuration(5_400, "es")).toBe("1 hora 30 min");
    expect(formatAccessDuration(REST_OF_DAY_SECONDS, "es")).toBe(
      "Resto del día",
    );
    expect(formatAccessDuration(REST_OF_DAY_SECONDS, "en")).toBe("Rest of day");
  });
});

import { describe, expect, it } from "vitest";

import {
  claimRewardRequestSchema,
  createUnlockSessionRequestSchema,
  defaultRemoteConfig,
  impactWeekSchema,
  remoteConfigSchema,
  walletSchema,
  wellbeingSyncSchema,
} from "./schemas";

const published = {
  ...defaultRemoteConfig,
  version: 7,
  publishedAt: "2026-09-20T10:00:00.000Z",
};

describe("remote config: iOS home-on-cancel flag", () => {
  it("ships disabled", () => {
    expect(defaultRemoteConfig.iosHomeOnCancelEnabled).toBe(false);
  });

  it("reads a configuration published before the flag existed as off", () => {
    const { iosHomeOnCancelEnabled: _omitted, ...legacy } = published;
    const parsed = remoteConfigSchema.parse(legacy);
    expect(parsed.iosHomeOnCancelEnabled).toBe(false);
  });

  it("can be switched on remotely and rejects non-boolean values", () => {
    expect(
      remoteConfigSchema.parse({ ...published, iosHomeOnCancelEnabled: true })
        .iosHomeOnCancelEnabled,
    ).toBe(true);
    expect(
      remoteConfigSchema.safeParse({
        ...published,
        iosHomeOnCancelEnabled: "yes",
      }).success,
    ).toBe(false);
  });
});

describe("remote config: impact estimate and removed emergency access", () => {
  it("reads a configuration without an eCPM as the 3 USD default", () => {
    const { estimatedRewardedEcpmUsd: _omitted, ...legacy } = published;
    expect(remoteConfigSchema.parse(legacy).estimatedRewardedEcpmUsd).toBe(3);
  });

  it("ignores the emergency allowance older configurations still carry", () => {
    const parsed = remoteConfigSchema.parse({
      ...published,
      dailyEmergencyUnlocks: 3,
    });
    expect(parsed).not.toHaveProperty("dailyEmergencyUnlocks");
  });

  it("only accepts passes as a paid way in", () => {
    const unlock = {
      clientSessionId: "8a5116a1-f1a8-46fa-9bdf-1ade3f5b8a1e",
      deviceId: "8a5116a1-f1a8-46fa-9bdf-1ade3f5b8a1f",
      durationSeconds: 600,
      startedAt: "2026-09-23T10:00:00.000Z",
    };
    expect(
      createUnlockSessionRequestSchema.safeParse({ ...unlock, source: "rewarded" })
        .success,
    ).toBe(true);
    expect(
      createUnlockSessionRequestSchema.safeParse({ ...unlock, source: "emergency" })
        .success,
    ).toBe(false);
  });

  it("drops the emergency count from the wallet", () => {
    const wallet = walletSchema.parse({
      rewardedBalance: 1,
      rewardedPassesRemainingToday: 2,
      emergencyRemaining: 3,
      unresolvedRewardClaims: 0,
      rewardAdsRemainingToday: 5,
      resetAt: "2026-09-24T00:00:00.000Z",
    });
    expect(wallet).not.toHaveProperty("emergencyRemaining");
  });
});

describe("impact contracts", () => {
  it("accepts the value the SDK reported with a claim, and a claim without it", () => {
    const claim = {
      clientEventId: "8a5116a1-f1a8-46fa-9bdf-1ade3f5b8a1e",
      earnedAt: "2026-09-23T10:00:00.000Z",
    };
    expect(claimRewardRequestSchema.safeParse(claim).success).toBe(true);
    expect(
      claimRewardRequestSchema.safeParse({
        ...claim,
        adValue: { valueMicros: 4_200, currency: "USD", precision: "precise" },
      }).success,
    ).toBe(true);
    expect(
      claimRewardRequestSchema.safeParse({
        ...claim,
        adValue: { valueMicros: -1, currency: "usd", precision: "exact" },
      }).success,
    ).toBe(false);
  });

  it("bounds the days a device can send at once", () => {
    const day = { date: "2026-09-22", openAttempts: 4, unlocks: 1, avoidedOpens: 3 };
    const sync = {
      deviceId: "8a5116a1-f1a8-46fa-9bdf-1ade3f5b8a1e",
      platform: "android",
    };
    expect(wellbeingSyncSchema.safeParse({ ...sync, days: [day] }).success).toBe(true);
    expect(wellbeingSyncSchema.safeParse({ ...sync, days: [] }).success).toBe(false);
    expect(
      wellbeingSyncSchema.safeParse({ ...sync, days: Array(15).fill(day) }).success,
    ).toBe(false);
  });

  it("reads an impact week from an API without the live fields", () => {
    const week = impactWeekSchema.parse({
      id: "8a5116a1-f1a8-46fa-9bdf-1ade3f5b8a1e",
      weekStart: "2026-09-21",
      weekEnd: "2026-09-27",
      status: "open",
      currency: "USD",
      grossRevenueMinor: 0,
      impactFundMinor: 0,
      impactPercentage: 80,
      isEstimated: true,
      participants: 0,
      rewardedAds: 0,
      candidates: [],
      donationProofUrl: null,
    });
    expect(week.people).toBe(0);
    expect(week.allTime).toEqual({
      people: 0,
      minutesReturned: 0,
      rewardedAds: 0,
      donatedMinor: 0,
    });
  });
});

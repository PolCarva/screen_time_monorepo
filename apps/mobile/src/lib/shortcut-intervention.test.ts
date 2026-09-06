import { describe, expect, it } from "vitest";

import { getInterventionUnlockAction } from "./shortcut-intervention";

const base = {
  supportsDirectAd: true,
  hasDevice: true,
  rewardProvider: "admob" as const,
  rewardStatus: "ready" as const,
  rewardAdsRemainingToday: 3,
  rewardedPassesRemainingToday: 4,
  rewardedBalance: 1,
  maxRewardTokenBalance: 5,
  emergencyRemaining: 1,
};

describe("direct intervention unlock action", () => {
  it("offers the prepared ad directly on iOS Shortcuts or Android", () => {
    expect(getInterventionUnlockAction(base)).toBe("watch_ad");
  });

  it("waits for an eligible ad to finish preparing", () => {
    expect(
      getInterventionUnlockAction({ ...base, rewardStatus: "preparing" }),
    ).toBe("preparing_ad");
  });

  it("falls back to an existing pass when the ad is unavailable", () => {
    expect(
      getInterventionUnlockAction({ ...base, rewardStatus: "unavailable" }),
    ).toBe("use_rewarded_pass");
  });

  it("falls back to Emergency Access when rewards cannot be used", () => {
    expect(
      getInterventionUnlockAction({
        ...base,
        rewardStatus: "unavailable",
        rewardedBalance: 0,
      }),
    ).toBe("use_emergency");
  });

  it("offers retry when neither an ad nor an allowance is available", () => {
    expect(
      getInterventionUnlockAction({
        ...base,
        rewardStatus: "unavailable",
        rewardedBalance: 0,
        emergencyRemaining: 0,
      }),
    ).toBe("retry_ad");
  });

  it("does not enable direct ads on an unsupported intervention", () => {
    expect(
      getInterventionUnlockAction({ ...base, supportsDirectAd: false }),
    ).toBeNull();
  });
});

import { defaultRemoteConfig } from "@screen-time/contracts";
import { describe, expect, it } from "vitest";

import { resolveUserPreferences } from "./user-preferences";

const config = {
  ...defaultRemoteConfig,
  maxRewardTokenBalance: 3,
  maxRewardedAdsPerUtcDay: 10,
  unlockDurationSeconds: 600,
};

describe("user preferences", () => {
  it("uses operational defaults before the user saves preferences", () => {
    expect(resolveUserPreferences(config, null)).toMatchObject({
      dailyPassLimit: 3,
      unlockDurationSeconds: 600,
      maxRewardedAdsPerUtcDay: 10,
      updatedAt: null,
    });
  });

  it("keeps the user's ad limit below the operational cap", () => {
    expect(
      resolveUserPreferences(config, {
        daily_pass_limit: 5,
        unlock_duration_seconds: 86_400,
        max_rewarded_ads_per_utc_day: 20,
        updated_at: "2026-09-01T12:00:00.000Z",
      }),
    ).toMatchObject({
      dailyPassLimit: 5,
      unlockDurationSeconds: 86_400,
      maxRewardedAdsPerUtcDay: 10,
    });
  });
});

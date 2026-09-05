import {
  userPreferencesSchema,
  type RemoteConfig,
  type UserPreferences,
} from "@screen-time/contracts";

type StoredPreferences = {
  daily_pass_limit: number;
  unlock_duration_seconds: number;
  max_rewarded_ads_per_utc_day: number;
  updated_at: string;
} | null;

const durationChoices = [600, 1_200, 1_800, 3_600, 86_400] as const;

function closestDuration(value: number): (typeof durationChoices)[number] {
  return durationChoices.reduce((closest, candidate) =>
    Math.abs(candidate - value) < Math.abs(closest - value)
      ? candidate
      : closest,
  );
}

export function resolveUserPreferences(
  config: RemoteConfig,
  stored: StoredPreferences,
): UserPreferences {
  return userPreferencesSchema.parse({
    dailyPassLimit:
      stored?.daily_pass_limit ??
      Math.max(1, Math.min(config.maxRewardTokenBalance, 20)),
    unlockDurationSeconds:
      stored?.unlock_duration_seconds ??
      closestDuration(config.unlockDurationSeconds),
    maxRewardedAdsPerUtcDay: Math.min(
      stored?.max_rewarded_ads_per_utc_day ?? config.maxRewardedAdsPerUtcDay,
      config.maxRewardedAdsPerUtcDay,
    ),
    updatedAt: stored?.updated_at ?? null,
  });
}

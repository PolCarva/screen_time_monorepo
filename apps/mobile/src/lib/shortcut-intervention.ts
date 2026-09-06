export type InterventionRewardStatus =
  "idle" | "preparing" | "ready" | "unavailable";

export type InterventionUnlockAction =
  | "watch_ad"
  | "preparing_ad"
  | "use_rewarded_pass"
  | "use_emergency"
  | "retry_ad";

type InterventionUnlockInput = {
  supportsDirectAd: boolean;
  hasDevice: boolean;
  rewardProvider: "admob" | "disabled";
  rewardStatus: InterventionRewardStatus;
  rewardAdsRemainingToday: number;
  rewardedPassesRemainingToday: number;
  rewardedBalance: number;
  maxRewardTokenBalance: number;
  emergencyRemaining: number;
};

export function getInterventionUnlockAction({
  supportsDirectAd,
  hasDevice,
  rewardProvider,
  rewardStatus,
  rewardAdsRemainingToday,
  rewardedPassesRemainingToday,
  rewardedBalance,
  maxRewardTokenBalance,
  emergencyRemaining,
}: InterventionUnlockInput): InterventionUnlockAction | null {
  if (!supportsDirectAd) return null;

  const directAdEligible =
    hasDevice &&
    rewardProvider === "admob" &&
    rewardAdsRemainingToday > 0 &&
    rewardedPassesRemainingToday > 0 &&
    rewardedBalance < maxRewardTokenBalance;

  if (directAdEligible && rewardStatus === "ready") return "watch_ad";
  if (
    directAdEligible &&
    (rewardStatus === "idle" || rewardStatus === "preparing")
  )
    return "preparing_ad";
  if (rewardedBalance > 0 && rewardedPassesRemainingToday > 0)
    return "use_rewarded_pass";
  if (emergencyRemaining > 0) return "use_emergency";
  return "retry_ad";
}

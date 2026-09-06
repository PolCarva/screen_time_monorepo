export type InterventionRewardStatus =
  "idle" | "preparing" | "ready" | "unavailable";

export type InterventionUnlockAction =
  | "watch_ad"
  | "preparing_ad"
  | "use_rewarded_pass"
  | "use_emergency"
  | "retry_ad";

type ShortcutReturnSession = {
  returnUrl: string;
};

type ShortcutUnlock = (
  contextId: string,
  options?: { freshReward?: boolean },
) => Promise<ShortcutReturnSession>;

type CompleteShortcutAndReturnInput = {
  contextId: string;
  freshReward?: boolean;
  unlockShortcut: ShortcutUnlock;
  onUnlockActivated?: () => void | Promise<void>;
  openUrl: (url: string) => Promise<unknown>;
};

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

export async function completeShortcutAndReturn({
  contextId,
  freshReward = false,
  unlockShortcut,
  onUnlockActivated,
  openUrl,
}: CompleteShortcutAndReturnInput): Promise<ShortcutReturnSession> {
  const session = freshReward
    ? await unlockShortcut(contextId, { freshReward: true })
    : await unlockShortcut(contextId);
  await onUnlockActivated?.();
  await openUrl(session.returnUrl);
  return session;
}

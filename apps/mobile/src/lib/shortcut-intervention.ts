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
  /** Return shortcut to run when `returnUrl` is a URL scheme that fails. */
  fallbackReturnUrl?: string;
};

type ShortcutUnlock = (
  contextId: string,
  options: { freshReward?: boolean; durationSeconds: number },
) => Promise<ShortcutReturnSession>;

type CompleteShortcutAndReturnInput = {
  contextId: string;
  freshReward?: boolean;
  /** The window the user chose on the slider, in seconds. */
  durationSeconds: number;
  unlockShortcut: ShortcutUnlock;
  onUnlockActivated?: () => void | Promise<void>;
  /** The app's URL scheme did not open; called before the fallback is tried. */
  onPrimaryReturnFailed?: () => void | Promise<void>;
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
  durationSeconds,
  unlockShortcut,
  onUnlockActivated,
  onPrimaryReturnFailed,
  openUrl,
}: CompleteShortcutAndReturnInput): Promise<ShortcutReturnSession> {
  const session = await unlockShortcut(contextId, {
    freshReward,
    durationSeconds,
  });
  await onUnlockActivated?.();
  try {
    await openUrl(session.returnUrl);
  } catch (error) {
    // A wrong or uninstalled URL scheme must not strand the user in Still
    // with the allowance already running: fall back to the return shortcut.
    if (!session.fallbackReturnUrl) throw error;
    await onPrimaryReturnFailed?.();
    await openUrl(session.fallbackReturnUrl);
  }
  return session;
}

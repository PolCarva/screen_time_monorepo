import type { InterventionGate } from "./intervention-flow";

export type InterventionRewardStatus =
  "idle" | "preparing" | "ready" | "unavailable";

type ShortcutReturnSession = {
  returnUrl: string;
  /** Return shortcut to run when `returnUrl` is a URL scheme that fails. */
  fallbackReturnUrl?: string;
};

type ShortcutUnlock = (
  contextId: string,
  options: {
    freshReward?: boolean;
    durationSeconds: number;
    rewardIntentId?: string;
  },
) => Promise<ShortcutReturnSession>;

type CompleteShortcutAndReturnInput = {
  contextId: string;
  freshReward?: boolean;
  /** The ad that paid for this visit, so the server spends that ad's pass. */
  rewardIntentId?: string;
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
};

/**
 * What the gate can offer right now. The ad and a saved pass are independent,
 * so a pass is always usable without watching the ad that is ready. Mirrored in
 * `InterventionActivity.currentGate()` on Android.
 */
export function getInterventionOptions({
  supportsDirectAd,
  hasDevice,
  rewardProvider,
  rewardStatus,
  rewardAdsRemainingToday,
  rewardedPassesRemainingToday,
  rewardedBalance,
  maxRewardTokenBalance,
}: InterventionUnlockInput): InterventionGate | null {
  if (!supportsDirectAd) return null;

  const directAdEligible =
    hasDevice &&
    rewardProvider === "admob" &&
    rewardAdsRemainingToday > 0 &&
    rewardedPassesRemainingToday > 0 &&
    rewardedBalance < maxRewardTokenBalance;

  const ad = !directAdEligible
    ? "none"
    : rewardStatus === "ready"
      ? "ready"
      : rewardStatus === "idle" || rewardStatus === "preparing"
        ? "preparing"
        : "none";
  return {
    ad,
    pass: rewardedBalance > 0 && rewardedPassesRemainingToday > 0,
  };
}

export async function completeShortcutAndReturn({
  contextId,
  freshReward = false,
  rewardIntentId,
  durationSeconds,
  unlockShortcut,
  onUnlockActivated,
  onPrimaryReturnFailed,
  openUrl,
}: CompleteShortcutAndReturnInput): Promise<ShortcutReturnSession> {
  const session = await unlockShortcut(contextId, {
    freshReward,
    durationSeconds,
    ...(rewardIntentId ? { rewardIntentId } : {}),
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

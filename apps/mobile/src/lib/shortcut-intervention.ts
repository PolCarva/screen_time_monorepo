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
    durationSeconds: number;
    rewardIntentId?: string;
  },
) => Promise<ShortcutReturnSession>;

type CompleteShortcutAndReturnInput = {
  contextId: string;
  /** The ad that paid for this visit; none after the free pause. */
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
};

/**
 * What the gate can offer right now: the ad, waited for while it loads. There
 * is no limit on ads and no saved pass (docs/ads-only-pause-plan.md, D1-D3).
 * Mirrored in `InterventionActivity.currentGate()` on Android.
 */
export function getInterventionOptions({
  supportsDirectAd,
  hasDevice,
  rewardProvider,
  rewardStatus,
}: InterventionUnlockInput): InterventionGate | null {
  if (!supportsDirectAd) return null;
  if (!hasDevice || rewardProvider !== "admob") return { ad: "none" };
  if (rewardStatus === "ready") return { ad: "ready" };
  if (rewardStatus === "idle" || rewardStatus === "preparing")
    return { ad: "preparing" };
  return { ad: "none" };
}

/**
 * The ad status the gate reads. A pause that opens on a failed attempt (which
 * may be minutes old) asks for a fresh one and treats it as preparing until
 * that attempt starts, so the breathing pause never begins on a stale failure.
 * Once the pause has waited AD_GATE_WAIT_MS (`gateWaitOver`), anything but a
 * ready ad means no ad: the user breathes (docs/ad-preload-plan.md, P5).
 */
export function rewardStatusForGate(
  status: InterventionRewardStatus,
  awaitingFreshAttempt: boolean,
  gateWaitOver = false,
): InterventionRewardStatus {
  if (status === "ready") return status;
  if (gateWaitOver) return "unavailable";
  return awaitingFreshAttempt && status === "unavailable" ? "preparing" : status;
}

export async function completeShortcutAndReturn({
  contextId,
  rewardIntentId,
  durationSeconds,
  unlockShortcut,
  onUnlockActivated,
  onPrimaryReturnFailed,
  openUrl,
}: CompleteShortcutAndReturnInput): Promise<ShortcutReturnSession> {
  const session = await unlockShortcut(contextId, {
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

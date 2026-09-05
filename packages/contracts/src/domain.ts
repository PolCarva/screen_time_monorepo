import type { RemoteConfig, Wallet } from "./schemas";

export type RestrictionState =
  | "restricted"
  | "intervention"
  | "awaiting_unlock"
  | "unlocked";

export type RestrictionEvent =
  | { type: "APP_OPEN_ATTEMPT" }
  | { type: "CANCEL" }
  | { type: "REQUEST_UNLOCK" }
  | { type: "UNLOCK_GRANTED" }
  | { type: "SESSION_EXPIRED" };

export function transitionRestriction(
  state: RestrictionState,
  event: RestrictionEvent,
): RestrictionState {
  const transitions: Record<
    RestrictionState,
    Partial<Record<RestrictionEvent["type"], RestrictionState>>
  > = {
    restricted: { APP_OPEN_ATTEMPT: "intervention" },
    intervention: {
      CANCEL: "restricted",
      REQUEST_UNLOCK: "awaiting_unlock",
    },
    awaiting_unlock: {
      CANCEL: "restricted",
      UNLOCK_GRANTED: "unlocked",
    },
    unlocked: { SESSION_EXPIRED: "restricted" },
  };

  const next = transitions[state][event.type];
  if (!next) {
    throw new Error(`Invalid restriction transition: ${state} -> ${event.type}`);
  }
  return next;
}

export type RewardState =
  | "intent"
  | "ready"
  | "showing"
  | "provisional"
  | "verified"
  | "failed"
  | "rejected";

export type RewardEvent =
  | "AD_READY"
  | "AD_STARTED"
  | "CLIENT_EARNED"
  | "SSV_VERIFIED"
  | "AD_FAILED"
  | "SSV_REJECTED";

export function transitionReward(
  state: RewardState,
  event: RewardEvent,
): RewardState {
  const transitions: Record<
    RewardState,
    Partial<Record<RewardEvent, RewardState>>
  > = {
    intent: { AD_READY: "ready", AD_FAILED: "failed" },
    ready: { AD_STARTED: "showing", AD_FAILED: "failed" },
    showing: { CLIENT_EARNED: "provisional", AD_FAILED: "failed" },
    provisional: { SSV_VERIFIED: "verified", SSV_REJECTED: "rejected" },
    verified: {},
    failed: {},
    rejected: {},
  };
  const next = transitions[state][event];
  if (!next) throw new Error(`Invalid reward transition: ${state} -> ${event}`);
  return next;
}

export function canRequestReward(wallet: Wallet, config: RemoteConfig): boolean {
  return (
    wallet.rewardedBalance < config.maxRewardTokenBalance &&
    wallet.rewardAdsRemainingToday > 0 &&
    config.rewardProvider !== "disabled"
  );
}

export function formatUnlockDuration(
  durationSeconds: number,
  locale: "en" | "es",
): string {
  if (durationSeconds >= 86_400) {
    return locale === "es" ? "Todo el día" : "All day";
  }
  if (durationSeconds >= 3_600) {
    const hours = Math.round(durationSeconds / 3_600);
    return locale === "es"
      ? `${hours} ${hours === 1 ? "hora" : "horas"}`
      : `${hours} ${hours === 1 ? "hour" : "hours"}`;
  }
  return `${Math.round(durationSeconds / 60)} min`;
}

export function calculateImpactFundMinor(
  grossRevenueMinor: number,
  impactPercentage: number,
): number {
  if (!Number.isInteger(grossRevenueMinor) || grossRevenueMinor < 0) {
    throw new Error("Gross revenue must be a non-negative integer");
  }
  if (impactPercentage < 0 || impactPercentage > 100) {
    throw new Error("Impact percentage must be between 0 and 100");
  }
  return Math.floor((grossRevenueMinor * impactPercentage) / 100);
}

export function estimateMinutesAvoided(
  avoidedOpens: number,
  minutesPerAvoid: number,
): number {
  return Math.round(avoidedOpens * minutesPerAvoid * 10) / 10;
}

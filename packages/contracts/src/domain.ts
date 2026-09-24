import type { RemoteConfig } from "./schemas";

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

/**
 * Whether the pause may offer an ad. There is no limit on ads and no wallet to
 * fill (docs/ads-only-pause-plan.md, D3-D5): only the operational switch.
 */
export function canRequestReward(
  config: Pick<RemoteConfig, "rewardProvider">,
): boolean {
  return config.rewardProvider === "admob";
}

/**
 * Stops of the slider the user drags after paying for access, in seconds. The
 * scale is deliberately uneven: minutes matter most, so they get most of the
 * travel, and the last stop is the rest of the day.
 *
 * Mirrored natively in `InterventionActivity.kt` (ACCESS_DURATION_STEPS) and
 * `ShortcutInterventionState.swift`; this list is the source of truth.
 */
export const ACCESS_DURATION_STEPS = [
  60, 120, 180, 300, 600, 900, 1_200, 1_800, 2_700, 3_600, 7_200, 10_800,
  14_400, 21_600, 28_800, 43_200, 86_400,
] as const;

/**
 * The last stop. Stored as a whole day so it stays inside every existing
 * duration bound, and resolved to the time left until local midnight the
 * moment access is granted.
 */
export const REST_OF_DAY_SECONDS = 86_400;

/** Where the slider starts before the user has ever dragged it. */
export const DEFAULT_ACCESS_DURATION_SECONDS = 600;

export function isRestOfDay(durationSeconds: number): boolean {
  return durationSeconds >= REST_OF_DAY_SECONDS;
}

/**
 * Seconds from `now` to the next local midnight, so "the rest of the day" ends
 * with the day rather than 24 hours later. Never shorter than the smallest
 * stop: a minute before midnight still buys a usable minute.
 */
export function secondsUntilEndOfDay(now: Date = new Date()): number {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const seconds = Math.ceil((midnight.getTime() - now.getTime()) / 1_000);
  return Math.max(ACCESS_DURATION_STEPS[0], Math.min(seconds, REST_OF_DAY_SECONDS));
}

/** Turns a slider stop into the window actually granted. */
export function resolveAccessDurationSeconds(
  step: number,
  now: Date = new Date(),
): number {
  if (isRestOfDay(step)) return secondsUntilEndOfDay(now);
  return Math.max(
    ACCESS_DURATION_STEPS[0],
    Math.min(Math.round(step), REST_OF_DAY_SECONDS),
  );
}

/** The stop closest to `durationSeconds`, for seeding the slider. */
export function nearestAccessDurationStep(durationSeconds: number): number {
  return ACCESS_DURATION_STEPS.reduce((closest, step) =>
    Math.abs(step - durationSeconds) < Math.abs(closest - durationSeconds)
      ? step
      : closest,
  );
}

/**
 * Label for a slider stop. The last stop is named for what it is — the rest of
 * today, not a 24-hour block.
 */
export function formatAccessDuration(
  durationSeconds: number,
  locale: "en" | "es",
): string {
  if (isRestOfDay(durationSeconds)) {
    return locale === "es" ? "Resto del día" : "Rest of day";
  }
  if (durationSeconds >= 3_600) {
    const hours = Math.floor(durationSeconds / 3_600);
    const minutes = Math.round((durationSeconds % 3_600) / 60);
    const hoursLabel =
      locale === "es"
        ? `${hours} ${hours === 1 ? "hora" : "horas"}`
        : `${hours} ${hours === 1 ? "hour" : "hours"}`;
    return minutes > 0 ? `${hoursLabel} ${minutes} min` : hoursLabel;
  }
  return `${Math.max(1, Math.round(durationSeconds / 60))} min`;
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

/** Micros (millionths of a unit) to minor units (cents), to the nearest cent. */
export function microsToMinor(micros: number): number {
  return Math.round(Math.max(0, micros) / 10_000);
}

/**
 * The fund's share of a gross measured in micros, floored to the cent so the
 * fund is never overstated (the same rule as the stored weekly column).
 */
export function impactFundMinorFromMicros(
  grossMicros: number,
  impactPercentage: number,
): number {
  if (impactPercentage < 0 || impactPercentage > 100) {
    throw new Error("Impact percentage must be between 0 and 100");
  }
  return Math.floor((Math.max(0, grossMicros) * impactPercentage) / 100 / 10_000);
}

/**
 * Cents while the fund is under 100 units, so a young fund never reads as
 * zero; whole units after that, where cents are only noise.
 */
export function impactAmountFractionDigits(minor: number): 0 | 2 {
  return Math.abs(minor) < 10_000 ? 2 : 0;
}

/** Minutes below an hour, hours with one decimal after that. */
export function returnedTimeParts(minutes: number): {
  value: number;
  unit: "min" | "h";
} {
  const safe = Math.max(0, minutes);
  const wholeMinutes = Math.round(safe);
  if (wholeMinutes < 60) return { value: wholeMinutes, unit: "min" };
  return { value: Math.round((safe / 60) * 10) / 10, unit: "h" };
}

export function estimateMinutesAvoided(
  avoidedOpens: number,
  minutesPerAvoid: number,
): number {
  return Math.round(avoidedOpens * minutesPerAvoid * 10) / 10;
}

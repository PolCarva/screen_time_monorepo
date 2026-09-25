import { z } from "zod";

import {
  DEFAULT_GUESS_MINUTES,
  MAX_GUESS_MINUTES,
  nearestGuessStep,
} from "./onboarding-insights";

/**
 * Which onboarding steps apply, in which order, and when each one may move on
 * (docs/onboarding-v2-plan.md §2, §4, §5). One pure definition shared by the
 * onboarding, the `/setup` route and Today's "finish setting up" card, so the
 * three never disagree about what is left.
 */

export type FlowPlatform = "ios" | "android";

export const STORY_STEPS = [
  "guess",
  "usage-permission",
  "reveal",
  "life",
  "where",
  "habit",
  "pause-demo",
  "how",
] as const;
export type StoryStepId = (typeof STORY_STEPS)[number];

export const SETUP_STEPS = [
  "adult",
  "ads-consent",
  "accessibility",
  "apps",
  "keep-alive",
  "live-test",
  "shortcuts",
  "app-tests",
  "notices",
  "pauses-off",
  "done",
] as const;
export type SetupStepId = (typeof SETUP_STEPS)[number];

export type OnboardingStepId = StoryStepId | SetupStepId;

/** Every step in canonical order, to resume at the nearest one that still applies. */
const CANONICAL: readonly OnboardingStepId[] = [...STORY_STEPS, ...SETUP_STEPS];

export type UsageSource = "android-usage" | "ios-screen-time" | "none";
export type AdsConsentState = "required" | "not-required" | "unknown";

export type FlowContext = {
  platform: FlowPlatform;
  /** The remote kill switch for this platform. */
  pausesEnabled: boolean;
  /** Where real usage can come from on this build and config (D1). */
  usageSource: UsageSource;
  /** The user granted usage access (the reveal only exists after that). */
  usageGranted: boolean;
  adsConsent: AdsConsentState;
  /** Android makers that kill background apps (lib/android-oem). */
  aggressiveOem: boolean;
};

export function storySteps(context: FlowContext): StoryStepId[] {
  const steps: StoryStepId[] = ["guess"];
  if (context.usageSource !== "none") steps.push("usage-permission");
  if (context.usageSource !== "none" && context.usageGranted) {
    steps.push("reveal");
  }
  steps.push("life", "where", "habit", "pause-demo", "how");
  return steps;
}

export function setupSteps(context: FlowContext): SetupStepId[] {
  if (!context.pausesEnabled) return ["adult", "pauses-off"];
  const steps: SetupStepId[] = ["adult"];
  if (context.adsConsent !== "not-required") steps.push("ads-consent");
  if (context.platform === "android") {
    steps.push("accessibility", "apps");
    if (context.aggressiveOem) steps.push("keep-alive");
    steps.push("live-test");
  } else {
    steps.push("apps", "shortcuts", "app-tests", "notices");
  }
  steps.push("done");
  return steps;
}

export function onboardingSteps(context: FlowContext): OnboardingStepId[] {
  return [...storySteps(context), ...setupSteps(context)];
}

export function isStoryStep(step: OnboardingStepId): step is StoryStepId {
  return (STORY_STEPS as readonly string[]).includes(step);
}

export function isSetupStep(step: OnboardingStepId): step is SetupStepId {
  return (SETUP_STEPS as readonly string[]).includes(step);
}

export function nextStep(
  context: FlowContext,
  step: OnboardingStepId,
): OnboardingStepId | null {
  const steps = onboardingSteps(context);
  const index = steps.indexOf(resolveStep(context, step));
  return index >= 0 && index < steps.length - 1 ? steps[index + 1]! : null;
}

export function previousStep(
  context: FlowContext,
  step: OnboardingStepId,
): OnboardingStepId | null {
  const steps = onboardingSteps(context);
  const index = steps.indexOf(resolveStep(context, step));
  return index > 0 ? steps[index - 1]! : null;
}

/** Where "Skip" lands: the first setup step. */
export function firstSetupStep(context: FlowContext): SetupStepId {
  return setupSteps(context)[0]!;
}

/**
 * The step itself when it still applies; otherwise the first applicable step
 * after it in canonical order (a context change can remove a step, e.g. ads
 * consent turns out not to be required).
 */
export function resolveStep(
  context: FlowContext,
  step: OnboardingStepId,
): OnboardingStepId {
  const steps = onboardingSteps(context);
  if (steps.includes(step)) return step;
  const position = CANONICAL.indexOf(step);
  return (
    steps.find((candidate) => CANONICAL.indexOf(candidate) > position) ??
    steps[steps.length - 1]!
  );
}

/** Position for the continuous progress bar, 0 on the first step, 1 on the last. */
export function stepProgress(
  context: FlowContext,
  step: OnboardingStepId,
): number {
  const steps = onboardingSteps(context);
  const index = steps.indexOf(resolveStep(context, step));
  return steps.length <= 1 ? 1 : Math.max(0, index) / (steps.length - 1);
}

/** What the setup steps can check on this phone right now (§5.1). */
export type SetupSignals = {
  adultConfirmed: boolean;
  adsConsentResolved: boolean;
  accessibilityEnabled: boolean;
  accessibilityRunning: boolean;
  /** Apps chosen in Still (Android selection, iOS targets). */
  selectedApps: number;
  batteryUnrestricted: boolean;
  /** Autostart / pop-ups on makers with no API: the user's own check. */
  keepAliveConfirmed: boolean;
  /** Android: the pause showed in test mode during this setup. */
  liveTestVerified: boolean;
  /** iOS: chosen apps whose automation fired during this setup. */
  appTests: { total: number; verified: number };
  /** iOS: the notice permission was asked and answered. */
  noticesDecided: boolean;
};

export type StepRequirement = "signal" | "recommended" | "none";

/** Steps that move on only with their signal, and steps that just advise. */
export function stepRequirement(step: OnboardingStepId): StepRequirement {
  switch (step) {
    case "adult":
    case "ads-consent":
    case "accessibility":
    case "apps":
    case "live-test":
    case "app-tests":
      return "signal";
    case "keep-alive":
    case "notices":
      return "recommended";
    default:
      return "none";
  }
}

/** True once the step's own signal is there; advisory steps are satisfied by it too. */
export function isStepVerified(
  step: OnboardingStepId,
  signals: SetupSignals,
): boolean {
  switch (step) {
    case "adult":
      return signals.adultConfirmed;
    case "ads-consent":
      return signals.adsConsentResolved;
    case "accessibility":
      return signals.accessibilityEnabled && signals.accessibilityRunning;
    case "apps":
      return signals.selectedApps >= 1;
    case "keep-alive":
      return signals.batteryUnrestricted && signals.keepAliveConfirmed;
    case "live-test":
      return signals.liveTestVerified;
    case "app-tests":
      return (
        signals.appTests.total > 0 &&
        signals.appTests.verified >= signals.appTests.total
      );
    case "notices":
      return signals.noticesDecided;
    default:
      return true;
  }
}

/**
 * Whether the primary button may move on. A step with a signal never moves on
 * without it: there is no "I did it" where the phone can tell (D7).
 */
export function canContinue(
  step: OnboardingStepId,
  signals: SetupSignals,
): boolean {
  return stepRequirement(step) === "signal"
    ? isStepVerified(step, signals)
    : true;
}

/** The first setup step whose required signal is missing, or null when all are there. */
export function firstUnverifiedSetupStep(
  context: FlowContext,
  signals: SetupSignals,
): SetupStepId | null {
  return (
    setupSteps(context).find(
      (step) =>
        stepRequirement(step) === "signal" && !isStepVerified(step, signals),
    ) ?? null
  );
}

export type SetupItem = {
  step: SetupStepId;
  requirement: StepRequirement;
  verified: boolean;
};

/** The final summary: every setup step with a signal and whether it holds. */
export function setupSummary(
  context: FlowContext,
  signals: SetupSignals,
): SetupItem[] {
  return setupSteps(context)
    .filter((step) => stepRequirement(step) !== "none")
    .map((step) => ({
      step,
      requirement: stepRequirement(step),
      verified: isStepVerified(step, signals),
    }));
}

/**
 * A setup test (iOS automation fired, Android pause shown): verified once the
 * native side confirms after the test began; failed once Still is back in
 * front and waited long enough; waiting otherwise.
 */
export function probeOutcome(input: {
  startedAt: number;
  /** When the native side last confirmed (fired / shown); null if never. */
  confirmedAt: number | null;
  /** When Still came back to the foreground after the test began. */
  returnedAt: number | null;
  now: number;
  /** Least time since the test began before calling it failed. */
  minFromStartMs: number;
  /** Least time since Still came back before calling it failed. */
  minFromReturnMs: number;
}): "verified" | "waiting" | "failed" {
  const { startedAt, confirmedAt, returnedAt, now } = input;
  if (confirmedAt !== null && confirmedAt >= startedAt - 1_000) {
    return "verified";
  }
  if (
    returnedAt !== null &&
    returnedAt >= startedAt &&
    now >= startedAt + input.minFromStartMs &&
    now >= returnedAt + input.minFromReturnMs
  ) {
    return "failed";
  }
  return "waiting";
}

/**
 * iOS: the chosen apps whose automation fired since `sinceMs`, with when. An
 * app counts during a setup only if it fired during that setup; an old
 * `verifiedAt` proves nothing about today (docs/onboarding-v2-plan.md §4.0).
 * Native timestamps have second precision, hence the one-second allowance.
 */
export function firedSince(
  ids: readonly string[],
  health: Readonly<Record<string, { lastTriggeredAt?: string | null } | undefined>>,
  sinceMs: number,
): Record<string, number> {
  const fired: Record<string, number> = {};
  for (const id of ids) {
    const at = Date.parse(health[id]?.lastTriggeredAt ?? "");
    if (Number.isFinite(at) && at >= sinceMs - 1_000) fired[id] = at;
  }
  return fired;
}

/** What the onboarding remembers between launches (D9). */
const probeSchema = z.object({
  kind: z.enum(["android", "ios", "ios-return"]),
  /** Android package, or the iOS target id. */
  target: z.string().min(1),
  startedAt: z.string(),
  /** When Still came back to the foreground after the test began. */
  returnedAt: z.string().optional(),
});
export type SetupProbe = z.infer<typeof probeSchema>;

const progressSchema = z.object({
  version: z.literal(1),
  step: z.enum(CANONICAL as [OnboardingStepId, ...OnboardingStepId[]]),
  startedAt: z.string(),
  guessMinutes: z.number().int().positive(),
  usage: z.enum(["granted", "skipped", "unasked"]),
  /** Settings was opened for usage access; checked again on every return. */
  usageRequestedAt: z.string().optional(),
  adsConsent: z.enum(["required", "not-required", "unknown"]),
  /** Google's consent form was answered (only when it was required). */
  adsConsentAt: z.string().optional(),
  /** What UMP allows after the answer; false means the timed pause only. */
  adsCanRequest: z.boolean().optional(),
  adultConfirmedAt: z.string().optional(),
  /** Android: the Accessibility prominent disclosure was accepted. */
  accessibilityDisclosureAt: z.string().optional(),
  keepAliveConfirmedAt: z.string().optional(),
  probe: probeSchema.optional(),
  /** iOS: target id → when its automation fired during this setup. */
  verifiedTests: z.record(z.string(), z.string()),
  /** iOS: target id → when its return shortcut was proven. */
  returnTests: z.record(z.string(), z.string()),
  androidTestVerifiedAt: z.string().optional(),
});
export type OnboardingProgress = z.infer<typeof progressSchema>;

export function initialProgress(now: Date): OnboardingProgress {
  return {
    version: 1,
    step: "guess",
    startedAt: now.toISOString(),
    guessMinutes: DEFAULT_GUESS_MINUTES,
    usage: "unasked",
    adsConsent: "unknown",
    verifiedTests: {},
    returnTests: {},
  };
}

/** A stored progress, or null when missing or written by an incompatible build. */
export function parseProgress(raw: unknown): OnboardingProgress | null {
  const parsed = progressSchema.safeParse(raw);
  if (!parsed.success) return null;
  return {
    ...parsed.data,
    guessMinutes: nearestGuessStep(
      Math.min(MAX_GUESS_MINUTES, parsed.data.guessMinutes),
    ),
  };
}

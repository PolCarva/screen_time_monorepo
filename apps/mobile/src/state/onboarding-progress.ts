import {
  initialProgress,
  parseProgress,
  type OnboardingProgress,
} from "@/lib/onboarding-flow";
import { getJson, localStorage, setJson } from "@/lib/storage";

/**
 * Where the onboarding stands between launches (docs/onboarding-v2-plan.md,
 * D9): if Android or iOS kills Still while the user is in Settings or
 * Shortcuts, the next launch resumes at that step and checks it again. The
 * `/setup` route (the same setup, for someone already onboarded) keeps its own.
 */
export type FlowMode = "onboarding" | "setup";

const KEYS: Record<FlowMode, string> = {
  onboarding: "onboardingProgress",
  setup: "setupProgress",
};

export async function loadOnboardingProgress(
  mode: FlowMode = "onboarding",
): Promise<OnboardingProgress> {
  const stored = parseProgress(await getJson<unknown>(KEYS[mode], null));
  if (stored) return stored;
  const fresh = initialProgress(new Date());
  // Someone already onboarded confirmed their age; the setup starts after it.
  return mode === "setup"
    ? { ...fresh, step: "ads-consent", adultConfirmedAt: fresh.startedAt }
    : fresh;
}

export async function saveOnboardingProgress(
  progress: OnboardingProgress,
  mode: FlowMode = "onboarding",
) {
  await setJson(KEYS[mode], progress);
}

/** Once it ends, nothing of the story is kept (the guess included). */
export async function clearOnboardingProgress(mode: FlowMode = "onboarding") {
  await localStorage.removeItem(KEYS[mode]);
}

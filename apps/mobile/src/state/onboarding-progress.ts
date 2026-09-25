import {
  initialProgress,
  parseProgress,
  type OnboardingProgress,
} from "@/lib/onboarding-flow";
import { getJson, localStorage, setJson } from "@/lib/storage";

/**
 * Where the onboarding stands between launches (docs/onboarding-v2-plan.md,
 * D9): if Android or iOS kills Still while the user is in Settings or
 * Shortcuts, the next launch resumes at that step and checks it again.
 */
const KEY = "onboardingProgress";

export async function loadOnboardingProgress(): Promise<OnboardingProgress> {
  const stored = parseProgress(await getJson<unknown>(KEY, null));
  return stored ?? initialProgress(new Date());
}

export async function saveOnboardingProgress(progress: OnboardingProgress) {
  await setJson(KEY, progress);
}

/** Once onboarding ends, nothing of the story is kept (the guess included). */
export async function clearOnboardingProgress() {
  await localStorage.removeItem(KEY);
}

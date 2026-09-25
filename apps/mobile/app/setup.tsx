import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

/**
 * The verified setup without the story, for someone already onboarded: Today's
 * "Finish setting up Still" card and Settings open it (docs/onboarding-v2-plan.md
 * §4.6).
 */
export default function SetupScreen() {
  return <OnboardingFlow mode="setup" />;
}

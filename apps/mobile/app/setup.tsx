import { Redirect } from "expo-router";
import { Platform } from "react-native";

import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

/**
 * The verified setup without the story, for someone already onboarded: Today's
 * "Finish setting up Still" card and Settings open it (docs/onboarding-v2-plan.md
 * §4.6). iOS keeps its Shortcuts screens until its verified steps land (F5).
 */
export default function SetupScreen() {
  if (Platform.OS === "ios") return <Redirect href="/shortcut-setup" />;
  return <OnboardingFlow mode="setup" />;
}

import { Redirect } from "expo-router";

import { useAppState } from "@/state/app-state";

/**
 * Where Still lands, also after a pause: Today once onboarded, else back to
 * the onboarding, which a real pause can interrupt while the user sets up the
 * apps (docs/onboarding-v2-plan.md, D9).
 */
export default function Index() {
  const { ready, onboarded } = useAppState();
  if (!ready) return null;
  return <Redirect href={onboarded ? "/(tabs)/(today)" : "/(onboarding)"} />;
}

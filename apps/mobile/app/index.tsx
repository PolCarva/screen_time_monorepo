import { Redirect } from "expo-router";

import { useAppState } from "@/state/app-state";

export default function Index() {
  const { ready, onboarded } = useAppState();
  if (!ready) return null;
  return <Redirect href={onboarded ? "/(tabs)/(today)" : "/(onboarding)"} />;
}

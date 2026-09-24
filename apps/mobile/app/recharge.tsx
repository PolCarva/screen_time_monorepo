import { Redirect } from "expo-router";

/**
 * Old deep link to recharge a pass. Passes are gone (docs/ads-only-pause-plan.md,
 * D10), so it opens Today.
 */
export default function RechargeRoute() {
  return <Redirect href="/(tabs)/(today)" />;
}

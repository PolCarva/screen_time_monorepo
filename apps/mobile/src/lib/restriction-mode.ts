import type { RemoteConfig } from "@screen-time/contracts";

/**
 * iOS Shortcuts pauses are implemented locally by the App Intent. The legacy
 * iOS flag controls the retired Managed Settings rollout and must not disable
 * this replacement flow. Android keeps its server-side kill switch.
 */
export function isPauseFeatureEnabled(
  platform: string,
  config: Pick<
    RemoteConfig,
    "iosRestrictionEnabled" | "androidRestrictionEnabled"
  >,
) {
  return platform === "ios" ? true : config.androidRestrictionEnabled;
}

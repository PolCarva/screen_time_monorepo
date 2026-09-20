import type { RemoteConfig } from "@screen-time/contracts";

/**
 * Both platforms honor their server-side kill switch. On iOS the flag also
 * reaches the App Intent through the App Group, so switching it off silences
 * the Shortcuts pause without an app release. The database enforces the same
 * flag when an unlock is reported, so a client that ignored it would only
 * produce rejected reports.
 */
export function isPauseFeatureEnabled(
  platform: string,
  config: Pick<
    RemoteConfig,
    "iosRestrictionEnabled" | "androidRestrictionEnabled"
  >,
) {
  return platform === "ios"
    ? config.iosRestrictionEnabled
    : config.androidRestrictionEnabled;
}

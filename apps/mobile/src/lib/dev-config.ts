import type { RemoteConfig } from "@screen-time/contracts";

type DevOverridable = Pick<
  RemoteConfig,
  "iosRestrictionEnabled" | "iosHomeOnCancelEnabled"
>;

export type DevConfigOptions = {
  /** `__DEV__`. Release builds always get the server's configuration untouched. */
  dev: boolean;
  /** `EXPO_PUBLIC_DEV_IOS_PAUSES`; "1" switches the iOS pause on locally. */
  forceIosPauses?: string;
  /** `EXPO_PUBLIC_DEV_IOS_HOME_ON_CANCEL`; "1" switches the Home Screen exit on locally. */
  forceIosHomeOnCancel?: string;
};

/**
 * The iOS pause ships off in production, which would make it impossible to
 * exercise on a simulator or a development device. These switches turn it on
 * for a development build only. They change nothing on the server, so unlock
 * reports are still rejected there while the production flag is off.
 */
export function applyDevConfigOverrides<T extends DevOverridable>(
  config: T,
  options: DevConfigOptions,
): T {
  if (!options.dev) return config;
  return {
    ...config,
    iosRestrictionEnabled:
      options.forceIosPauses === "1" ? true : config.iosRestrictionEnabled,
    iosHomeOnCancelEnabled:
      options.forceIosHomeOnCancel === "1"
        ? true
        : config.iosHomeOnCancelEnabled,
  };
}

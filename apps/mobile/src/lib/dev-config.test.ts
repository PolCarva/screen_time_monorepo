import { defaultRemoteConfig } from "@screen-time/contracts";
import { describe, expect, it } from "vitest";

import { applyDevConfigOverrides } from "./dev-config";

const forced = { forceIosPauses: "1" };

describe("development config overrides", () => {
  it("never touches the configuration of a release build", () => {
    const config = applyDevConfigOverrides(defaultRemoteConfig, {
      dev: false,
      ...forced,
    });
    expect(config).toBe(defaultRemoteConfig);
    expect(config.iosRestrictionEnabled).toBe(false);
  });

  it("switches the iOS pause on in development only when asked", () => {
    expect(
      applyDevConfigOverrides(defaultRemoteConfig, { dev: true }),
    ).toMatchObject({ iosRestrictionEnabled: false });
    expect(
      applyDevConfigOverrides(defaultRemoteConfig, { dev: true, ...forced }),
    ).toMatchObject({ iosRestrictionEnabled: true });
  });

  it("only accepts the exact value 1 and leaves every other setting alone", () => {
    const config = applyDevConfigOverrides(defaultRemoteConfig, {
      dev: true,
      forceIosPauses: "true",
    });
    expect(config).toEqual(defaultRemoteConfig);
  });

  it("never switches off something the server switched on", () => {
    const enabled = { ...defaultRemoteConfig, iosRestrictionEnabled: true };
    expect(applyDevConfigOverrides(enabled, { dev: true })).toEqual(enabled);
  });
});

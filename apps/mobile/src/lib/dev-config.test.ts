import { defaultRemoteConfig } from "@screen-time/contracts";
import { describe, expect, it } from "vitest";

import { applyDevConfigOverrides } from "./dev-config";

const forced = { forceIosPauses: "1", forceIosHomeOnCancel: "1" };

describe("development config overrides", () => {
  it("never touches the configuration of a release build", () => {
    const config = applyDevConfigOverrides(defaultRemoteConfig, {
      dev: false,
      ...forced,
    });
    expect(config).toBe(defaultRemoteConfig);
    expect(config.iosRestrictionEnabled).toBe(false);
    expect(config.iosHomeOnCancelEnabled).toBe(false);
  });

  it("switches the iOS pause and the Home Screen exit on in development only when asked", () => {
    expect(
      applyDevConfigOverrides(defaultRemoteConfig, { dev: true }),
    ).toMatchObject({
      iosRestrictionEnabled: false,
      iosHomeOnCancelEnabled: false,
    });
    expect(
      applyDevConfigOverrides(defaultRemoteConfig, { dev: true, ...forced }),
    ).toMatchObject({
      iosRestrictionEnabled: true,
      iosHomeOnCancelEnabled: true,
    });
  });

  it("only accepts the exact value 1 and leaves every other setting alone", () => {
    const config = applyDevConfigOverrides(defaultRemoteConfig, {
      dev: true,
      forceIosPauses: "true",
      forceIosHomeOnCancel: "0",
    });
    expect(config).toEqual(defaultRemoteConfig);
  });

  it("never switches off something the server switched on", () => {
    const enabled = {
      ...defaultRemoteConfig,
      iosRestrictionEnabled: true,
      iosHomeOnCancelEnabled: true,
    };
    expect(applyDevConfigOverrides(enabled, { dev: true })).toEqual(enabled);
  });
});

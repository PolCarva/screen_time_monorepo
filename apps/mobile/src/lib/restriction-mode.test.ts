import { defaultRemoteConfig } from "@screen-time/contracts";
import { describe, expect, it } from "vitest";

import { isPauseFeatureEnabled } from "./restriction-mode";

describe("platform pause feature mode", () => {
  it("honors the iOS remote kill switch for the Shortcuts pause", () => {
    expect(
      isPauseFeatureEnabled("ios", {
        ...defaultRemoteConfig,
        iosRestrictionEnabled: false,
      }),
    ).toBe(false);
    expect(
      isPauseFeatureEnabled("ios", {
        ...defaultRemoteConfig,
        iosRestrictionEnabled: true,
      }),
    ).toBe(true);
  });

  it("keeps each platform's switch independent", () => {
    expect(
      isPauseFeatureEnabled("ios", {
        ...defaultRemoteConfig,
        iosRestrictionEnabled: false,
        androidRestrictionEnabled: true,
      }),
    ).toBe(false);
    expect(
      isPauseFeatureEnabled("android", {
        ...defaultRemoteConfig,
        iosRestrictionEnabled: true,
        androidRestrictionEnabled: false,
      }),
    ).toBe(false);
  });

  it("continues honoring the Android remote kill switch", () => {
    expect(
      isPauseFeatureEnabled("android", {
        ...defaultRemoteConfig,
        androidRestrictionEnabled: false,
      }),
    ).toBe(false);
    expect(
      isPauseFeatureEnabled("android", {
        ...defaultRemoteConfig,
        androidRestrictionEnabled: true,
      }),
    ).toBe(true);
  });
});

import { defaultRemoteConfig } from "@screen-time/contracts";
import { describe, expect, it } from "vitest";

import { isPauseFeatureEnabled } from "./restriction-mode";

describe("platform pause feature mode", () => {
  it("keeps the local iOS Shortcuts replacement enabled when the legacy Managed Settings flag is off", () => {
    expect(
      isPauseFeatureEnabled("ios", {
        ...defaultRemoteConfig,
        iosRestrictionEnabled: false,
      }),
    ).toBe(true);
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

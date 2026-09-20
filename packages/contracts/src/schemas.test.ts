import { describe, expect, it } from "vitest";

import { defaultRemoteConfig, remoteConfigSchema } from "./schemas";

const published = {
  ...defaultRemoteConfig,
  version: 7,
  publishedAt: "2026-09-20T10:00:00.000Z",
};

describe("remote config: iOS home-on-cancel flag", () => {
  it("ships disabled", () => {
    expect(defaultRemoteConfig.iosHomeOnCancelEnabled).toBe(false);
  });

  it("reads a configuration published before the flag existed as off", () => {
    const { iosHomeOnCancelEnabled: _omitted, ...legacy } = published;
    const parsed = remoteConfigSchema.parse(legacy);
    expect(parsed.iosHomeOnCancelEnabled).toBe(false);
  });

  it("can be switched on remotely and rejects non-boolean values", () => {
    expect(
      remoteConfigSchema.parse({ ...published, iosHomeOnCancelEnabled: true })
        .iosHomeOnCancelEnabled,
    ).toBe(true);
    expect(
      remoteConfigSchema.safeParse({
        ...published,
        iosHomeOnCancelEnabled: "yes",
      }).success,
    ).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import {
  missingHosts,
  parseArgs,
  platformsOf,
  refusal,
  summarizeUpdates,
  trailingJson,
  updateMessage,
} from "./update-apps.mjs";

describe("update:apps", () => {
  it("reads the platform and options", () => {
    expect(parseArgs([])).toMatchObject({ platform: "all", check: false, rollback: false });
    expect(parseArgs(["ios", "--check"])).toMatchObject({ platform: "ios", check: true });
    expect(parseArgs(["--message", "Arreglo de textos", "--rollout", "10"])).toMatchObject({
      message: "Arreglo de textos",
      rollout: 10,
    });
    expect(parseArgs(["--rollback", "android"])).toMatchObject({ platform: "android", rollback: true });
    expect(() => parseArgs(["web"])).toThrow('Unknown argument "web"');
    expect(() => parseArgs(["--rollout", "100"])).toThrow("1 to 99");
    expect(() => parseArgs(["--rollout", "5.5"])).toThrow("1 to 99");
    expect(() => parseArgs(["--message", " "])).toThrow("--message needs text");
    expect(platformsOf("all")).toEqual(["ios", "android"]);
    expect(platformsOf("ios")).toEqual(["ios"]);
  });

  it("names the commit an update comes from", () => {
    expect(updateMessage(null, "fix(mobile): textos de la pausa", "abc1234")).toBe(
      "fix(mobile): textos de la pausa (abc1234)",
    );
    expect(updateMessage("Arreglo", "ignored", "abc1234")).toBe("Arreglo (abc1234)");
  });

  it("checks a bundle calls the production hosts", () => {
    const hosts = ["api.example.app", "abc.supabase.co"];
    // expo-router keeps "http://localhost:3000" in every iOS bundle: harmless.
    const production = '"https://api.example.app"…"https://abc.supabase.co"…"http://localhost:3000"';
    expect(missingHosts(production, hosts)).toEqual([]);
    expect(missingHosts('"http://localhost:3000"…"https://abc.supabase.co"', hosts)).toEqual([
      "api.example.app",
    ]);
  });

  describe("refusing an update that is not JavaScript only", () => {
    const store = {
      tag: "store/android/0.3.5+13",
      commit: "abcdef1234",
      fingerprint: "native-a",
      runtime: "0.3.5",
    };
    const base = { platform: "android", version: "0.3.5", store, fingerprint: "native-a", ancestor: true };

    it("publishes when only JavaScript changed since the store build", () => {
      expect(refusal(base)).toBeNull();
    });

    it("refuses when no store build of this version exists", () => {
      expect(refusal({ ...base, store: null })).toContain("would reach nobody");
    });

    it("refuses when native code changed, and says what changed", () => {
      const problem = refusal({
        ...base,
        fingerprint: "native-b",
        changed: ["android/app/src/main/java/com/still/screentime/StillSetup.kt"],
      });
      expect(problem).toContain("Native code changed since store/android/0.3.5+13");
      expect(problem).toContain("Bump VERSION");
      expect(problem).toContain("StillSetup.kt");
    });

    it("refuses from a checkout that lacks the store build's commit", () => {
      expect(refusal({ ...base, ancestor: false })).toContain("HEAD does not contain");
    });

    it("refuses a store tag without a fingerprint", () => {
      expect(refusal({ ...base, store: { ...store, fingerprint: null } })).toContain(
        "records no native fingerprint",
      );
    });
  });

  it("reads the update groups from eas update --json", () => {
    const output = [
      "Proceeding with outdated version.",
      "[expo-cli] a log line",
      JSON.stringify(
        [
          { id: "1", group: "g1", platform: "ios", runtimeVersion: "0.3.5" },
          { id: "2", group: "g1", platform: "android", runtimeVersion: "0.3.5" },
        ],
        null,
        2,
      ),
    ].join("\n");
    expect(summarizeUpdates(trailingJson(output))).toEqual([
      { group: "g1", platforms: ["ios", "android"], runtimeVersion: "0.3.5" },
    ]);
    expect(trailingJson("no json here")).toBeNull();
    expect(summarizeUpdates(null)).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";

import {
  androidUpdatesProblems,
  conflictingStoreBuild,
  expandHome,
  iosUpdatesProblems,
  parsePlatform,
  pickFinishedBuilds,
  releaseToPromote,
} from "./deploy-apps.mjs";

describe("deploy:apps", () => {
  it("ships only the finished builds this run made from this commit", () => {
    const since = Date.parse("2026-09-24T23:20:00Z");
    const build = (id, platform, createdAt, extra = {}) => ({
      id,
      platform,
      status: "FINISHED",
      gitCommitHash: "abc",
      createdAt,
      ...extra,
    });
    const builds = [
      build("ios-new", "IOS", "2026-09-24T23:30:00Z"),
      build("ios-first", "IOS", "2026-09-24T23:22:00Z"),
      build("ios-old", "IOS", "2026-09-24T21:19:00Z"),
      build("android-errored", "ANDROID", "2026-09-24T23:23:00Z", {
        status: "ERRORED",
      }),
      build("android-other-commit", "ANDROID", "2026-09-24T23:24:00Z", {
        gitCommitHash: "def",
      }),
    ];

    const picked = pickFinishedBuilds(builds, { commit: "abc", since });

    expect(picked.ios.id).toBe("ios-new");
    expect(picked.android).toBeUndefined();
  });

  it("builds both apps unless a platform is named", () => {
    expect(parsePlatform([])).toBe("all");
    expect(parsePlatform(["ios"])).toBe("ios");
    expect(parsePlatform(["android"])).toBe("android");
    expect(parsePlatform(["--check"])).toBe("all");
    expect(parsePlatform(["--check", "ios"])).toBe("ios");
    expect(() => parsePlatform(["web"])).toThrow('Unknown platform "web"');
  });

  it("expands $HOME the way eas.json writes key paths", () => {
    expect(expandHome("$HOME/.config/still/key.json", "/Users/me")).toBe(
      "/Users/me/.config/still/key.json",
    );
    expect(expandHome("${HOME}/key.p8", "/Users/me")).toBe("/Users/me/key.p8");
    expect(expandHome("/abs/key.p8", "/Users/me")).toBe("/abs/key.p8");
  });

  it("promotes the newest completed internal release to the closed track", () => {
    const internal = {
      releases: [
        { name: "5 (0.2.1)", versionCodes: ["5"], status: "completed" },
        { name: "6 (0.2.1)", versionCodes: ["6"], status: "completed" },
        { name: "7 (0.2.1)", versionCodes: ["7"], status: "draft" },
      ],
    };
    const closed = { releases: [{ versionCodes: ["4"], status: "completed" }] };

    expect(releaseToPromote(internal, closed)).toEqual({
      name: "6 (0.2.1)",
      versionCodes: ["6"],
      status: "completed",
    });
  });

  it("leaves the closed track alone when it already has that build or a newer one", () => {
    const internal = {
      releases: [{ versionCodes: ["6"], status: "completed" }],
    };

    expect(
      releaseToPromote(internal, {
        releases: [{ versionCodes: ["6"], status: "inProgress" }],
      }),
    ).toBeNull();
    expect(
      releaseToPromote(internal, {
        releases: [{ versionCodes: ["7"], status: "completed" }],
      }),
    ).toBeNull();
    expect(releaseToPromote({ releases: [] }, { releases: [] })).toBeNull();
  });

  it("promotes to an empty closed track and keeps the release notes", () => {
    const notes = [{ language: "es-419", text: "Pausa solo con anuncio." }];
    const internal = {
      releases: [
        { versionCodes: ["6"], status: "completed", releaseNotes: notes },
      ],
    };

    expect(releaseToPromote(internal, {})).toEqual({
      versionCodes: ["6"],
      status: "completed",
      releaseNotes: notes,
    });
  });

  describe("store builds ready for over-the-air updates", () => {
    const url = "https://u.expo.dev/0dffe42d-253f-40f4-9f70-5870276707ff";
    const ipaEntries = ["Payload/Still.app/Info.plist", "Payload/Still.app/EXUpdates.bundle/app.manifest"];

    it("accepts an IPA with updates on, the version as runtime and the production channel", () => {
      const plist = {
        EXUpdatesEnabled: true,
        EXUpdatesURL: url,
        EXUpdatesRuntimeVersion: "0.3.5",
        EXUpdatesRequestHeaders: { "expo-channel-name": "production" },
      };
      expect(iosUpdatesProblems(plist, ipaEntries, "0.3.5")).toEqual([]);
      expect(
        iosUpdatesProblems({ ...plist, EXUpdatesRequestHeaders: {} }, ipaEntries, "0.3.5"),
      ).toEqual(["the channel is not production"]);
      expect(iosUpdatesProblems(plist, ipaEntries, "0.3.6")).toEqual([
        "EXUpdatesRuntimeVersion is 0.3.5, not 0.3.6",
      ]);
      expect(iosUpdatesProblems({ ...plist, EXUpdatesEnabled: false }, [], "0.3.5")).toEqual([
        "EXUpdatesEnabled is not true",
        "the embedded update (EXUpdates.bundle/app.manifest) is missing",
      ]);
    });

    it("accepts an AAB whose manifest has the URL and the production channel", () => {
      const manifest = `\u0000${url}\u0000{"expo-channel-name":"production"}`;
      const entries = ["base/manifest/AndroidManifest.xml", "base/assets/app.manifest"];
      expect(androidUpdatesProblems(manifest, entries)).toEqual([]);
      expect(androidUpdatesProblems(url, ["base/manifest/AndroidManifest.xml"])).toEqual([
        "the channel is not production",
        "the embedded update (assets/app.manifest) is missing",
      ]);
    });

    it("refuses to reuse a version whose store build has other native code", () => {
      const tags = [{ tag: "store/ios/0.3.5+18", fingerprint: "native-a" }];
      expect(conflictingStoreBuild(tags, "native-a")).toBeNull();
      expect(conflictingStoreBuild(tags, "native-b")).toEqual(tags[0]);
      expect(conflictingStoreBuild([], "native-b")).toBeNull();
    });
  });
});

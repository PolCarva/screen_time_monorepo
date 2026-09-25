import { describe, expect, it } from "vitest";

import {
  expandHome,
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
});

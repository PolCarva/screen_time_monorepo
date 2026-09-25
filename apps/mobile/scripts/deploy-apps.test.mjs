import { describe, expect, it } from "vitest";

import { expandHome, parsePlatform, releaseToPromote } from "./deploy-apps.mjs";

describe("deploy:apps", () => {
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

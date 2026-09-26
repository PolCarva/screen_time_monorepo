import { describe, expect, it } from "vitest";

import {
  GUARD_IGNORE_PATHS,
  apiUrlProblem,
  formatStoreTagMessage,
  nativeVersionProblems,
  guardOptions,
  parseStoreTagMessage,
  readAppVersion,
  storeTagBuild,
  storeTagName,
} from "./ota-guard.mjs";

describe("ota guard", () => {
  it("reads the version the store builds and updates share", () => {
    expect(readAppVersion('const VERSION = "0.3.5";\nversion: VERSION,')).toBe("0.3.5");
    expect(() => readAppVersion('version: "0.3.5",')).toThrow("const VERSION");
  });

  it("names a store build by platform, version and build number", () => {
    expect(storeTagName("ios", "0.3.5", 18)).toBe("store/ios/0.3.5+18");
    expect(storeTagBuild("store/android/0.3.5+13")).toBe(13);
    expect(storeTagBuild("store/android/0.3.5")).toBe(0);
  });

  it("records and reads back what a store build carries", () => {
    const message = formatStoreTagMessage({
      runtime: "0.3.5",
      fingerprint: "abc123",
      commit: "f00d",
    });
    expect(parseStoreTagMessage(message)).toEqual({
      runtime: "0.3.5",
      fingerprint: "abc123",
      commit: "f00d",
    });
    expect(parseStoreTagMessage("")).toEqual({ runtime: null, fingerprint: null, commit: null });
  });

  it("fingerprints native code only, never the app config, scripts or eas.json", () => {
    const SourceSkips = { ExpoConfigAll: 1, PackageJsonScriptsAll: 2, GitIgnore: 4 };
    const options = guardOptions("ios", { SourceSkips, DEFAULT_IGNORE_PATHS: ["**/Pods/**"] });
    expect(options.platforms).toEqual(["ios"]);
    expect(options.sourceSkips).toBe(7);
    expect(options.ignorePaths).toEqual(["**/Pods/**", ...GUARD_IGNORE_PATHS]);
    expect(GUARD_IGNORE_PATHS).toContain("eas.json");
  });

  it("finds native files left on another version or runtime", () => {
    const texts = {
      gradle: 'versionCode 1\n        versionName "0.3.5"',
      strings: '<string name="expo_runtime_version">0.3.5</string>',
      pbxproj: "MARKETING_VERSION = 0.3.5;\nMARKETING_VERSION = 0.3.5;",
      infoPlist: "<key>CFBundleShortVersionString</key>\n\t<string>0.3.5</string>",
      expoPlist: "<key>EXUpdatesRuntimeVersion</key>\n    <string>0.3.5</string>",
    };
    expect(nativeVersionProblems(texts, "0.3.5")).toEqual([]);
    expect(
      nativeVersionProblems(
        { ...texts, pbxproj: "MARKETING_VERSION = 0.3.5;\nMARKETING_VERSION = 0.3.4;", expoPlist: "" },
        "0.3.5",
      ),
    ).toEqual([
      "ios/Still.xcodeproj/project.pbxproj: 0.3.4, not 0.3.5",
      "ios/Still/Supporting/Expo.plist: no version found",
    ]);
  });
});

describe("production API check", () => {
  const answering = (status, headers = {}) => async (url, init) => {
    expect(init.redirect).toBe("manual");
    return new Response(null, { status, headers });
  };

  it("passes an API that answers /api/v1/config itself", async () => {
    await expect(apiUrlProblem("https://get-still.app", answering(200))).resolves.toBeNull();
  });

  it("refuses a redirect, which would drop the sign-in", async () => {
    const problem = await apiUrlProblem(
      "https://screen-time-monorepo-web.vercel.app",
      answering(308, { location: "https://get-still.app/api/v1/config" }),
    );
    expect(problem).toContain("redirects (308 to https://get-still.app/api/v1/config)");
    expect(problem).toContain("401");
  });

  it("refuses a missing, plain-http, failing or silent address", async () => {
    expect(await apiUrlProblem(null, answering(200))).toContain("not set");
    expect(await apiUrlProblem("http://localhost:3000", answering(200))).toContain("https");
    expect(await apiUrlProblem("https://get-still.app", answering(500))).toContain("answered 500");
    const silent = async () => {
      throw new Error("getaddrinfo ENOTFOUND");
    };
    expect(await apiUrlProblem("https://get-still.app", silent)).toContain("did not answer");
  });

  it("joins the path the way the app does", async () => {
    const asked = [];
    await apiUrlProblem("https://get-still.app", async (url) => {
      asked.push(url);
      return new Response(null, { status: 200 });
    });
    expect(asked).toEqual(["https://get-still.app/api/v1/config"]);
  });
});

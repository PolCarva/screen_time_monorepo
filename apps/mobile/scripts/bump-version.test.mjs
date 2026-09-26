import { describe, expect, it } from "vitest";

import { versionEdits } from "./bump-version.mjs";

describe("version:apps", () => {
  it("changes the version in the app config and every native file that shows it", () => {
    const edits = versionEdits("0.3.6");
    const apply = (file, text) => {
      const [, pattern, replacement] = edits.find(([name]) => name === file);
      return text.replace(pattern, replacement);
    };
    expect(apply("app.config.ts", 'const VERSION = "0.3.5";')).toBe('const VERSION = "0.3.6";');
    expect(apply("android/app/build.gradle", 'versionName "0.3.5"')).toBe('versionName "0.3.6"');
    expect(
      apply("ios/Still.xcodeproj/project.pbxproj", "MARKETING_VERSION = 0.3.5;\nMARKETING_VERSION = 0.3.5;"),
    ).toBe("MARKETING_VERSION = 0.3.6;\nMARKETING_VERSION = 0.3.6;");
    expect(
      apply("ios/Still/Info.plist", "<key>CFBundleShortVersionString</key>\n\t<string>0.3.5</string>"),
    ).toBe("<key>CFBundleShortVersionString</key>\n\t<string>0.3.6</string>");
  });

  it("takes only x.y.z", () => {
    expect(() => versionEdits("0.4")).toThrow("is not x.y.z");
    expect(() => versionEdits("v0.3.6")).toThrow("is not x.y.z");
  });
});

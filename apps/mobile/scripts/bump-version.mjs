#!/usr/bin/env node

// Sets the app version everywhere a store build reads it: VERSION in
// app.config.ts (also the runtime of over-the-air updates), versionName, every
// MARKETING_VERSION, CFBundleShortVersionString, and the synced runtime in
// strings.xml and Expo.plist (docs/ota-updates-plan.md). Bumping only VERSION
// would let the build re-sync the runtime on the fly and leave the binary's
// parts disagreeing.
//
//   pnpm version:apps 0.3.6

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  MOBILE_DIR,
  NATIVE_VERSION_FILES,
  currentAppVersion,
  currentNativeVersionProblems,
} from "./ota-guard.mjs";

/** The edits for `version`, as [file, pattern, replacement]; pure for tests. */
export function versionEdits(version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`"${version}" is not x.y.z.`);
  return [
    ["app.config.ts", /const VERSION = "[^"]+";/, `const VERSION = "${version}";`],
    [NATIVE_VERSION_FILES.gradle, /versionName "[^"]+"/, `versionName "${version}"`],
    [NATIVE_VERSION_FILES.pbxproj, /MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`],
    [
      NATIVE_VERSION_FILES.infoPlist,
      /(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]+(<\/string>)/,
      `$1${version}$2`,
    ],
  ];
}

function main() {
  const version = process.argv[2];
  const previous = currentAppVersion();
  for (const [file, pattern, replacement] of versionEdits(version)) {
    const path = join(MOBILE_DIR, file);
    const text = readFileSync(path, "utf8");
    if (!pattern.test(text)) throw new Error(`${file} has no version to change.`);
    pattern.lastIndex = 0;
    writeFileSync(path, text.replace(pattern, replacement));
  }
  // The runtime in strings.xml and Expo.plist, written the way the build does.
  for (const platform of ["android", "ios"]) {
    execFileSync(
      "npx",
      ["expo-updates", "configuration:syncnative", "--platform", platform, "--workflow", "generic"],
      { cwd: MOBILE_DIR, stdio: "inherit", env: { ...process.env, EXPO_NO_DOTENV: "1" } },
    );
  }
  const problems = currentNativeVersionProblems(version);
  if (problems.length) throw new Error(problems.join("\n"));
  console.log(`Version ${previous} → ${version} in every native file. Commit it, then pnpm deploy:apps.`);
}

const isDirectRun =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectRun) {
  try {
    main();
  } catch (error) {
    console.error(`FAIL version:apps\n${error.message}`);
    process.exitCode = 1;
  }
}

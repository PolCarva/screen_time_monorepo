// What makes an over-the-air update safe for the store builds people have
// (docs/ota-updates-plan.md). Store builds and updates share a runtime, the
// app version; an update may only change JavaScript. So every store build
// leaves a git tag with the fingerprint of its native code, and an update is
// refused when the native code of the commit it ships differs from that
// build's. Shared by deploy-apps.mjs and update-apps.mjs.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const MOBILE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(MOBILE_DIR, "package.json"));

/**
 * Files that never change the binary for an update's purposes. The app
 * config, package.json scripts and eas.json depend on env or on tooling;
 * native changes land in android/ and ios/, which are committed.
 */
export const GUARD_IGNORE_PATHS = [
  "eas.json",
  "android/local.properties",
  "android/.kotlin/**",
  "android/app/src/test/**",
  "ios/**/xcuserdata/**",
];

/** Options for expo/fingerprint: only native code, never env or scripts. */
export function guardOptions(platform, fingerprint = require("expo/fingerprint")) {
  const { SourceSkips, DEFAULT_IGNORE_PATHS } = fingerprint;
  return {
    platforms: [platform],
    sourceSkips:
      SourceSkips.ExpoConfigAll |
      SourceSkips.PackageJsonScriptsAll |
      SourceSkips.GitIgnore,
    ignorePaths: [...DEFAULT_IGNORE_PATHS, ...GUARD_IGNORE_PATHS],
  };
}

/**
 * node_modules exactly as the lockfile says, as the build's fresh install will
 * be: the fingerprint hashes the installed native modules, not the lockfile.
 */
export function installFromLockfile() {
  const root = git(["rev-parse", "--show-toplevel"]);
  execFileSync("pnpm", ["install", "--frozen-lockfile"], { cwd: root, stdio: "inherit" });
}

/** The fingerprint of `platform`'s native code in the working tree (about 1 s). */
export async function nativeFingerprint(platform) {
  const fingerprint = require("expo/fingerprint");
  const result = await fingerprint.createFingerprintAsync(
    MOBILE_DIR,
    guardOptions(platform, fingerprint),
  );
  return result.hash;
}

/** `const VERSION = "x.y.z"` in app.config.ts: the store version and the runtime. */
export function readAppVersion(appConfigText) {
  const version = /const VERSION = "(\d+\.\d+\.\d+)";/.exec(appConfigText)?.[1];
  if (!version) throw new Error('app.config.ts has no `const VERSION = "x.y.z"`.');
  return version;
}

export function currentAppVersion() {
  return readAppVersion(readFileSync(join(MOBILE_DIR, "app.config.ts"), "utf8"));
}

/** The committed native files that carry the version or the update runtime. */
export const NATIVE_VERSION_FILES = {
  gradle: "android/app/build.gradle",
  strings: "android/app/src/main/res/values/strings.xml",
  pbxproj: "ios/Still.xcodeproj/project.pbxproj",
  infoPlist: "ios/Still/Info.plist",
  expoPlist: "ios/Still/Supporting/Expo.plist",
};

/**
 * Native files whose version or runtime is not `version`, from their texts
 * keyed as NATIVE_VERSION_FILES. A build would otherwise re-sync the runtime
 * on the fly and ship a binary whose parts disagree.
 */
export function nativeVersionProblems(texts, version) {
  const found = {
    [NATIVE_VERSION_FILES.gradle]: [/versionName "([^"]+)"/g],
    [NATIVE_VERSION_FILES.strings]: [/<string name="expo_runtime_version">([^<]+)<\/string>/g],
    [NATIVE_VERSION_FILES.pbxproj]: [/MARKETING_VERSION = ([^;]+);/g],
    [NATIVE_VERSION_FILES.infoPlist]: [/<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/g],
    [NATIVE_VERSION_FILES.expoPlist]: [/<key>EXUpdatesRuntimeVersion<\/key>\s*<string>([^<]+)<\/string>/g],
  };
  const problems = [];
  for (const [key, file] of Object.entries(NATIVE_VERSION_FILES)) {
    const values = found[file].flatMap((pattern) => [...(texts[key] ?? "").matchAll(pattern)].map((m) => m[1]));
    if (!values.length) problems.push(`${file}: no version found`);
    for (const value of new Set(values))
      if (value !== version) problems.push(`${file}: ${value}, not ${version}`);
  }
  return problems;
}

export function currentNativeVersionProblems(version = currentAppVersion()) {
  const texts = Object.fromEntries(
    Object.entries(NATIVE_VERSION_FILES).map(([key, file]) => [
      key,
      readFileSync(join(MOBILE_DIR, file), "utf8"),
    ]),
  );
  return nativeVersionProblems(texts, version);
}

export function storeTagName(platform, version, build) {
  return `store/${platform}/${version}+${build}`;
}

export function formatStoreTagMessage({ runtime, fingerprint, commit }) {
  return [
    `Store build, runtime ${runtime}`,
    "",
    `runtime=${runtime}`,
    `fingerprint=${fingerprint}`,
    `commit=${commit}`,
  ].join("\n");
}

export function parseStoreTagMessage(text) {
  const field = (name) =>
    new RegExp(`^${name}=(\\S+)$`, "m").exec(text ?? "")?.[1] ?? null;
  return {
    runtime: field("runtime"),
    fingerprint: field("fingerprint"),
    commit: field("commit"),
  };
}

/** The build number after "+" in a store tag, for ordering. */
export function storeTagBuild(tag) {
  return Number(/\+(\d+)$/.exec(tag)?.[1] ?? 0);
}

function git(args) {
  return execFileSync("git", args, { cwd: MOBILE_DIR, encoding: "utf8" }).trim();
}

/**
 * The store builds of `version` on `platform`, newest first: tag, the commit
 * it was built from and what its message records.
 */
export function listStoreTags(platform, version) {
  const output = git([
    "for-each-ref",
    `refs/tags/store/${platform}/${version}+*`,
    "--format=%(refname:short)%09%(*objectname)%09%(contents:body)%00",
  ]);
  return output
    .split("\0")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [tag, commit, ...body] = entry.split("\t");
      return { tag, commit, ...parseStoreTagMessage(body.join("\t")) };
    })
    .sort((a, b) => storeTagBuild(b.tag) - storeTagBuild(a.tag));
}

export function isAncestor(ancestor, descendant = "HEAD") {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], {
      cwd: MOBILE_DIR,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

/** Committed native files changed since `commit`, to explain a refusal. */
export function nativeDiff(commit) {
  const output = git([
    "diff",
    "--name-only",
    `${commit}..HEAD`,
    "--",
    ".",
    ":(exclude)src",
    ":(exclude)app",
    ":(exclude)assets",
    ":(exclude)scripts",
    ":(exclude)*.test.*",
    // A lockfile change moves native modules' paths, which the fingerprint hashes.
    ":(top)pnpm-lock.yaml",
    ":(top)pnpm-workspace.yaml",
    ":(top)patches",
  ]);
  return output ? output.split("\n") : [];
}

/**
 * Untracked or modified files an export or a local build would pick up, in
 * the app, the shared packages or the lockfile.
 */
export function dirtyFiles() {
  const root = git(["rev-parse", "--show-toplevel"]);
  const output = execFileSync(
    "git",
    [
      "status",
      "--porcelain",
      "--untracked-files=all",
      "--",
      "apps/mobile",
      "packages",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
    ],
    { cwd: root, encoding: "utf8" },
  ).trim();
  return output ? output.split("\n") : [];
}

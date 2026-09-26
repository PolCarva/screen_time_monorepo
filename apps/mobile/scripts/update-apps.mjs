#!/usr/bin/env node

// Publishes JavaScript to the store builds people already have, with no new
// version and no store review: an over-the-air update on EAS Update's
// "production" channel (docs/ota-updates-plan.md). Only JavaScript may change:
// the update is refused when native code differs from the store build of the
// same version (ota-guard.mjs), or when no store build of this version exists.
//
//   pnpm update:apps [all|ios|android] [--message "..."] [--rollout 1-99]
//   pnpm update:apps --check      checks and exports, publishes nothing
//   pnpm update:apps --rollback   everyone back to the store build's JavaScript

import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  MOBILE_DIR,
  currentAppVersion,
  dirtyFiles,
  isAncestor,
  listStoreTags,
  nativeDiff,
  nativeFingerprint,
} from "./ota-guard.mjs";

const CHANNEL = "production";
const DIST = join(MOBILE_DIR, "dist");
const PROJECT_UPDATES_URL =
  "https://expo.dev/accounts/pablo-carvalhos-team/projects/still/updates";
/** Hosts a production bundle must never call: a sign of a development env. */
export const FORBIDDEN_BUNDLE_STRINGS = ["localhost:3000", "10.0.2.2", "127.0.0.1:"];

export function parseArgs(args) {
  const options = { platform: "all", message: null, rollout: null, check: false, rollback: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--check") options.check = true;
    else if (arg === "--rollback") options.rollback = true;
    else if (arg === "--message") options.message = args[++index] ?? null;
    else if (arg === "--rollout") options.rollout = Number(args[++index]);
    else if (["all", "ios", "android"].includes(arg)) options.platform = arg;
    else throw new Error(`Unknown argument "${arg}".`);
  }
  if (options.message !== null && !options.message.trim())
    throw new Error("--message needs text.");
  if (
    options.rollout !== null &&
    (!Number.isInteger(options.rollout) || options.rollout < 1 || options.rollout > 99)
  )
    throw new Error("--rollout takes a whole percentage from 1 to 99.");
  return options;
}

export function platformsOf(platform) {
  return platform === "all" ? ["ios", "android"] : [platform];
}

/** The update's message: the one given, or the last commit's subject, and the commit. */
export function updateMessage(message, subject, shortSha) {
  return `${(message ?? subject).trim()} (${shortSha})`;
}

/** Forbidden strings found in an exported bundle's text. */
export function forbiddenIn(text) {
  return FORBIDDEN_BUNDLE_STRINGS.filter((needle) => text.includes(needle));
}

/**
 * Why an update to `platform` would be unsafe, or null. `store` is the newest
 * store build of this version (listStoreTags), `fingerprint` the native code
 * now, `ancestor` whether that build's commit is in HEAD's history.
 */
export function refusal({ platform, version, store, fingerprint, ancestor, changed = [] }) {
  if (!store)
    return `No ${platform} store build of ${version} exists: the update would reach nobody. Run pnpm deploy:apps first, or name only the other platform.`;
  if (!store.fingerprint)
    return `${store.tag} records no native fingerprint; ship ${platform} with pnpm deploy:apps.`;
  if (!ancestor)
    return `HEAD does not contain ${store.tag} (${store.commit?.slice(0, 7)}): publishing would undo what that build has.`;
  if (store.fingerprint !== fingerprint)
    return [
      `Native code changed since ${store.tag}: an update cannot ship it.`,
      "Bump VERSION in app.config.ts and run pnpm deploy:apps.",
      ...(changed.length ? ["Changed:", ...changed.map((file) => `  ${file}`)] : []),
    ].join("\n");
  return null;
}

/** Update groups and their platforms from `eas update --json`. */
export function summarizeUpdates(json) {
  const updates = Array.isArray(json) ? json : [];
  const groups = new Map();
  for (const update of updates) {
    if (!update?.group) continue;
    const entry = groups.get(update.group) ?? { group: update.group, platforms: [], runtimeVersion: update.runtimeVersion };
    entry.platforms.push(update.platform);
    groups.set(update.group, entry);
  }
  return [...groups.values()];
}

function git(args) {
  return execFileSync("git", args, { cwd: MOBILE_DIR, encoding: "utf8" }).trim();
}

/**
 * Runs `command` with the EAS production env, as a production app config
 * (`.env` files off). With `capture`, returns its stdout instead of showing it.
 */
function withProductionEnv(command, { env = {}, capture = false } = {}) {
  const result = spawnSync(
    "eas",
    [
      "env:exec",
      "production",
      `APP_VARIANT=production EXPO_NO_DOTENV=1 ${command}`,
      "--non-interactive",
    ],
    {
      cwd: MOBILE_DIR,
      stdio: ["ignore", capture ? "pipe" : "inherit", "inherit"],
      encoding: "utf8",
      env: { ...process.env, ...env },
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`"${command.split(" ").slice(0, 2).join(" ")}" failed (exit ${result.status}).`);
  return result.stdout ?? "";
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed.`);
}

/** The JSON a command printed after any log lines, or null. */
export function trailingJson(output) {
  for (let index = 0; index < output.length; index += 1) {
    const char = output[index];
    if ((char !== "[" && char !== "{") || (index > 0 && output[index - 1] !== "\n")) continue;
    try {
      return JSON.parse(output.slice(index));
    } catch {
      // A log line that starts with a bracket; keep looking.
    }
  }
  return null;
}

/** Every exported bundle's text, to look for development hosts. */
function scanExport(platforms) {
  const metadata = JSON.parse(readFileSync(join(DIST, "metadata.json"), "utf8"));
  const problems = [];
  for (const platform of platforms) {
    const bundle = metadata.fileMetadata?.[platform]?.bundle;
    if (!bundle) {
      problems.push(`The export has no ${platform} bundle.`);
      continue;
    }
    const found = forbiddenIn(readFileSync(join(DIST, bundle)).toString("latin1"));
    if (found.length)
      problems.push(`The ${platform} bundle calls ${found.join(", ")}: it was built with a development env.`);
  }
  return problems;
}

async function guard(platforms, version) {
  for (const platform of platforms) {
    const store = listStoreTags(platform, version)[0] ?? null;
    const fingerprint = await nativeFingerprint(platform);
    const ancestor = store ? isAncestor(store.commit) : false;
    const problem = refusal({
      platform,
      version,
      store,
      fingerprint,
      ancestor,
      changed: store && store.fingerprint !== fingerprint ? nativeDiff(store.commit) : [],
    });
    if (problem) throw new Error(problem);
    console.log(`OK ${platform}: JavaScript only since ${store.tag}`);
  }
}

async function rollBack(platforms, version) {
  const shipped = platforms.filter((platform) => listStoreTags(platform, version).length);
  if (!shipped.length) throw new Error(`No store build of ${version} to go back to.`);
  for (const platform of shipped) {
    withProductionEnv(
      `eas update:roll-back-to-embedded --channel ${CHANNEL} --platform ${platform} --runtime-version ${version} --message "$STILL_UPDATE_MESSAGE" --non-interactive`,
      { env: { STILL_UPDATE_MESSAGE: `Back to the ${version} store build` } },
    );
    console.log(`${platform}: phones with ${version} go back to the store build's JavaScript at their next launch check.`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const platforms = platformsOf(options.platform);
  const version = currentAppVersion();

  if (options.rollback) return rollBack(platforms, version);

  const dirty = dirtyFiles();
  if (dirty.length)
    throw new Error(`Commit or remove these first; the update would ship them:\n${dirty.join("\n")}`);
  if (!isAncestor("HEAD", "main"))
    throw new Error("HEAD is not in main: merge it first, so main always has what phones run.");

  await guard(platforms, version);

  console.log("Typecheck and tests…");
  const root = git(["rev-parse", "--show-toplevel"]);
  run("pnpm", ["install", "--frozen-lockfile"], { cwd: root });
  run("pnpm", ["--filter", "mobile", "typecheck"], { cwd: root });
  run("pnpm", ["--filter", "mobile", "test"], { cwd: root });

  console.log("Exporting the production bundle…");
  rmSync(DIST, { recursive: true, force: true });
  withProductionEnv(
    `npx expo export --output-dir dist --dump-sourcemap --dump-assetmap --clear ${platforms.map((platform) => `--platform ${platform}`).join(" ")}`,
  );
  const problems = scanExport(platforms);
  if (problems.length) throw new Error(problems.join("\n"));
  console.log(`OK export: ${platforms.join(" + ")}, no development hosts`);

  if (options.check) {
    console.log(`--check: nothing published. It would reach ${platforms.join(" and ")} store builds of ${version}.`);
    return;
  }

  const message = updateMessage(
    options.message,
    git(["log", "-1", "--format=%s"]),
    git(["rev-parse", "--short", "HEAD"]),
  );
  const output = withProductionEnv(
    [
      "eas update --skip-bundler --input-dir dist",
      `--channel ${CHANNEL} --environment production`,
      `--platform ${options.platform}`,
      '--message "$STILL_UPDATE_MESSAGE"',
      ...(options.rollout ? [`--rollout-percentage ${options.rollout}`] : []),
      "--json --non-interactive",
    ].join(" "),
    { env: { STILL_UPDATE_MESSAGE: message }, capture: true },
  );
  rmSync(DIST, { recursive: true, force: true });
  const groups = summarizeUpdates(trailingJson(output));
  if (!groups.length) throw new Error(`eas update gave no update groups:\n${output.slice(-500)}`);
  for (const { group, platforms: shipped } of groups) {
    console.log(`Published ${group} (${shipped.join(", ")}, runtime ${version}): ${PROJECT_UPDATES_URL}/${group}`);
  }
  console.log(
    [
      "",
      "Phones download it at their next launch or return, and use it on the next cold start or a safe return.",
      options.rollout
        ? `Rollout ${options.rollout}%: finish it with eas update:edit <group> --rollout-percentage 100 (inside eas env:exec production).`
        : null,
      "If something breaks: pnpm update:apps --rollback",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

const isDirectRun =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectRun) {
  main().catch((error) => {
    console.error(`FAIL update:apps\n${error.message}`);
    process.exitCode = 1;
  });
}

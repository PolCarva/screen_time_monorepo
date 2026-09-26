#!/usr/bin/env node

// Ships the production apps to testers with one command. The builds run on
// this Mac (`eas build --local`; `--cloud` uses EAS's queue instead) and the
// uploads happen here, because EAS's free queues can hold a build or a
// submission for an hour while the upload itself takes seconds:
// - iOS goes to TestFlight with altool, and the internal group gets every
//   build once Apple processes it;
// - Android goes to Play's internal testing track through the Play API, and
//   the newest internal release is then promoted to the closed "alpha" track
//   so testers who only joined the closed test update too (after review).
// Both store keys are checked before building, so a missing permission fails
// in seconds, not after the builds; `--check` stops right after those checks.
// Every local build is checked for over-the-air updates (on, runtime = the
// version, channel production) and leaves a git tag store/<platform>/<version>+
// <build> with its native fingerprint, which `pnpm update:apps` needs to know
// an update is JavaScript only (docs/ota-updates-plan.md).

import { execFileSync, spawnSync } from "node:child_process";
import { createPrivateKey, createSign } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  currentAppVersion,
  dirtyFiles,
  formatStoreTagMessage,
  listStoreTags,
  nativeFingerprint,
  storeTagName,
} from "./ota-guard.mjs";

const MOBILE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const ANDROID_PACKAGE = "com.still.screentime";
const INTERNAL_TRACK = "internal";
const CLOSED_TRACK = "alpha";
const INTERNAL_OPT_IN =
  "https://play.google.com/apps/internaltest/4701510577558424651";
const PLATFORMS = ["all", "ios", "android"];
// EAS stamps builds with its own clock; allow for drift against this Mac's.
const CLOCK_SKEW_MS = 2 * 60_000;
const UPDATES_URL = "https://u.expo.dev/0dffe42d-253f-40f4-9f70-5870276707ff";
const UPDATES_CHANNEL = "production";

export function parsePlatform(args) {
  const platform = args.find((arg) => !arg.startsWith("--")) ?? "all";
  if (!PLATFORMS.includes(platform))
    throw new Error(
      `Unknown platform "${platform}": use ${PLATFORMS.join(", ")}.`,
    );
  return platform;
}

/** eas.json writes key paths as `$HOME/...`, the way EAS evaluates them. */
export function expandHome(path, home = homedir()) {
  return path.replace(/^(\$HOME|\$\{HOME\}|~)(?=\/)/, home);
}

/**
 * The builds this run produced: finished, from this commit, started after the
 * run began; the newest per platform, keyed "ios" / "android".
 */
export function pickFinishedBuilds(builds, { commit, since }) {
  const picked = {};
  for (const build of builds) {
    if (build.status !== "FINISHED" || build.gitCommitHash !== commit) continue;
    const createdAt = Date.parse(build.createdAt);
    if (createdAt < since) continue;
    const platform = build.platform.toLowerCase();
    if (!picked[platform] || createdAt > Date.parse(picked[platform].createdAt))
      picked[platform] = build;
  }
  return picked;
}

function highestVersionCode(releases) {
  return Math.max(
    0,
    ...releases.flatMap((release) => (release.versionCodes ?? []).map(Number)),
  );
}

/**
 * The internal release to copy to the closed track: the newest completed one,
 * and only when the closed track does not already carry it or a newer build.
 */
export function releaseToPromote(internalTrack, closedTrack) {
  const newest = (internalTrack?.releases ?? [])
    .filter(
      (release) =>
        release.status === "completed" && release.versionCodes?.length,
    )
    .sort((a, b) => highestVersionCode([b]) - highestVersionCode([a]))[0];
  if (!newest) return null;
  if (
    highestVersionCode([newest]) <=
    highestVersionCode(closedTrack?.releases ?? [])
  )
    return null;

  return {
    ...(newest.name ? { name: newest.name } : {}),
    versionCodes: newest.versionCodes,
    status: "completed",
    ...(newest.releaseNotes ? { releaseNotes: newest.releaseNotes } : {}),
  };
}

/**
 * What an IPA's Expo.plist must say for over-the-air updates to reach it;
 * returns the problems, empty when it is right.
 */
export function iosUpdatesProblems(expoPlist, entries, version) {
  const problems = [];
  if (expoPlist?.EXUpdatesEnabled !== true) problems.push("EXUpdatesEnabled is not true");
  if (expoPlist?.EXUpdatesURL !== UPDATES_URL) problems.push(`EXUpdatesURL is not ${UPDATES_URL}`);
  if (expoPlist?.EXUpdatesRuntimeVersion !== version)
    problems.push(`EXUpdatesRuntimeVersion is ${expoPlist?.EXUpdatesRuntimeVersion}, not ${version}`);
  if (expoPlist?.EXUpdatesRequestHeaders?.["expo-channel-name"] !== UPDATES_CHANNEL)
    problems.push(`the channel is not ${UPDATES_CHANNEL}`);
  if (!entries.some((entry) => /\/EXUpdates\.bundle\/app\.manifest$/.test(entry)))
    problems.push("the embedded update (EXUpdates.bundle/app.manifest) is missing");
  return problems;
}

/**
 * The same for an AAB: its compiled manifest keeps these strings as text, and
 * the embedded update is an asset. The runtime is the string resource, checked
 * against the source by native-config.test.ts.
 */
export function androidUpdatesProblems(manifestText, entries) {
  const problems = [];
  if (!manifestText.includes(UPDATES_URL)) problems.push(`the update URL is not ${UPDATES_URL}`);
  if (!manifestText.includes("expo-channel-name") || !manifestText.includes(UPDATES_CHANNEL))
    problems.push(`the channel is not ${UPDATES_CHANNEL}`);
  if (!entries.includes("base/assets/app.manifest"))
    problems.push("the embedded update (assets/app.manifest) is missing");
  return problems;
}

/**
 * A store build of this version with different native code: its phones would
 * get updates made for other native code. Returns that tag, or null.
 */
export function conflictingStoreBuild(tags, fingerprint) {
  return tags.find((tag) => tag.fingerprint && tag.fingerprint !== fingerprint) ?? null;
}

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signJwt(header, claims, key, algorithm) {
  const unsigned = `${base64url(header)}.${base64url(claims)}`;
  const signature = createSign("SHA256")
    .update(unsigned)
    .sign(algorithm === "ES256" ? { key, dsaEncoding: "ieee-p1363" } : key)
    .toString("base64url");
  return `${unsigned}.${signature}`;
}

async function request(url, init, what) {
  const response = await fetch(url, init);
  const text = await response.text();
  if (!response.ok) {
    const error = new Error(
      `${what} failed (${response.status}): ${text.slice(0, 300)}`,
    );
    error.status = response.status;
    throw error;
  }
  return text ? JSON.parse(text) : null;
}

async function checkAppStoreConnect(ios) {
  const keyPath = expandHome(ios.ascApiKeyPath);
  if (!existsSync(keyPath))
    throw new Error(`App Store Connect API key not found at ${keyPath}.`);

  const now = Math.floor(Date.now() / 1000);
  const token = signJwt(
    { alg: "ES256", kid: ios.ascApiKeyId, typ: "JWT" },
    {
      iss: ios.ascApiKeyIssuerId,
      iat: now,
      exp: now + 600,
      aud: "appstoreconnect-v1",
    },
    createPrivateKey(readFileSync(keyPath)),
    "ES256",
  );
  const app = await request(
    `https://api.appstoreconnect.apple.com/v1/apps/${ios.ascAppId}`,
    { headers: { Authorization: `Bearer ${token}` } },
    "App Store Connect",
  );
  return app.data.attributes.bundleId;
}

/** A Play API client; its token lasts an hour, so make one per step. */
async function googlePlay(android) {
  const keyPath = expandHome(android.serviceAccountKeyPath);
  if (!existsSync(keyPath))
    throw new Error(`Play service account key not found at ${keyPath}.`);

  const account = JSON.parse(readFileSync(keyPath, "utf8"));
  const now = Math.floor(Date.now() / 1000);
  const assertion = signJwt(
    { alg: "RS256", typ: "JWT" },
    {
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/androidpublisher",
      aud: account.token_uri,
      iat: now,
      exp: now + 600,
    },
    account.private_key,
    "RS256",
  );
  const { access_token: accessToken } = await request(
    account.token_uri,
    {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    },
    "Google sign-in",
  );
  const app = `androidpublisher/v3/applications/${ANDROID_PACKAGE}`;
  const authorization = { Authorization: `Bearer ${accessToken}` };

  return {
    email: account.client_email,
    call: (method, path, body) =>
      request(
        `https://androidpublisher.googleapis.com/${app}${path}`,
        {
          method,
          headers: {
            ...authorization,
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        },
        `Google Play ${method} ${path}`,
      ),
    uploadBundle: (editId, bundle) =>
      uploadResumable(
        `https://androidpublisher.googleapis.com/upload/${app}/edits/${editId}/bundles?uploadType=resumable`,
        authorization,
        bundle,
      ),
  };
}

// A multiple of 256 KiB, as resumable uploads require for every chunk but the
// last.
const UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024;

/**
 * Google's resumable upload, in chunks: one request carrying the whole AAB
 * (80+ MB) timed out mid-upload.
 */
async function uploadResumable(url, authorization, bytes) {
  const start = await fetch(url, {
    method: "POST",
    headers: {
      ...authorization,
      "X-Upload-Content-Type": "application/octet-stream",
      "X-Upload-Content-Length": String(bytes.length),
      "Content-Length": "0",
    },
  });
  if (!start.ok)
    throw new Error(
      `Google Play upload start failed (${start.status}): ${(await start.text()).slice(0, 300)}`,
    );
  const session = start.headers.get("location");

  for (let offset = 0; offset < bytes.length; offset += UPLOAD_CHUNK_BYTES) {
    const end = Math.min(offset + UPLOAD_CHUNK_BYTES, bytes.length);
    const response = await fetch(session, {
      method: "PUT",
      // Google answers 308 until the last chunk; it is not a redirect.
      redirect: "manual",
      headers: {
        "Content-Range": `bytes ${offset}-${end - 1}/${bytes.length}`,
      },
      body: bytes.subarray(offset, end),
    });
    if (response.status === 308) continue;
    const text = await response.text();
    if (!response.ok)
      throw new Error(
        `Google Play upload failed at byte ${offset} (${response.status}): ${text.slice(0, 300)}`,
      );
    return JSON.parse(text);
  }
  throw new Error("Google Play upload ended without a final response.");
}

/** Opens and discards an edit: proves the account may release this app. */
async function checkGooglePlay(play) {
  try {
    const edit = await play.call("POST", "/edits");
    await play.call("DELETE", `/edits/${edit.id}`);
  } catch (error) {
    if (error.status !== 401 && error.status !== 403) throw error;
    throw new Error(
      [
        `Google Play rejected ${play.email}.`,
        "In Play Console → Users and permissions, invite that exact address and give it",
        `"Release apps to testing tracks" on ${ANDROID_PACKAGE}. New permissions can take a few minutes.`,
      ].join("\n"),
    );
  }
}

/** Runs one Play edit and commits it; discards it if anything fails. */
async function withEdit(play, change) {
  const edit = await play.call("POST", "/edits");
  try {
    const result = await change(edit.id);
    if (result === null) await play.call("DELETE", `/edits/${edit.id}`);
    else await play.call("POST", `/edits/${edit.id}:commit`);
    return result;
  } catch (error) {
    await play.call("DELETE", `/edits/${edit.id}`).catch(() => {});
    throw error;
  }
}

function uploadToInternalTrack(play, bundle) {
  return withEdit(play, async (editId) => {
    const { versionCode } = await play.uploadBundle(editId, bundle);
    await play.call("PUT", `/edits/${editId}/tracks/${INTERNAL_TRACK}`, {
      track: INTERNAL_TRACK,
      releases: [{ versionCodes: [String(versionCode)], status: "completed" }],
    });
    return versionCode;
  });
}

function promoteToClosedTrack(play) {
  return withEdit(play, async (editId) => {
    const [internal, closed] = await Promise.all(
      [INTERNAL_TRACK, CLOSED_TRACK].map((track) =>
        play.call("GET", `/edits/${editId}/tracks/${track}`),
      ),
    );
    const release = releaseToPromote(internal, closed);
    if (!release) return null;
    await play.call("PUT", `/edits/${editId}/tracks/${CLOSED_TRACK}`, {
      track: CLOSED_TRACK,
      releases: [release],
    });
    return release;
  });
}

function uploadToTestFlight(ipaPath, ios) {
  const keyPath = expandHome(ios.ascApiKeyPath);
  execFileSync(
    "xcrun",
    [
      "altool",
      "--upload-app",
      "--type",
      "ios",
      "--file",
      ipaPath,
      "--apiKey",
      ios.ascApiKeyId,
      "--apiIssuer",
      ios.ascApiKeyIssuerId,
    ],
    {
      // altool finds AuthKey_<id>.p8 by directory, not by path.
      env: { ...process.env, API_PRIVATE_KEYS_DIR: dirname(keyPath) },
      stdio: "inherit",
    },
  );
}

async function download(url, path) {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Download of ${url} failed (${response.status}).`);
  const bytes = Buffer.from(await response.arrayBuffer());
  writeFileSync(path, bytes);
  return bytes;
}

function git(args) {
  return execFileSync("git", args, {
    cwd: MOBILE_DIR,
    encoding: "utf8",
  }).trim();
}

function assertCleanWorkingTree() {
  const changes = git(["status", "--porcelain", "--untracked-files=no"]);
  if (changes)
    throw new Error(
      `Commit or stash these changes first; EAS would ship them:\n${changes}`,
    );
}

function listBuilds() {
  const output = execFileSync(
    "eas",
    ["build:list", "--limit", "10", "--non-interactive", "--json"],
    { cwd: MOBILE_DIR, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  );
  return JSON.parse(output.slice(output.indexOf("[")));
}

async function run() {
  const args = process.argv.slice(2);
  const platform = parsePlatform(args);
  const submit = JSON.parse(readFileSync(join(MOBILE_DIR, "eas.json"), "utf8"))
    .submit.production;
  const withIos = platform !== "android";
  const withAndroid = platform !== "ios";
  const cloud = args.includes("--cloud");

  assertCleanWorkingTree();
  if (!cloud) {
    // A local build copies untracked files too.
    const dirty = dirtyFiles();
    if (dirty.length)
      throw new Error(`Commit or remove these first; the build would ship them:\n${dirty.join("\n")}`);
  }
  if (withIos)
    console.log(
      `OK App Store Connect (${await checkAppStoreConnect(submit.ios)})`,
    );
  if (withAndroid) {
    const play = await googlePlay(submit.android);
    await checkGooglePlay(play);
    console.log(`OK Google Play (${play.email})`);
  }

  const version = currentAppVersion();
  const fingerprints = {};
  for (const target of ["ios", "android"].filter((p) => platform === "all" || p === platform)) {
    fingerprints[target] = await nativeFingerprint(target);
    const conflict = conflictingStoreBuild(listStoreTags(target, version), fingerprints[target]);
    if (conflict)
      throw new Error(
        `${conflict.tag} has other native code under the same version ${version}: its phones would get updates made for this build. Bump VERSION in app.config.ts first.`,
      );
  }
  console.log(`OK version ${version}: no store build of it has other native code`);
  if (args.includes("--check")) return;

  if (cloud) return runCloud(platform, submit);
  return runLocal({ withIos, withAndroid, submit, version, fingerprints });
}

/** Runs `command` with the EAS production env; throws when it fails. */
function easProduction(command, env = {}) {
  const result = spawnSync(
    "eas",
    ["env:exec", "production", command, "--non-interactive"],
    { cwd: MOBILE_DIR, stdio: "inherit", env: { ...process.env, ...env } },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`eas build exited with ${result.status}.`);
}

function zipEntries(file) {
  return execFileSync("unzip", ["-Z1", file], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
    .split("\n")
    .filter(Boolean);
}

function zipEntry(file, entry) {
  return execFileSync("unzip", ["-p", file, entry], { maxBuffer: 64 * 1024 * 1024 });
}

function plistJson(bytes, dir, name) {
  const path = join(dir, name);
  writeFileSync(path, bytes);
  return JSON.parse(execFileSync("plutil", ["-convert", "json", "-o", "-", path], { encoding: "utf8" }));
}

function tagStoreBuild(platform, version, build, fingerprint, commit) {
  const tag = storeTagName(platform, version, build);
  execFileSync(
    "git",
    ["tag", "-a", tag, commit, "-m", formatStoreTagMessage({ runtime: version, fingerprint, commit })],
    { cwd: MOBILE_DIR },
  );
  return tag;
}

/** Builds on this Mac, checks each artifact, uploads it and tags it. */
async function runLocal({ withIos, withAndroid, submit, version, fingerprints }) {
  const commit = git(["rev-parse", "HEAD"]);
  const work = mkdtempSync(join(tmpdir(), "still-deploy-"));
  const failures = [];
  const tags = [];
  try {
    if (withIos) {
      try {
        const ipa = join(work, "still.ipa");
        easProduction(
          `eas build --platform ios --profile production --local --non-interactive --output ${ipa}`,
          { LANG: "en_US.UTF-8", LC_ALL: "en_US.UTF-8" },
        );
        assertCleanWorkingTree();
        const entries = zipEntries(ipa);
        const app = entries.find((entry) => /^Payload\/[^/]+\.app\/Info\.plist$/.test(entry));
        if (!app) throw new Error("the IPA has no app Info.plist");
        const appDir = app.slice(0, -"Info.plist".length);
        const info = plistJson(zipEntry(ipa, app), work, "Info.plist");
        const expo = plistJson(zipEntry(ipa, `${appDir}Expo.plist`), work, "Expo.plist");
        const problems = iosUpdatesProblems(expo, entries, version);
        if (problems.length) throw new Error(`the IPA is not ready for updates: ${problems.join("; ")}`);
        uploadToTestFlight(ipa, submit.ios);
        const tag = tagStoreBuild("ios", version, info.CFBundleVersion, fingerprints.ios, commit);
        tags.push(tag);
        console.log(`TestFlight: ${version} (${info.CFBundleVersion}) uploaded; the internal group gets it once Apple processes it. Tagged ${tag}.`);
      } catch (error) {
        failures.push(`iOS: ${error.message}`);
      }
    }

    if (withAndroid) {
      try {
        const aab = join(work, "still.aab");
        easProduction(
          `eas build --platform android --profile production --local --non-interactive --output ${aab}`,
          {
            JAVA_HOME: process.env.JAVA_HOME ?? "/opt/homebrew/opt/openjdk@17",
            ANDROID_HOME: process.env.ANDROID_HOME ?? join(homedir(), "Library/Android/sdk"),
          },
        );
        assertCleanWorkingTree();
        const problems = androidUpdatesProblems(
          zipEntry(aab, "base/manifest/AndroidManifest.xml").toString("latin1"),
          zipEntries(aab),
        );
        if (problems.length) throw new Error(`the AAB is not ready for updates: ${problems.join("; ")}`);
        const versionCode = await uploadToInternalTrack(
          await googlePlay(submit.android),
          readFileSync(aab),
        );
        const tag = tagStoreBuild("android", version, versionCode, fingerprints.android, commit);
        tags.push(tag);
        console.log(`Play internal testing: ${version} (${versionCode}) live for testers who joined ${INTERNAL_OPT_IN}. Tagged ${tag}.`);
      } catch (error) {
        failures.push(`Android: ${error.message}`);
      }
      try {
        const promoted = await promoteToClosedTrack(await googlePlay(submit.android));
        console.log(
          promoted
            ? `Play closed test "${CLOSED_TRACK}": versionCode ${promoted.versionCodes.join(", ")} sent to Google review.`
            : `Play closed test "${CLOSED_TRACK}" already has the newest internal build.`,
        );
      } catch (error) {
        failures.push(`Android closed test: ${error.message}`);
      }
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }

  if (tags.length) console.log(`Share the store tags: git push origin ${tags.join(" ")}`);
  if (failures.length) throw new Error(failures.join("\n"));
}

async function runCloud(platform, submit) {
  const withIos = platform !== "android";
  const withAndroid = platform !== "ios";
  const commit = git(["rev-parse", "HEAD"]);
  const since = Date.now() - CLOCK_SKEW_MS;
  const build = spawnSync(
    "eas",
    [
      "env:exec",
      "production",
      `eas build --platform ${platform} --profile production --non-interactive`,
      "--non-interactive",
    ],
    { cwd: MOBILE_DIR, stdio: "inherit" },
  );
  if (build.error) throw build.error;

  const builds = pickFinishedBuilds(listBuilds(), { commit, since });
  const downloads = mkdtempSync(join(tmpdir(), "still-deploy-"));
  const failures = [];
  try {
    if (withIos) {
      try {
        if (!builds.ios) throw new Error("the build did not finish on EAS");
        const ipa = join(downloads, "still.ipa");
        await download(builds.ios.artifacts.buildUrl, ipa);
        uploadToTestFlight(ipa, submit.ios);
        console.log(
          `TestFlight: ${builds.ios.appVersion} (${builds.ios.appBuildVersion}) uploaded; the internal group gets it once Apple processes it.`,
        );
      } catch (error) {
        failures.push(`iOS: ${error.message}`);
      }
    }

    if (withAndroid) {
      try {
        if (!builds.android) throw new Error("the build did not finish on EAS");
        const bundle = await download(
          builds.android.artifacts.buildUrl,
          join(downloads, "still.aab"),
        );
        const versionCode = await uploadToInternalTrack(
          await googlePlay(submit.android),
          bundle,
        );
        console.log(
          `Play internal testing: ${builds.android.appVersion} (${versionCode}) live for testers who joined ${INTERNAL_OPT_IN}`,
        );
      } catch (error) {
        failures.push(`Android: ${error.message}`);
      }
      // Runs even if this run's upload failed: it only promotes an internal
      // release newer than what the closed track already has.
      try {
        const promoted = await promoteToClosedTrack(
          await googlePlay(submit.android),
        );
        console.log(
          promoted
            ? `Play closed test "${CLOSED_TRACK}": versionCode ${promoted.versionCodes.join(", ")} sent to Google review.`
            : `Play closed test "${CLOSED_TRACK}" already has the newest internal build.`,
        );
      } catch (error) {
        failures.push(`Android closed test: ${error.message}`);
      }
    }
  } finally {
    rmSync(downloads, { recursive: true, force: true });
  }

  if (build.status !== 0)
    failures.unshift(`eas build exited with ${build.status}.`);
  if (failures.length) throw new Error(failures.join("\n"));
}

const isDirectRun =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectRun) {
  run().catch((error) => {
    console.error(`FAIL deploy:apps\n${error.message}`);
    process.exitCode = 1;
  });
}

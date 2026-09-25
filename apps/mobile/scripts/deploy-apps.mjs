#!/usr/bin/env node

// Ships the production apps to testers with one command. EAS only builds;
// the uploads happen here, because EAS's free submission queue can hold a
// finished build for an hour while the upload itself takes seconds:
// - iOS goes to TestFlight with altool, and the internal group gets every
//   build once Apple processes it;
// - Android goes to Play's internal testing track through the Play API, and
//   the newest internal release is then promoted to the closed "alpha" track
//   so testers who only joined the closed test update too (after review).
// Both store keys are checked before building, so a missing permission fails
// in seconds, not after the builds; `--check` stops right after those checks.

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

const MOBILE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const ANDROID_PACKAGE = "com.still.screentime";
const INTERNAL_TRACK = "internal";
const CLOSED_TRACK = "alpha";
const INTERNAL_OPT_IN =
  "https://play.google.com/apps/internaltest/4701510577558424651";
const PLATFORMS = ["all", "ios", "android"];
// EAS stamps builds with its own clock; allow for drift against this Mac's.
const CLOCK_SKEW_MS = 2 * 60_000;

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
      request(
        `https://androidpublisher.googleapis.com/upload/${app}/edits/${editId}/bundles?uploadType=media`,
        {
          method: "POST",
          headers: {
            ...authorization,
            "Content-Type": "application/octet-stream",
          },
          body: bundle,
        },
        "Google Play bundle upload",
      ),
  };
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

  assertCleanWorkingTree();
  if (withIos)
    console.log(
      `OK App Store Connect (${await checkAppStoreConnect(submit.ios)})`,
    );
  if (withAndroid) {
    const play = await googlePlay(submit.android);
    await checkGooglePlay(play);
    console.log(`OK Google Play (${play.email})`);
  }
  if (args.includes("--check")) return;

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

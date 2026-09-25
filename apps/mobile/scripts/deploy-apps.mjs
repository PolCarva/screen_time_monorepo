#!/usr/bin/env node

// Ships the production apps to testers with one command: EAS builds both
// apps and submits them (iOS to TestFlight, where the internal group gets
// every build; Android to Play's internal testing track), then the newest
// internal Android release is promoted to the closed "alpha" track so testers
// who only joined the closed test update too. Both store keys are checked
// before building, so a missing permission fails in seconds, not after the
// builds; `--check` stops right after those checks.

import { execFileSync, spawnSync } from "node:child_process";
import { createPrivateKey, createSign } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const MOBILE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const ANDROID_PACKAGE = "com.still.screentime";
const CLOSED_TRACK = "alpha";
const INTERNAL_OPT_IN =
  "https://play.google.com/apps/internaltest/4701510577558424651";
const PLATFORMS = ["all", "ios", "android"];

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
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${ANDROID_PACKAGE}`;

  return {
    email: account.client_email,
    call: (method, path, body) =>
      request(
        `${base}${path}`,
        {
          method,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        },
        `Google Play ${method} ${path}`,
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

async function promoteToClosedTrack(play) {
  const edit = await play.call("POST", "/edits");
  try {
    const [internal, closed] = await Promise.all(
      ["internal", CLOSED_TRACK].map((track) =>
        play.call("GET", `/edits/${edit.id}/tracks/${track}`),
      ),
    );
    const release = releaseToPromote(internal, closed);
    if (!release) {
      await play.call("DELETE", `/edits/${edit.id}`);
      return null;
    }
    await play.call("PUT", `/edits/${edit.id}/tracks/${CLOSED_TRACK}`, {
      track: CLOSED_TRACK,
      releases: [release],
    });
    await play.call("POST", `/edits/${edit.id}:commit`);
    return release;
  } catch (error) {
    await play.call("DELETE", `/edits/${edit.id}`).catch(() => {});
    throw error;
  }
}

function assertCleanWorkingTree() {
  const changes = execFileSync(
    "git",
    ["status", "--porcelain", "--untracked-files=no"],
    {
      cwd: MOBILE_DIR,
      encoding: "utf8",
    },
  ).trim();
  if (changes)
    throw new Error(
      `Commit or stash these changes first; EAS would ship them:\n${changes}`,
    );
}

async function run() {
  const args = process.argv.slice(2);
  const platform = parsePlatform(args);
  const submit = JSON.parse(readFileSync(join(MOBILE_DIR, "eas.json"), "utf8"))
    .submit.production;
  const withIos = platform !== "android";
  const withAndroid = platform !== "ios";

  assertCleanWorkingTree();
  const play = withAndroid ? await googlePlay(submit.android) : null;
  if (withIos)
    console.log(
      `OK App Store Connect (${await checkAppStoreConnect(submit.ios)})`,
    );
  if (play) {
    await checkGooglePlay(play);
    console.log(`OK Google Play (${play.email})`);
  }
  if (args.includes("--check")) return;

  const build = spawnSync(
    "eas",
    [
      "env:exec",
      "production",
      `eas build --platform ${platform} --profile production --auto-submit --non-interactive`,
      "--non-interactive",
    ],
    { cwd: MOBILE_DIR, stdio: "inherit" },
  );
  if (build.error) throw build.error;

  // Runs even if one submission failed: it only promotes an internal release
  // that is newer than what the closed track already has.
  if (play) {
    const promoted = await promoteToClosedTrack(play);
    console.log(
      promoted
        ? `Play closed test "${CLOSED_TRACK}": versionCode ${promoted.versionCodes.join(", ")} sent to Google review.`
        : `Play closed test "${CLOSED_TRACK}" already has the newest internal build.`,
    );
    console.log(
      `Play internal testing updates right away for testers who joined ${INTERNAL_OPT_IN}`,
    );
  }
  if (withIos)
    console.log(
      "TestFlight: the internal group gets the build once Apple finishes processing it.",
    );
  if (build.status !== 0)
    throw new Error(`eas build exited with ${build.status}.`);
}

const isDirectRun =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectRun) {
  run().catch((error) => {
    console.error(`FAIL deploy:apps\n${error.message}`);
    process.exitCode = 1;
  });
}

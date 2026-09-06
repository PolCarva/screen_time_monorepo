#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const INTENT_IDENTIFIER = "PauseBeforeOpeningIntent";
const EXPECTED_PARAMETERS = ["appName"];
const EXPECTED_ADMOB_APP_ID = "ca-app-pub-8052007653549292~7920548119";

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

export function verifyShortcutMetadata(metadata) {
  const intent = metadata?.actions?.[INTENT_IDENTIFIER];
  requireValue(
    intent,
    `Missing ${INTENT_IDENTIFIER} from compiled App Intents metadata.`,
  );
  requireValue(
    intent.title?.key === "Pause Before Opening",
    `Unexpected App Intent title: ${intent.title?.key ?? "missing"}.`,
  );
  requireValue(
    intent.isDiscoverable === true,
    `${INTENT_IDENTIFIER} must remain discoverable in Apple Shortcuts.`,
  );
  requireValue(
    intent.openAppWhenRun === false,
    `${INTENT_IDENTIFIER} must not unconditionally open Still.`,
  );
  requireValue(
    intent.supportedModes === 9,
    `${INTENT_IDENTIFIER} must preserve its dynamic foreground execution mode.`,
  );

  const parameters = intent.parameters?.map((parameter) => parameter.name);
  requireValue(
    JSON.stringify(parameters) === JSON.stringify(EXPECTED_PARAMETERS),
    `${INTENT_IDENTIFIER} parameters must be ${EXPECTED_PARAMETERS.join(", ")}; received ${parameters?.join(", ") ?? "none"}.`,
  );

  const summary =
    intent.actionConfiguration?.actionSummary?.wrapper?.summaryString;
  requireValue(
    summary?.formatString === "Pause before opening ${appName}",
    `${INTENT_IDENTIFIER} has an unexpected action summary.`,
  );
  requireValue(
    JSON.stringify(summary?.parameterIdentifiers) ===
      JSON.stringify(EXPECTED_PARAMETERS),
    `${INTENT_IDENTIFIER} summary must reference only the app name.`,
  );

  return intent;
}

export function verifyAdMobApplicationIdentifier(identifier) {
  requireValue(
    identifier === EXPECTED_ADMOB_APP_ID,
    `Expected the production iOS AdMob app id ${EXPECTED_ADMOB_APP_ID}; received ${identifier || "missing"}.`,
  );
}

export function verifyBuiltApp(appBundlePath) {
  const appBundle = resolve(appBundlePath);
  const metadataPath = resolve(
    appBundle,
    "Metadata.appintents/extract.actionsdata",
  );
  const plistPath = resolve(appBundle, "Info.plist");

  let metadata;
  try {
    metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
  } catch (error) {
    throw new Error(
      `Could not read compiled App Intents metadata at ${metadataPath}: ${error.message}`,
    );
  }
  verifyShortcutMetadata(metadata);

  let adMobApplicationIdentifier;
  try {
    adMobApplicationIdentifier = execFileSync(
      "plutil",
      ["-extract", "GADApplicationIdentifier", "raw", plistPath],
      { encoding: "utf8" },
    ).trim();
  } catch (error) {
    throw new Error(
      `Could not read GADApplicationIdentifier from ${plistPath}: ${error.message}`,
    );
  }
  verifyAdMobApplicationIdentifier(adMobApplicationIdentifier);

  return { appBundle, adMobApplicationIdentifier };
}

function usage() {
  return "Usage: pnpm acceptance:ios-shortcuts -- /absolute/path/to/Still.app";
}

function run() {
  const appBundlePath = process.argv.slice(2).find((argument) => argument !== "--");
  if (!appBundlePath) throw new Error(usage());

  const result = verifyBuiltApp(appBundlePath);
  console.log(
    [
      "PASS iOS Shortcuts release metadata",
      `App: ${result.appBundle}`,
      `Intent: ${INTENT_IDENTIFIER}`,
      `AdMob: ${result.adMobApplicationIdentifier}`,
    ].join("\n"),
  );
}

const isDirectRun =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectRun) {
  try {
    run();
  } catch (error) {
    console.error(`FAIL iOS Shortcuts release metadata\n${error.message}`);
    process.exitCode = 1;
  }
}

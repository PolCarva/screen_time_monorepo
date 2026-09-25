#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const INTENT_IDENTIFIER = "PauseAppIntent";
const EXPECTED_PARAMETERS = ["app"];
const APP_ENTITY = "StillAppEntity";
// Kept only so automations made with it keep running; hidden from the library.
const LEGACY_INTENT_IDENTIFIER = "PauseBeforeOpeningIntent";
const EXPECTED_ADMOB_APP_ID = "ca-app-pub-8052007653549292~7920548119";
// Spanish for the action (D12), which the setup guide quotes on Spanish phones.
const STRING_CATALOG = fileURLToPath(
  new URL("../ios/Still/Localizable.xcstrings", import.meta.url),
);
// Siri phrases of the App Shortcuts, in es.lproj/AppShortcuts.strings.
const SPANISH_APP_SHORTCUTS = fileURLToPath(
  new URL("../ios/Still/es.lproj/AppShortcuts.strings", import.meta.url),
);

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function summaryOf(intent) {
  return intent?.actionConfiguration?.actionSummary?.wrapper?.summaryString;
}

function verifyPauseRuns(identifier, intent) {
  requireValue(
    intent.openAppWhenRun === false,
    `${identifier} must not unconditionally open Still.`,
  );
  requireValue(
    intent.supportedModes === 9,
    `${identifier} must preserve its dynamic foreground execution mode.`,
  );
}

export function verifyShortcutMetadata(metadata) {
  const intent = metadata?.actions?.[INTENT_IDENTIFIER];
  requireValue(
    intent,
    `Missing ${INTENT_IDENTIFIER} from compiled App Intents metadata.`,
  );
  requireValue(
    intent.title?.key === "Pause App",
    `Unexpected App Intent title: ${intent.title?.key ?? "missing"}.`,
  );
  requireValue(
    intent.isDiscoverable === true,
    `${INTENT_IDENTIFIER} must remain discoverable in Apple Shortcuts.`,
  );
  verifyPauseRuns(INTENT_IDENTIFIER, intent);

  const parameters = intent.parameters?.map((parameter) => parameter.name);
  requireValue(
    JSON.stringify(parameters) === JSON.stringify(EXPECTED_PARAMETERS),
    `${INTENT_IDENTIFIER} parameters must be ${EXPECTED_PARAMETERS.join(", ")}; received ${parameters?.join(", ") ?? "none"}.`,
  );
  // An app entity is what lets Shortcuts offer one ready-made action per app.
  requireValue(
    intent.parameters[0]?.valueType?.entity?.wrapper?.typeName === APP_ENTITY,
    `${INTENT_IDENTIFIER} must take its app as ${APP_ENTITY}.`,
  );
  requireValue(
    metadata?.queries?.StillAppQuery?.defaultQueryForEntity === true,
    `${APP_ENTITY} must list the apps chosen in Still through StillAppQuery.`,
  );

  const summary = summaryOf(intent);
  requireValue(
    summary?.formatString === "Pause ${app}",
    `${INTENT_IDENTIFIER} has an unexpected action summary.`,
  );

  // Without the parameterized App Shortcut, Shortcuts has no "Pause <App>"
  // tiles and the user is back to picking the app inside the action.
  const readyMade = metadata?.autoShortcuts?.find(
    (shortcut) => shortcut.actionIdentifier === INTENT_IDENTIFIER,
  );
  requireValue(
    readyMade?.phraseTemplates?.some((phrase) =>
      phrase.key?.includes("${app}"),
    ),
    `${INTENT_IDENTIFIER} must be an App Shortcut with the app in its phrase, so each chosen app gets its own action.`,
  );

  const legacy = metadata?.actions?.[LEGACY_INTENT_IDENTIFIER];
  requireValue(
    legacy,
    `${LEGACY_INTENT_IDENTIFIER} must stay in the build: automations made with it still run it.`,
  );
  requireValue(
    legacy.isDiscoverable === false,
    `${LEGACY_INTENT_IDENTIFIER} must stay hidden from the action library.`,
  );
  verifyPauseRuns(LEGACY_INTENT_IDENTIFIER, legacy);
  requireValue(
    JSON.stringify(legacy.parameters?.map((parameter) => parameter.name)) ===
      JSON.stringify(["appName"]) &&
      summaryOf(legacy)?.formatString === "Pause before opening ${appName}",
    `${LEGACY_INTENT_IDENTIFIER} must keep its appName parameter for existing automations.`,
  );

  return intent;
}

/** Every Spanish string of the catalog must reach the built app. */
export function verifySpanishStrings(catalog, built) {
  for (const [key, entry] of Object.entries(catalog?.strings ?? {})) {
    const expected = entry.localizations?.es?.stringUnit?.value;
    requireValue(
      expected && built?.[key] === expected,
      `The build is missing the Spanish for "${key}" (es.lproj/Localizable.strings).`,
    );
  }
}

/** The Spanish Siri phrases of the App Shortcuts must reach the built app. */
export function verifySpanishPhrases(source, built) {
  const keys = Object.keys(source ?? {});
  requireValue(keys.length > 0, "The Spanish App Shortcuts phrases are missing.");
  for (const key of keys) {
    requireValue(
      built?.[key] === source[key],
      `The build is missing the Spanish phrase for "${key}" (es.lproj/AppShortcuts.strings).`,
    );
  }
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

  let spanish;
  try {
    spanish = JSON.parse(
      execFileSync(
        "plutil",
        ["-convert", "json", "-o", "-", resolve(appBundle, "es.lproj/Localizable.strings")],
        { encoding: "utf8" },
      ),
    );
  } catch (error) {
    throw new Error(`Could not read the Spanish strings of ${appBundle}: ${error.message}`);
  }
  verifySpanishStrings(JSON.parse(readFileSync(STRING_CATALOG, "utf8")), spanish);

  let builtPhrases;
  let sourcePhrases;
  try {
    const read = (path) =>
      JSON.parse(
        execFileSync("plutil", ["-convert", "json", "-o", "-", path], {
          encoding: "utf8",
        }),
      );
    builtPhrases = read(resolve(appBundle, "es.lproj/AppShortcuts.strings"));
    sourcePhrases = read(SPANISH_APP_SHORTCUTS);
  } catch (error) {
    throw new Error(`Could not read the Spanish App Shortcuts of ${appBundle}: ${error.message}`);
  }
  verifySpanishPhrases(sourcePhrases, builtPhrases);

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

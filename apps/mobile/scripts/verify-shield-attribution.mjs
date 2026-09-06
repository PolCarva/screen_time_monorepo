#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const STILL_PACKAGE = "com.still.screentime";
const ACCESSIBILITY_SERVICE = `${STILL_PACKAGE}/.StillAccessibilityService`;
const ACCESSIBILITY_SERVICE_EXPANDED = `${STILL_PACKAGE}/${STILL_PACKAGE}.StillAccessibilityService`;
const INTERVENTION_ACTIVITY = `${STILL_PACKAGE}/.InterventionActivity`;
const PREFERENCES_PATH = "shared_prefs/still_restrictions.xml";
const UI_DUMP_PATH = "/sdcard/still-shield-attribution.xml";

const DEFAULT_TARGETS = [
  "com.google.android.gm=Gmail",
  "com.google.android.youtube=YouTube",
];

function decodeXml(value) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function attributes(tag) {
  return Object.fromEntries(
    [...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((match) => [
      match[1],
      decodeXml(match[2]),
    ]),
  );
}

export function parseConnectedDevices(output) {
  return output
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [serial, state] = line.split(/\s+/, 2);
      return { serial, state };
    });
}

export function hasStillAccessibilityService(output) {
  return [ACCESSIBILITY_SERVICE, ACCESSIBILITY_SERVICE_EXPANDED].some(
    (component) => output.includes(component),
  );
}

export function resolvedLaunchComponent(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .findLast((line) => /^[A-Za-z][A-Za-z0-9_.]+\/[A-Za-z0-9_.$]+$/.test(line));
}

export function parseTargetSpec(specification) {
  const separator = specification.indexOf("=");
  if (separator <= 0 || separator === specification.length - 1) {
    throw new Error(
      `Invalid target "${specification}". Use Android.package.name=Visible app label.`,
    );
  }

  const packageName = specification.slice(0, separator).trim();
  const label = specification.slice(separator + 1).trim();
  if (!/^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+$/.test(packageName)) {
    throw new Error(`Invalid Android package name "${packageName}".`);
  }
  if (!label) throw new Error(`Missing visible label for "${packageName}".`);
  return { packageName, label };
}

export function readPreferenceInteger(xml, key) {
  for (const match of xml.matchAll(/<int\b[^>]*\/>/g)) {
    const entry = attributes(match[0]);
    if (entry.name === key) return Number.parseInt(entry.value, 10);
  }
  return 0;
}

export function readPreferenceBoolean(xml, key) {
  for (const match of xml.matchAll(/<boolean\b[^>]*\/>/g)) {
    const entry = attributes(match[0]);
    if (entry.name === key) return entry.value === "true";
  }
  return false;
}

export function readPreferenceStringSet(xml, key) {
  for (const match of xml.matchAll(/<set\b[^>]*>([\s\S]*?)<\/set>/g)) {
    const entry = attributes(match[0].slice(0, match[0].indexOf(">") + 1));
    if (entry.name !== key) continue;
    return [...match[1].matchAll(/<string>([\s\S]*?)<\/string>/g)].map((item) =>
      decodeXml(item[1]),
    );
  }
  return [];
}

export function visibleUiText(xml, packageName) {
  const values = [];
  for (const match of xml.matchAll(/<node\b[^>]*>/g)) {
    const entry = attributes(match[0]);
    if (packageName && entry.package && entry.package !== packageName) continue;
    if (entry.text) values.push(entry.text);
    if (entry["content-desc"]) values.push(entry["content-desc"]);
  }
  return [...new Set(values)].join("\n");
}

export function findControlCenter(xml, packageName, labels) {
  const expected = new Set(labels.map((label) => label.toLocaleLowerCase()));
  for (const match of xml.matchAll(/<node\b[^>]*>/g)) {
    const entry = attributes(match[0]);
    if (packageName && entry.package && entry.package !== packageName) continue;
    const candidates = [entry.text, entry["content-desc"]]
      .filter(Boolean)
      .map((value) => value.trim().toLocaleLowerCase());
    if (!candidates.some((value) => expected.has(value))) continue;

    const bounds = entry.bounds?.match(/^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/);
    if (!bounds) continue;
    const [, left, top, right, bottom] = bounds.map(Number);
    return {
      x: Math.round((left + right) / 2),
      y: Math.round((top + bottom) / 2),
    };
  }
  return null;
}

export function resumedPackage(dumpsys) {
  const line = dumpsys
    .split(/\r?\n/)
    .find((candidate) =>
      /(mResumedActivity|topResumedActivity|ResumedActivity)/.test(candidate),
    );
  return line?.match(/\b([A-Za-z][A-Za-z0-9_.]+)\/[A-Za-z0-9_.$]+/)?.[1];
}

export function isInterventionResumed(dumpsys) {
  return dumpsys
    .split(/\r?\n/)
    .some(
      (line) =>
        /(mResumedActivity|topResumedActivity|ResumedActivity)/.test(line) &&
        line.includes(INTERVENTION_ACTIVITY),
    );
}

export function observedAttemptMatches(text, label, attempt) {
  const normalized = text.toLocaleLowerCase();
  const normalizedLabel = label.toLocaleLowerCase();
  const phrases =
    attempt === 1
      ? [
          `${normalizedLabel} opened once today`,
          `${normalizedLabel} se abrió una vez hoy`,
        ]
      : [
          `${normalizedLabel} opened ${attempt} times today`,
          `${normalizedLabel} se abrió ${attempt} veces hoy`,
        ];
  return phrases.some((phrase) => normalized.includes(phrase));
}

function runAdb(arguments_, { quiet = false } = {}) {
  try {
    return execFileSync("adb", arguments_, {
      encoding: "utf8",
      stdio: quiet ? ["ignore", "pipe", "pipe"] : ["ignore", "pipe", "pipe"],
      timeout: 20_000,
    }).trim();
  } catch (error) {
    const details = [error.stdout, error.stderr]
      .filter(Boolean)
      .map((value) => value.toString().trim())
      .filter(Boolean)
      .join("\n");
    throw new Error(
      `adb ${arguments_.join(" ")} failed${details ? `:\n${details}` : "."}`,
    );
  }
}

function deviceAdb(serial, arguments_, options) {
  return runAdb(["-s", serial, ...arguments_], options);
}

function readPreferences(serial) {
  try {
    return deviceAdb(serial, [
      "exec-out",
      "run-as",
      STILL_PACKAGE,
      "cat",
      PREFERENCES_PATH,
    ]);
  } catch (error) {
    throw new Error(
      `${error.message}\nInstall a debuggable Still build so the gate can verify its per-app counters.`,
    );
  }
}

function attemptKey(day, packageName) {
  return `app_open_attempts:${day}:${packageName}`;
}

function avoidedKey(day, packageName) {
  return `app_avoided_opens:${day}:${packageName}`;
}

async function waitForPreference(serial, key, expected) {
  const deadline = Date.now() + 8_000;
  let actual = 0;
  while (Date.now() < deadline) {
    actual = readPreferenceInteger(readPreferences(serial), key);
    if (actual === expected) return;
    await delay(250);
  }
  throw new Error(`Expected ${key}=${expected}, received ${actual}.`);
}

async function waitForShield(serial, target, forbiddenLabel, expectedAttempt) {
  const deadline = Date.now() + 12_000;
  let lastActivity = "";
  let lastText = "";
  let lastXml = "";

  while (Date.now() < deadline) {
    lastActivity = deviceAdb(serial, [
      "shell",
      "dumpsys",
      "activity",
      "activities",
    ]);
    if (isInterventionResumed(lastActivity)) {
      try {
        deviceAdb(serial, ["shell", "uiautomator", "dump", UI_DUMP_PATH], {
          quiet: true,
        });
        lastXml = deviceAdb(serial, ["exec-out", "cat", UI_DUMP_PATH]);
        lastText = visibleUiText(lastXml, STILL_PACKAGE);
        const normalized = lastText.toLocaleLowerCase();
        if (observedAttemptMatches(lastText, target.label, expectedAttempt)) {
          if (normalized.includes(forbiddenLabel.toLocaleLowerCase())) {
            throw new Error(
              `Shield for ${target.label} still exposes the previous label ${forbiddenLabel}.`,
            );
          }
          return { text: lastText, xml: lastXml };
        }
      } catch (error) {
        if (error.message.includes("still exposes the previous label"))
          throw error;
      }
    }
    await delay(350);
  }

  throw new Error(
    [
      `Shield did not show ${target.label} attempt ${expectedAttempt} within 12 seconds.`,
      `Intervention activity resumed: ${isInterventionResumed(lastActivity)}`,
      lastText
        ? `Visible text:\n${lastText.slice(0, 1_500)}`
        : "No UI text captured.",
    ].join("\n"),
  );
}

async function waitForResumedPackage(serial, expectedPackage) {
  const deadline = Date.now() + 8_000;
  let actual;
  while (Date.now() < deadline) {
    const activities = deviceAdb(serial, [
      "shell",
      "dumpsys",
      "activity",
      "activities",
    ]);
    actual = resumedPackage(activities);
    if (actual === expectedPackage) return;
    await delay(250);
  }
  throw new Error(
    `Expected ${expectedPackage} to be resumed after Go back; received ${actual ?? "none"}.`,
  );
}

function ensureInstalled(serial, packageName) {
  const path = deviceAdb(serial, ["shell", "pm", "path", packageName], {
    quiet: true,
  });
  if (!path.startsWith("package:")) {
    throw new Error(`${packageName} is not installed on ${serial}.`);
  }
}

function launchComponent(serial, packageName) {
  const resolved = deviceAdb(serial, [
    "shell",
    "cmd",
    "package",
    "resolve-activity",
    "--brief",
    "-a",
    "android.intent.action.MAIN",
    "-c",
    "android.intent.category.LAUNCHER",
    packageName,
  ]);
  const component = resolvedLaunchComponent(resolved);
  if (!component) {
    throw new Error(`Could not resolve a launcher activity for ${packageName}.`);
  }
  deviceAdb(
    serial,
    [
      "shell",
      "am",
      "start",
      "-W",
      "-a",
      "android.intent.action.MAIN",
      "-c",
      "android.intent.category.LAUNCHER",
      "-p",
      packageName,
    ],
    { quiet: true },
  );
}

async function run() {
  const targets = (
    process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_TARGETS
  ).map(parseTargetSpec);
  if (targets.length !== 2) {
    throw new Error("Exactly two distinct target apps are required.");
  }
  if (targets[0].packageName === targets[1].packageName) {
    throw new Error("The two target apps must have different package names.");
  }

  const connected = parseConnectedDevices(runAdb(["devices", "-l"]));
  const ready = connected.filter((device) => device.state === "device");
  if (ready.length !== 1) {
    const summary = connected.length
      ? connected
          .map((device) => `${device.serial} (${device.state})`)
          .join(", ")
      : "none";
    throw new Error(
      `Expected one authorized Android device; found ${summary}.`,
    );
  }

  const [{ serial }] = ready;
  ensureInstalled(serial, STILL_PACKAGE);
  for (const target of targets) ensureInstalled(serial, target.packageName);

  const services = deviceAdb(serial, [
    "shell",
    "settings",
    "get",
    "secure",
    "enabled_accessibility_services",
  ]);
  if (!hasStillAccessibilityService(services)) {
    throw new Error(
      "Still Accessibility must be enabled before running this gate.",
    );
  }

  const before = readPreferences(serial);
  if (!readPreferenceBoolean(before, "restrictions_enabled")) {
    throw new Error("Still restrictions are disabled on the connected device.");
  }
  const selected = readPreferenceStringSet(before, "selected_packages");
  for (const target of targets) {
    if (!selected.includes(target.packageName)) {
      throw new Error(
        `${target.label} (${target.packageName}) is not selected in Still.`,
      );
    }
  }

  const day = new Date().toISOString().slice(0, 10);
  const attemptBaseline = new Map(
    targets.map((target) => [
      target.packageName,
      readPreferenceInteger(before, attemptKey(day, target.packageName)),
    ]),
  );
  const avoidedBaseline = new Map(
    targets.map((target) => [
      target.packageName,
      readPreferenceInteger(before, avoidedKey(day, target.packageName)),
    ]),
  );
  const homeComponent = deviceAdb(serial, [
    "shell",
    "cmd",
    "package",
    "resolve-activity",
    "--brief",
    "-a",
    "android.intent.action.MAIN",
    "-c",
    "android.intent.category.HOME",
  ])
    .split(/\r?\n/)
    .at(-1);
  const homePackage = homeComponent?.split("/", 1)[0];
  if (!homePackage?.includes(".")) {
    throw new Error(`Could not resolve the Android launcher: ${homeComponent}`);
  }

  console.log(`Device: ${serial}`);
  console.log(
    `Attempt baseline: ${targets.map((target) => `${target.label}=${attemptBaseline.get(target.packageName)}`).join(", ")}`,
  );

  try {
    for (let index = 0; index < targets.length; index += 1) {
      const target = targets[index];
      const previous = targets[index === 0 ? 1 : 0];
      const expected = attemptBaseline.get(target.packageName) + 1;

      deviceAdb(serial, ["shell", "am", "force-stop", target.packageName], {
        quiet: true,
      });
      launchComponent(serial, target.packageName);

      const shield = await waitForShield(
        serial,
        target,
        previous.label,
        expected,
      );
      await waitForPreference(
        serial,
        attemptKey(day, target.packageName),
        expected,
      );
      console.log(
        `PASS ${target.label}: Shield label and per-app attempt ${expected}`,
      );

      if (index === 0) {
        // Leave InterventionActivity alive so the second launch exercises its
        // singleTop/onNewIntent target refresh, which caused the original bug.
        deviceAdb(serial, ["shell", "input", "keyevent", "KEYCODE_HOME"], {
          quiet: true,
        });
        await delay(600);
      } else {
        const goBack = findControlCenter(shield.xml, STILL_PACKAGE, [
          "Go back",
          "Volver",
        ]);
        if (!goBack) {
          throw new Error("The visible Go back/Volver control was not found.");
        }
        deviceAdb(
          serial,
          ["shell", "input", "tap", String(goBack.x), String(goBack.y)],
          { quiet: true },
        );
        await waitForResumedPackage(serial, homePackage);
        await waitForPreference(
          serial,
          avoidedKey(day, target.packageName),
          avoidedBaseline.get(target.packageName) + 1,
        );
        console.log(
          `PASS ${target.label}: Go back returned Home and recorded one app-specific avoided open`,
        );
      }
    }
  } finally {
    deviceAdb(serial, ["shell", "input", "keyevent", "KEYCODE_HOME"], {
      quiet: true,
    });
  }

  const after = readPreferences(serial);
  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];
    const expectedAttempts = attemptBaseline.get(target.packageName) + 1;
    const actualAttempts = readPreferenceInteger(
      after,
      attemptKey(day, target.packageName),
    );
    if (actualAttempts !== expectedAttempts) {
      throw new Error(
        `${target.label} attempts ended at ${actualAttempts}; expected ${expectedAttempts}.`,
      );
    }

    const expectedAvoided =
      avoidedBaseline.get(target.packageName) + (index === 1 ? 1 : 0);
    const actualAvoided = readPreferenceInteger(
      after,
      avoidedKey(day, target.packageName),
    );
    if (actualAvoided !== expectedAvoided) {
      throw new Error(
        `${target.label} avoided opens ended at ${actualAvoided}; expected ${expectedAvoided}.`,
      );
    }
  }

  console.log(
    "PASS Shield attribution and Go back: app metrics stayed independent.",
  );
}

const isDirectRun =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectRun) {
  run().catch((error) => {
    console.error(`FAIL Shield attribution\n${error.message}`);
    process.exitCode = 1;
  });
}

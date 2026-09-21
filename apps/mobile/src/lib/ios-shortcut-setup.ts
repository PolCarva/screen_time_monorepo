/**
 * How Still walks the user through connecting Apple Shortcuts. The easier
 * tiers depend on iOS behaviour that can only be confirmed on a physical
 * device (docs/ios-shortcuts-v2-plan.md, section 10). Each one stays switched
 * off here until its hypothesis is recorded as validated, and the user simply
 * falls to the next tier: no other code changes.
 */

/**
 * H2. iCloud link of a shortcut that already contains the "App is opened"
 * trigger and Still's action (shareable since iOS 27). Empty = tier disabled.
 */
export const IOS_SHORTCUT_IMPORT_URL = "";

/**
 * H1. One automation for every app, using "Get Current App" (iOS 18.2+) to
 * tell Still which app was opened. false = tier disabled.
 */
export const IOS_SINGLE_AUTOMATION_ENABLED = false;

/** iCloud link of the one-action helper shortcut "Go to Home Screen". Optional. */
export const IOS_HOME_SHORTCUT_IMPORT_URL = "";

/** Name of the imported shortcut, used to deep-link into it for edits and repairs. */
export const PAUSE_SHORTCUT_NAME = "Still - Pausa";

/** How long Still waits for the automation to fire before calling a test failed. */
export const SETUP_PROBE_GRACE_MS = 6_000;

export type SetupTier = "import" | "single_automation" | "per_app";

export type SetupStepId =
  | "import_add"
  | "import_choose_apps"
  | "import_enable"
  | "automation_new"
  | "automation_pick_apps"
  | "automation_pick_one_app"
  | "automation_run_immediately"
  | "action_current_app"
  | "action_pause_current"
  | "action_pause_named"
  | "return_shortcut";

export type RepairCauseId =
  | "toggle_off"
  | "app_missing_in_trigger"
  | "not_run_immediately"
  | "wrong_app_in_action"
  | "shortcut_deleted"
  | "just_rebooted";

export type ProbeResult = "waiting" | "connected" | "not_detected";

export function parseIosVersion(version: string | number): {
  major: number;
  minor: number;
} {
  const [major = "0", minor = "0"] = String(version).split(".");
  const parsedMajor = Number.parseInt(major, 10);
  const parsedMinor = Number.parseInt(minor, 10);
  return {
    major: Number.isFinite(parsedMajor) ? parsedMajor : 0,
    minor: Number.isFinite(parsedMinor) ? parsedMinor : 0,
  };
}

/** Only Apple's own sharing host may be opened as an import link. */
export function isTrustedImportUrl(url: string): boolean {
  return /^https:\/\/www\.icloud\.com\/shortcuts\/[A-Za-z0-9]+\/?$/.test(url);
}

export function resolveSetupTier(input: {
  iosVersion: string | number;
  importUrl?: string;
  singleAutomationEnabled?: boolean;
}): SetupTier {
  const { major, minor } = parseIosVersion(input.iosVersion);
  const importUrl = input.importUrl ?? IOS_SHORTCUT_IMPORT_URL;
  const single = input.singleAutomationEnabled ?? IOS_SINGLE_AUTOMATION_ENABLED;
  if (major >= 27 && isTrustedImportUrl(importUrl)) return "import";
  if (single && (major > 18 || (major === 18 && minor >= 2)))
    return "single_automation";
  return "per_app";
}

/**
 * `needsReturnShortcut` is true when at least one chosen app has no URL scheme
 * Still can open, so the user must also create its `Still - <App>` shortcut.
 */
export function setupSteps(
  tier: SetupTier,
  options: { needsReturnShortcut: boolean },
): SetupStepId[] {
  const steps: SetupStepId[] =
    tier === "import"
      ? ["import_add", "import_choose_apps", "import_enable"]
      : tier === "single_automation"
        ? [
            "automation_new",
            "automation_pick_apps",
            "automation_run_immediately",
            "action_current_app",
            "action_pause_current",
          ]
        : [
            "automation_new",
            "automation_pick_one_app",
            "automation_run_immediately",
            "action_pause_named",
          ];
  return options.needsReturnShortcut ? [...steps, "return_shortcut"] : steps;
}

/** Most likely cause first, so a non-technical user can stop at the first hit. */
export function repairCauses(tier: SetupTier): RepairCauseId[] {
  if (tier === "per_app")
    return [
      "toggle_off",
      "not_run_immediately",
      "wrong_app_in_action",
      "shortcut_deleted",
      "just_rebooted",
    ];
  return [
    "toggle_off",
    "app_missing_in_trigger",
    "not_run_immediately",
    "shortcut_deleted",
    "just_rebooted",
  ];
}

/**
 * iOS cannot tell Still whether an automation exists. The only proof is the
 * App Intent running, so a test passes when it fired after the test started.
 */
export function probeResult(input: {
  startedAt: number;
  lastTriggeredAt?: string | null;
  now: number;
}): ProbeResult {
  const fired = input.lastTriggeredAt ? Date.parse(input.lastTriggeredAt) : NaN;
  // Native timestamps have second precision; allow for that rounding.
  if (Number.isFinite(fired) && fired >= input.startedAt - 1_000)
    return "connected";
  return input.now - input.startedAt >= SETUP_PROBE_GRACE_MS
    ? "not_detected"
    : "waiting";
}

export type RelativeAge = {
  unit: "now" | "minutes" | "hours" | "days";
  value: number;
};

/** "Last pause 2 h ago": enough precision to tell a live automation from a stale one. */
export function relativeAge(
  iso: string | null | undefined,
  now: number,
): RelativeAge | null {
  const then = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(then)) return null;
  const minutes = Math.max(0, Math.floor((now - then) / 60_000));
  if (minutes < 1) return { unit: "now", value: 0 };
  if (minutes < 60) return { unit: "minutes", value: minutes };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { unit: "hours", value: hours };
  return { unit: "days", value: Math.floor(hours / 24) };
}

export function shortcutsOpenUrl(shortcutName: string): string {
  return `shortcuts://open-shortcut?name=${encodeURIComponent(shortcutName)}`;
}

export const SHORTCUTS_CREATE_URL = "shortcuts://create-shortcut";
export const SHORTCUTS_APP_URL = "shortcuts://";

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
 * tell Still which app was opened. This is what lets the user pick from their
 * real apps in Shortcuts' own chooser instead of typing a name in Still.
 *
 * Verified on the iOS 26.0 simulator: the trigger accepts several apps and the
 * "Current App" variable hands Still the app's real display name, which the
 * intent adopts. Not yet observed on a device: that the variable names the app
 * that fired the trigger. If it does not, set this to false (everyone falls
 * back to one automation per app) or let users switch from the setup screen.
 */
export const IOS_SINGLE_AUTOMATION_ENABLED = true;

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
  // Single-automation tier: the app comes from Shortcuts' "Current App".
  | "select_all_apps"
  | "add_current_app"
  | "open_variables"
  | "pick_current_app"
  | "check_result"
  // Per-app tier: one step per tap, each backed by a real capture of Shortcuts.
  | "pick_app_trigger"
  | "tap_choose"
  | "select_app"
  | "run_immediately"
  | "create_new_shortcut"
  | "search_actions"
  | "add_still_action"
  | "pick_app_name"
  | "save_automation"
  | "return_open_app"
  | "return_choose_app"
  | "return_rename";

/**
 * Where tapping a step's picture takes the user. Shortcuts has no URL for the
 * middle of its "new automation" sheet, so only the entry points are exact;
 * `resume` just brings Shortcuts back, which keeps the sheet where it was left.
 */
export type GuideLink =
  | "create_automation"
  | "create_shortcut"
  | "automations"
  | "resume";

export type GuideStep = {
  id: SetupStepId;
  /** File name in assets/shortcut-guide without extension; null = drawn mock-up. */
  image: string | null;
  link: GuideLink;
};

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
  /** The user asked for one automation per app, e.g. because the other tier failed. */
  preferPerApp?: boolean;
}): SetupTier {
  if (input.preferPerApp) return "per_app";
  const { major, minor } = parseIosVersion(input.iosVersion);
  const importUrl = input.importUrl ?? IOS_SHORTCUT_IMPORT_URL;
  const single = input.singleAutomationEnabled ?? IOS_SINGLE_AUTOMATION_ENABLED;
  if (major >= 27 && isTrustedImportUrl(importUrl)) return "import";
  if (single && (major > 18 || (major === 18 && minor >= 2)))
    return "single_automation";
  return "per_app";
}

const PER_APP_STEPS: readonly GuideStep[] = [
  { id: "pick_app_trigger", image: "auto-01-app-trigger", link: "create_automation" },
  { id: "tap_choose", image: "auto-02-choose", link: "resume" },
  { id: "select_app", image: "auto-03-pick-app", link: "resume" },
  { id: "run_immediately", image: "auto-04-run-immediately", link: "resume" },
  { id: "create_new_shortcut", image: "auto-05-create-new", link: "resume" },
  { id: "search_actions", image: "auto-06-search-actions", link: "resume" },
  { id: "add_still_action", image: "auto-07-pick-action", link: "resume" },
  { id: "pick_app_name", image: "auto-08-pick-name", link: "resume" },
  { id: "save_automation", image: "auto-09-save", link: "resume" },
];

const SINGLE_AUTOMATION_STEPS: readonly GuideStep[] = [
  { id: "pick_app_trigger", image: "auto-01-app-trigger", link: "create_automation" },
  { id: "tap_choose", image: "auto-02-choose", link: "resume" },
  { id: "select_all_apps", image: "auto-03-pick-app", link: "resume" },
  { id: "run_immediately", image: "auto-04-run-immediately", link: "resume" },
  { id: "create_new_shortcut", image: "auto-05-create-new", link: "resume" },
  { id: "add_current_app", image: "single-01-current-app", link: "resume" },
  { id: "search_actions", image: "auto-06-search-actions", link: "resume" },
  { id: "add_still_action", image: "auto-07-pick-action", link: "resume" },
  { id: "open_variables", image: "single-02-variables", link: "resume" },
  { id: "pick_current_app", image: "single-03-pick-current-app", link: "resume" },
  { id: "check_result", image: "single-04-result", link: "resume" },
];

const RETURN_SHORTCUT_STEPS: readonly GuideStep[] = [
  { id: "return_open_app", image: "return-01-open-app", link: "create_shortcut" },
  { id: "return_choose_app", image: "return-02-choose-app", link: "resume" },
  { id: "return_rename", image: "return-03-rename", link: "resume" },
];

/**
 * `needsReturnShortcut` is true when at least one chosen app has no URL scheme
 * Still can open, so the user must also create its `Still - <App>` shortcut.
 */
export function guideSteps(
  tier: SetupTier,
  options: { needsReturnShortcut: boolean },
): GuideStep[] {
  const steps: GuideStep[] =
    tier === "import"
      ? [
          { id: "import_add", image: null, link: "resume" },
          { id: "import_choose_apps", image: null, link: "resume" },
          { id: "import_enable", image: null, link: "resume" },
        ]
      : tier === "single_automation"
        ? [...SINGLE_AUTOMATION_STEPS]
        : [...PER_APP_STEPS];
  return options.needsReturnShortcut
    ? [...steps, ...RETURN_SHORTCUT_STEPS]
    : steps;
}

export function setupSteps(
  tier: SetupTier,
  options: { needsReturnShortcut: boolean },
): SetupStepId[] {
  return guideSteps(tier, options).map((step) => step.id);
}

/** Most likely cause first, so a non-technical user can stop at the first hit. */
export function repairCauses(tier: SetupTier): RepairCauseId[] {
  if (tier === "per_app")
    return [
      // Saving the trigger without Still's action is the easiest mistake to
      // make by hand, and Shortcuts shows it plainly as "No actions".
      "wrong_app_in_action",
      "toggle_off",
      "not_run_immediately",
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
/**
 * Opens the "new personal automation" trigger list and the Automation tab.
 * Apple does not document these two; they were verified on iOS 26.0. Callers
 * must fall back to `SHORTCUTS_APP_URL` when they fail to open.
 */
export const SHORTCUTS_CREATE_AUTOMATION_URL = "shortcuts://create-automation";
export const SHORTCUTS_AUTOMATIONS_URL = "shortcuts://automations";

export function guideLinkUrl(link: GuideLink): string {
  switch (link) {
    case "create_automation":
      return SHORTCUTS_CREATE_AUTOMATION_URL;
    case "create_shortcut":
      return SHORTCUTS_CREATE_URL;
    case "automations":
      return SHORTCUTS_AUTOMATIONS_URL;
    case "resume":
      return SHORTCUTS_APP_URL;
  }
}

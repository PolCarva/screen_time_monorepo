import { describe, expect, it } from "vitest";

import {
  GUIDE_SCREEN_IDS,
  IOS_HOME_SHORTCUT_IMPORT_URL,
  IOS_SHORTCUT_IMPORT_URL,
  SETUP_PROBE_GRACE_MS,
  setupProbeGraceMs,
  guideLinkUrl,
  guideSteps,
  hasReadyActions,
  isTrustedImportUrl,
  parseIosVersion,
  probeResult,
  relativeAge,
  repairCauses,
  resolveSetupTier,
  setupSteps,
  shortcutsOpenUrl,
} from "./ios-shortcut-setup";

const importUrl = "https://www.icloud.com/shortcuts/0123456789abcdef";

describe("iOS Shortcuts setup tiers", () => {
  it("keeps the import tier off until its link exists and sets up one app at a time", () => {
    // H2 (shared shortcut with a trigger) has no link yet.
    expect(IOS_SHORTCUT_IMPORT_URL).toBe("");
    expect(IOS_HOME_SHORTCUT_IMPORT_URL).toBe("");
    // No "Get Current App" and no variables: one automation per app, one sec
    // style, whose action arrives with the app already in it.
    for (const version of ["27.0", "26.0", "18.2", "17.0", "16.4"])
      expect(resolveSetupTier({ iosVersion: version })).toBe("per_app");
  });

  it("offers Still's action ready made from iOS 17, where App Shortcuts take a parameter", () => {
    expect(hasReadyActions("17.0")).toBe(true);
    expect(hasReadyActions("27.1")).toBe(true);
    expect(hasReadyActions("16.4")).toBe(false);
  });

  it("parses the versions React Native reports", () => {
    expect(parseIosVersion("27.0")).toEqual({ major: 27, minor: 0 });
    expect(parseIosVersion("18.2.1")).toEqual({ major: 18, minor: 2 });
    expect(parseIosVersion(17)).toEqual({ major: 17, minor: 0 });
    expect(parseIosVersion("beta")).toEqual({ major: 0, minor: 0 });
  });

  it("offers the one-tap import only on iOS 27+ with a trusted link", () => {
    expect(resolveSetupTier({ iosVersion: "27.1", importUrl })).toBe("import");
    expect(resolveSetupTier({ iosVersion: "26.4", importUrl })).toBe("per_app");
    expect(
      resolveSetupTier({
        iosVersion: "27.0",
        importUrl: "https://evil.example/shortcuts/abc",
      }),
    ).toBe("per_app");
  });

  it("only trusts Apple's shortcut sharing host", () => {
    expect(isTrustedImportUrl(importUrl)).toBe(true);
    expect(isTrustedImportUrl("")).toBe(false);
    expect(isTrustedImportUrl("http://www.icloud.com/shortcuts/abc")).toBe(false);
    expect(isTrustedImportUrl("https://www.icloud.com.evil.dev/shortcuts/abc")).toBe(
      false,
    );
    expect(isTrustedImportUrl("https://www.icloud.com/shortcuts/abc?x=1")).toBe(
      false,
    );
  });
});

describe("iOS Shortcuts setup steps", () => {
  it("needs three taps to import and never asks for typing", () => {
    expect(setupSteps("import", { needsReturnShortcut: false })).toEqual([
      "import_add",
      "import_choose_apps",
      "import_enable",
    ]);
  });

  it("drops the return shortcut for apps Still can reopen by itself", () => {
    const withScheme = setupSteps("per_app", { needsReturnShortcut: false });
    expect(withScheme.some((id) => id.startsWith("return_"))).toBe(false);
    const withReturn = setupSteps("per_app", { needsReturnShortcut: true });
    expect(withReturn.slice(-3)).toEqual([
      "return_open_app",
      "return_choose_app",
      "return_rename",
    ]);
  });

  it("walks the per-app automation one tap at a time, in Shortcuts' own order", () => {
    const steps = setupSteps("per_app", { needsReturnShortcut: false });
    expect(steps).toEqual([
      "pick_app_trigger",
      "tap_choose",
      "select_app",
      "run_immediately",
      "create_new_shortcut",
      "search_actions",
      "add_still_action",
      "save_automation",
    ]);
    // Still's action comes with the app in it: nothing to pick, type or wire.
    expect(steps.join()).not.toMatch(/pick_app_name|current_app|variables/);
  });

  it("lists repair causes with the most likely one first", () => {
    expect(repairCauses("import")[0]).toBe("toggle_off");
    expect(repairCauses("import")).toContain("app_missing_in_trigger");
    expect(repairCauses("per_app")).toContain("wrong_app_in_action");
    expect(repairCauses("per_app")).not.toContain("app_missing_in_trigger");
  });

  it("deep-links into the imported shortcut by name", () => {
    expect(shortcutsOpenUrl("Still - Pausa")).toBe(
      "shortcuts://open-shortcut?name=Still%20-%20Pausa",
    );
  });
});

describe("setup test result", () => {
  const startedAt = Date.parse("2026-09-20T10:00:00.000Z");

  it("passes only when the automation fired after the test started", () => {
    expect(
      probeResult({
        startedAt,
        lastTriggeredAt: "2026-09-20T10:00:03Z",
        now: startedAt + 4_000,
      }),
    ).toBe("connected");
    expect(
      probeResult({
        startedAt,
        lastTriggeredAt: "2026-09-20T09:12:00Z",
        now: startedAt + SETUP_PROBE_GRACE_MS,
      }),
    ).toBe("not_detected");
  });

  it("tolerates the second-level precision of native timestamps", () => {
    expect(
      probeResult({
        startedAt: startedAt + 600,
        lastTriggeredAt: "2026-09-20T10:00:00Z",
        now: startedAt + 700,
      }),
    ).toBe("connected");
  });

  it("keeps waiting during the grace period and fails after it", () => {
    expect(probeResult({ startedAt, now: startedAt + 1_000 })).toBe("waiting");
    expect(
      probeResult({ startedAt, now: startedAt + SETUP_PROBE_GRACE_MS }),
    ).toBe("not_detected");
  });

  it("waits longer below iOS 26, where Apple asks to continue in Still first", () => {
    expect(setupProbeGraceMs("18.5")).toBe(20_000);
    expect(setupProbeGraceMs(17)).toBe(20_000);
    expect(setupProbeGraceMs("26.0")).toBe(8_000);
    expect(setupProbeGraceMs("27.1")).toBe(8_000);
    expect(
      probeResult({ startedAt, now: startedAt + 10_000, graceMs: setupProbeGraceMs("18.5") }),
    ).toBe("waiting");
  });
});

describe("last pause age", () => {
  const now = Date.parse("2026-09-20T12:00:00Z");

  it("rounds down to the largest useful unit", () => {
    expect(relativeAge("2026-09-20T11:59:40Z", now)).toEqual({
      unit: "now",
      value: 0,
    });
    expect(relativeAge("2026-09-20T11:18:00Z", now)).toEqual({
      unit: "minutes",
      value: 42,
    });
    expect(relativeAge("2026-09-20T09:30:00Z", now)).toEqual({
      unit: "hours",
      value: 2,
    });
    expect(relativeAge("2026-09-17T12:00:00Z", now)).toEqual({
      unit: "days",
      value: 3,
    });
  });

  it("has nothing to say about an app whose automation never fired", () => {
    expect(relativeAge(undefined, now)).toBeNull();
    expect(relativeAge("not a date", now)).toBeNull();
  });

  it("never reports a negative age when clocks disagree", () => {
    expect(relativeAge("2026-09-20T12:05:00Z", now)).toEqual({
      unit: "now",
      value: 0,
    });
  });
});

describe("guide pictures and jump links", () => {
  const perApp = guideSteps("per_app", { needsReturnShortcut: true });

  it("backs every step with a screen drawn in code, and draws nothing unused", () => {
    const known = new Set<string>(GUIDE_SCREEN_IDS);
    for (const step of perApp) {
      expect(step.screen, step.id).not.toBeNull();
      expect(known.has(step.screen!), step.id).toBe(true);
    }
    expect(new Set(perApp.map((step) => step.screen)).size).toBe(perApp.length);
    expect(new Set(perApp.map((step) => step.screen))).toEqual(known);
  });

  it("jumps to the exact Shortcuts screen only where iOS has a link for it", () => {
    const byId = Object.fromEntries(perApp.map((step) => [step.id, step.link]));
    expect(byId.pick_app_trigger).toBe("create_automation");
    expect(byId.return_open_app).toBe("create_shortcut");
    // Everything else happens inside a sheet no URL can reach: resume instead
    // of restarting the flow the user is in the middle of.
    const others = perApp.filter(
      (step) =>
        step.id !== "pick_app_trigger" && step.id !== "return_open_app",
    );
    expect(others.every((step) => step.link === "resume")).toBe(true);
  });

  it("maps every link to a Shortcuts URL and nothing else", () => {
    expect(guideLinkUrl("create_automation")).toBe(
      "shortcuts://create-automation",
    );
    expect(guideLinkUrl("create_shortcut")).toBe("shortcuts://create-shortcut");
    expect(guideLinkUrl("automations")).toBe("shortcuts://automations");
    expect(guideLinkUrl("resume")).toBe("shortcuts://");
  });

  it("keeps the step that connects the app to Still", () => {
    // An automation saved without it shows up as "No actions" and does nothing.
    expect(perApp.map((step) => step.id)).toContain("add_still_action");
  });
});

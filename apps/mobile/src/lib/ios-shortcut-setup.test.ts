/// <reference types="node" />

import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  IOS_HOME_SHORTCUT_IMPORT_URL,
  IOS_SHORTCUT_IMPORT_URL,
  IOS_SINGLE_AUTOMATION_ENABLED,
  SETUP_PROBE_GRACE_MS,
  guideLinkUrl,
  guideSteps,
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
  it("ships with the unvalidated tiers switched off", () => {
    // Flip these only after H1/H2 are recorded as validated in
    // docs/ios-shortcuts-v2-plan.md section 10.
    expect(IOS_SHORTCUT_IMPORT_URL).toBe("");
    expect(IOS_SINGLE_AUTOMATION_ENABLED).toBe(false);
    expect(IOS_HOME_SHORTCUT_IMPORT_URL).toBe("");
    expect(resolveSetupTier({ iosVersion: "27.0" })).toBe("per_app");
    expect(resolveSetupTier({ iosVersion: "18.4" })).toBe("per_app");
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

  it("offers the single automation from iOS 18.2 once enabled", () => {
    const enabled = { singleAutomationEnabled: true };
    expect(resolveSetupTier({ iosVersion: "18.2", ...enabled })).toBe(
      "single_automation",
    );
    expect(resolveSetupTier({ iosVersion: "26.0", ...enabled })).toBe(
      "single_automation",
    );
    expect(resolveSetupTier({ iosVersion: "18.1", ...enabled })).toBe("per_app");
    expect(resolveSetupTier({ iosVersion: "16.4", ...enabled })).toBe("per_app");
  });

  it("prefers the import over the single automation when both are possible", () => {
    expect(
      resolveSetupTier({
        iosVersion: "27.0",
        importUrl,
        singleAutomationEnabled: true,
      }),
    ).toBe("import");
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
    expect(setupSteps("per_app", { needsReturnShortcut: false })).toEqual([
      "pick_app_trigger",
      "tap_choose",
      "select_app",
      "run_immediately",
      "create_new_shortcut",
      "search_actions",
      "add_still_action",
      "pick_app_name",
      "save_automation",
    ]);
  });

  it("uses the current app instead of a typed name in the single automation", () => {
    const steps = setupSteps("single_automation", { needsReturnShortcut: false });
    expect(steps).toContain("action_current_app");
    expect(steps).toContain("action_pause_current");
    expect(steps).not.toContain("action_pause_named");
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

  it("backs every per-app step with a real capture that exists on disk", () => {
    const spec = JSON.parse(
      readFileSync(
        new URL("../../scripts/shortcut-guide/spec.json", import.meta.url),
        "utf8",
      ),
    ) as { images: { id: string }[] };
    const specIds = new Set(spec.images.map((image) => image.id));
    const manifest = readFileSync(
      new URL("../components/shortcut-guide-assets.ts", import.meta.url),
      "utf8",
    );

    for (const step of perApp) {
      expect(step.image, step.id).not.toBeNull();
      expect(specIds.has(step.image!), step.id).toBe(true);
      expect(manifest).toContain(`"${step.image}": {`);
      expect(
        existsSync(
          new URL(
            `../../assets/shortcut-guide/${step.image}.jpg`,
            import.meta.url,
          ),
        ),
        step.id,
      ).toBe(true);
    }
    expect(new Set(perApp.map((step) => step.image)).size).toBe(perApp.length);
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

import { describe, expect, it } from "vitest";

import {
  OTA_APPLY_WINDOW_MS,
  OTA_CHECK_INTERVAL_MS,
  OTA_MIN_BACKGROUND_MS,
  canApplyUpdate,
  holdOtaReload,
  isOtaReloadHeld,
  shouldCheckForUpdate,
  shouldCheckOnReturn,
  type ApplyContext,
} from "./ota-policy";

const safe: ApplyContext = {
  appState: "active",
  segments: ["(tabs)", "(today)"],
  hydrated: true,
  onboarded: true,
  backgroundMs: OTA_MIN_BACKGROUND_MS,
  sinceReturnMs: 0,
  pendingShortcut: false,
  held: false,
};

describe("checking for an update on return", () => {
  it("waits an hour between checks", () => {
    expect(shouldCheckForUpdate(1_000, 1_000)).toBe(false);
    expect(shouldCheckForUpdate(OTA_CHECK_INTERVAL_MS - 1, 0)).toBe(false);
    expect(shouldCheckForUpdate(OTA_CHECK_INTERVAL_MS, 0)).toBe(true);
  });

  it("asks again before applying a downloaded update, for a rollback published since", () => {
    const base = { now: 60_000, lastCheckAt: 0, updatePending: true, awayMs: OTA_MIN_BACKGROUND_MS };
    expect(shouldCheckOnReturn(base)).toBe(true);
    expect(shouldCheckOnReturn({ ...base, awayMs: OTA_MIN_BACKGROUND_MS - 1 })).toBe(false);
    expect(shouldCheckOnReturn({ ...base, updatePending: false })).toBe(false);
    expect(
      shouldCheckOnReturn({ ...base, updatePending: false, now: OTA_CHECK_INTERVAL_MS }),
    ).toBe(true);
  });
});

describe("applying a downloaded update", () => {
  it("applies back on any tab after five minutes away", () => {
    expect(canApplyUpdate(safe)).toBe(true);
    expect(canApplyUpdate({ ...safe, segments: ["(tabs)", "(settings)"] })).toBe(true);
    expect(canApplyUpdate({ ...safe, segments: ["(tabs)", "impact"] })).toBe(true);
  });

  it("never reloads a quick switch, in the background or once the user is back at it", () => {
    expect(canApplyUpdate({ ...safe, backgroundMs: OTA_MIN_BACKGROUND_MS - 1 })).toBe(false);
    expect(canApplyUpdate({ ...safe, sinceReturnMs: OTA_APPLY_WINDOW_MS })).toBe(true);
    expect(canApplyUpdate({ ...safe, sinceReturnMs: OTA_APPLY_WINDOW_MS + 1 })).toBe(false);
    expect(canApplyUpdate({ ...safe, appState: "background" })).toBe(false);
    expect(canApplyUpdate({ ...safe, appState: "inactive" })).toBe(false);
  });

  it("never reloads before the app knows its state or before onboarding", () => {
    expect(canApplyUpdate({ ...safe, hydrated: false })).toBe(false);
    expect(canApplyUpdate({ ...safe, onboarded: false })).toBe(false);
  });

  it("never reloads during a pause, the setup or any screen outside the tabs", () => {
    for (const segments of [
      ["intervention"],
      ["leave"],
      ["recharge"],
      ["(onboarding)"],
      ["setup"],
      ["android-setup"],
      ["android-repair"],
      ["shortcut-setup"],
      ["shortcut-repair"],
      ["usage-access"],
      ["ios-apps"],
      ["savings"],
      ["auth", "callback"],
      [],
    ]) {
      expect(canApplyUpdate({ ...safe, segments })).toBe(false);
    }
  });

  it("waits for a Shortcut pause and for an open browser or sign-in session", () => {
    expect(canApplyUpdate({ ...safe, pendingShortcut: true })).toBe(false);
    expect(canApplyUpdate({ ...safe, held: true })).toBe(false);
  });
});

describe("holding reloads during a session", () => {
  it("holds until every session is released, once each", () => {
    expect(isOtaReloadHeld()).toBe(false);
    const browser = holdOtaReload();
    const signIn = holdOtaReload();
    expect(isOtaReloadHeld()).toBe(true);
    browser();
    browser();
    expect(isOtaReloadHeld()).toBe(true);
    signIn();
    expect(isOtaReloadHeld()).toBe(false);
  });
});

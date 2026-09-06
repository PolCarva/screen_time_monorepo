import { describe, expect, it } from "vitest";

import {
  findControlCenter,
  hasStillAccessibilityService,
  isInterventionResumed,
  observedAttemptMatches,
  parseConnectedDevices,
  parseTargetSpec,
  readPreferenceBoolean,
  readPreferenceInteger,
  readPreferenceStringSet,
  resolvedLaunchComponent,
  resumedPackage,
  visibleUiText,
} from "./verify-shield-attribution.mjs";

describe("Android Shield attribution acceptance helpers", () => {
  it("accepts exactly authorized adb devices", () => {
    const devices = parseConnectedDevices(`List of devices attached
emulator-5554 device product:sdk model:Pixel_9 transport_id:1
R5CT unauthorized usb:1-2 transport_id:2
`);

    expect(devices).toEqual([
      { serial: "emulator-5554", state: "device" },
      { serial: "R5CT", state: "unauthorized" },
    ]);
  });

  it("recognizes Android's short and expanded accessibility components", () => {
    expect(
      hasStillAccessibilityService(
        "com.still.screentime/.StillAccessibilityService",
      ),
    ).toBe(true);
    expect(
      hasStillAccessibilityService(
        "com.still.screentime/com.still.screentime.StillAccessibilityService",
      ),
    ).toBe(true);
  });

  it("extracts the resolved launcher component from Android output", () => {
    expect(
      resolvedLaunchComponent(`priority=0 preferredOrder=0 match=0x108000
com.google.android.gm/.ConversationListActivityGmail`),
    ).toBe("com.google.android.gm/.ConversationListActivityGmail");
  });

  it("parses explicit package and visible-label targets", () => {
    expect(parseTargetSpec("com.google.android.youtube=YouTube")).toEqual({
      packageName: "com.google.android.youtube",
      label: "YouTube",
    });
    expect(() => parseTargetSpec("YouTube")).toThrow("Invalid target");
  });

  it("reads individual counters and selection from SharedPreferences XML", () => {
    const xml = `<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
  <boolean name="restrictions_enabled" value="true" />
  <int name="app_open_attempts:2026-09-05:com.google.android.gm" value="3" />
  <set name="selected_packages">
    <string>com.google.android.gm</string>
    <string>com.google.android.youtube</string>
  </set>
</map>`;

    expect(readPreferenceBoolean(xml, "restrictions_enabled")).toBe(true);
    expect(
      readPreferenceInteger(
        xml,
        "app_open_attempts:2026-09-05:com.google.android.gm",
      ),
    ).toBe(3);
    expect(readPreferenceStringSet(xml, "selected_packages")).toEqual([
      "com.google.android.gm",
      "com.google.android.youtube",
    ]);
  });

  it("extracts visible text and matches only the current app attempt", () => {
    const ui = `<hierarchy>
      <node package="com.android.systemui" text="Gmail" content-desc="" />
      <node package="com.still.screentime" text="YouTube se abrió 2 veces hoy." content-desc="" />
      <node package="com.still.screentime" text="" content-desc="Volver" />
    </hierarchy>`;
    const text = visibleUiText(ui, "com.still.screentime");

    expect(observedAttemptMatches(text, "YouTube", 2)).toBe(true);
    expect(observedAttemptMatches(text, "Gmail", 2)).toBe(false);
    expect(observedAttemptMatches("Gmail opened once today.", "Gmail", 1)).toBe(
      true,
    );
  });

  it("requires InterventionActivity to be the resumed activity", () => {
    const stopped = `Hist #0: ActivityRecord com.still.screentime/.InterventionActivity`;
    const resumed =
      "mResumedActivity: ActivityRecord{123 com.still.screentime/.InterventionActivity}";

    expect(isInterventionResumed(stopped)).toBe(false);
    expect(isInterventionResumed(resumed)).toBe(true);
  });

  it("locates the visible Go back control without using system UI nodes", () => {
    const ui = `<hierarchy>
      <node package="com.android.systemui" text="Volver" bounds="[0,0][20,20]" />
      <node package="com.still.screentime" text="Volver" bounds="[24,700][1056,820]" />
    </hierarchy>`;

    expect(
      findControlCenter(ui, "com.still.screentime", ["Go back", "Volver"]),
    ).toEqual({ x: 540, y: 760 });
  });

  it("reads only the currently resumed package from dumpsys", () => {
    const activities = `Hist #0: ActivityRecord{old com.google.android.gm/.MailActivity}
mResumedActivity: ActivityRecord{123 u0 com.google.android.apps.nexuslauncher/.NexusLauncherActivity t8}`;

    expect(resumedPackage(activities)).toBe(
      "com.google.android.apps.nexuslauncher",
    );
  });
});

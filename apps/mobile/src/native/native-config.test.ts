/// <reference types="node" />

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function nativeFile(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("committed native production configuration", () => {
  it("keeps Android identity, deep linking, ads, and restriction permissions in sync", () => {
    const manifest = nativeFile("android/app/src/main/AndroidManifest.xml");
    const gradle = nativeFile("android/app/build.gradle");
    const intervention = nativeFile(
      "android/app/src/main/java/com/still/screentime/InterventionActivity.kt",
    );

    expect(gradle).toContain("namespace 'com.still.screentime'");
    expect(gradle).toContain("applicationId 'com.still.screentime'");
    expect(manifest).toContain('android:scheme="still"');
    expect(manifest).toContain(
      'android:name="android.permission.PACKAGE_USAGE_STATS"',
    );
    expect(manifest).toContain(
      'android:name="android.permission.POST_NOTIFICATIONS"',
    );
    expect(manifest).toContain('android:name=".StillAccessibilityService"');
    expect(manifest).toContain(
      'android:value="ca-app-pub-8052007653549292~3132195218"',
    );
    expect(manifest).not.toContain("ca-app-pub-3940256099942544");
    expect(intervention).toContain("hasAvailablePass");
    expect(intervention).toContain('else -> "Get a pass  →"');
  });

  it("keeps iOS identity, deep linking, ads, and Screen Time entitlements in sync", () => {
    const info = nativeFile("ios/Still/Info.plist");
    const project = nativeFile("ios/Still.xcodeproj/project.pbxproj");
    const sharedState = nativeFile(
      "ios/StillNative/SharedRestrictionState.swift",
    );
    const entitlementPaths = [
      "ios/Still/Still.entitlements",
      "ios/StillShieldAction/StillShieldAction.entitlements",
      "ios/StillShieldConfiguration/StillShieldConfiguration.entitlements",
      "ios/StillDeviceActivityMonitor/StillDeviceActivityMonitor.entitlements",
      "ios/StillDeviceActivityReport/StillDeviceActivityReport.entitlements",
    ];

    expect(info).toContain("<string>still</string>");
    expect(info).toContain(
      "<string>ca-app-pub-8052007653549292~7920548119</string>",
    );
    expect(info).toContain("<key>NSFamilyControlsUsageDescription</key>");
    expect(info).toContain("<string>UIInterfaceOrientationPortrait</string>");
    expect(info).not.toContain("ca-app-pub-3940256099942544");
    expect(sharedState).toContain(
      "LocalWallet(rewarded: 0, emergency: 0, resetAt:",
    );
    expect(sharedState).not.toContain(
      "LocalWallet(rewarded: 0, emergency: 3, resetAt:",
    );

    for (const identifier of [
      "com.still.screentime",
      "com.still.screentime.shield-action",
      "com.still.screentime.shield-configuration",
      "com.still.screentime.device-activity-monitor",
      "com.still.screentime.device-activity-report",
    ]) {
      expect(project).toContain(identifier);
    }

    for (const path of entitlementPaths) {
      const entitlements = nativeFile(path);
      expect(entitlements).toContain(
        "<key>com.apple.developer.family-controls</key>",
      );
      expect(entitlements).toContain(
        "<string>group.com.still.screentime</string>",
      );
    }
  });
});

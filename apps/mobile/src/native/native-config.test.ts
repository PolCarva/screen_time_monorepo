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
    const restrictionModule = nativeFile(
      "android/app/src/main/java/com/still/screentime/StillRestrictionModule.kt",
    );
    const accessibilityService = nativeFile(
      "android/app/src/main/java/com/still/screentime/StillAccessibilityService.kt",
    );
    const appPicker = nativeFile(
      "android/app/src/main/java/com/still/screentime/AppPickerActivity.kt",
    );
    const selfProtection = nativeFile(
      "android/app/src/main/java/com/still/screentime/StillSelfProtection.kt",
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
    expect(intervention).toContain('else -> "Open Still · Watch ad"');
    expect(intervention).toContain("override fun onNewIntent");
    expect(intervention).toContain('appendQueryParameter("attempts"');
    expect(intervention).toContain("METRIC_APP_AVOIDED_OPENS");
    expect(restrictionModule).toContain("LifecycleEventListener");
    expect(restrictionModule).toContain("override fun onHostResume()");
    expect(restrictionModule).toContain("ComponentName.unflattenFromString");
    expect(restrictionModule).not.toContain('promise.resolve("notDetermined")');
    expect(restrictionModule).toContain("beginExternalAuthSession");
    expect(restrictionModule).toContain("endExternalAuthSession");
    expect(restrictionModule).toContain("cancelCurrentIntervention");
    expect(restrictionModule).toContain("Intent.CATEGORY_HOME");
    expect(restrictionModule).toContain(
      'putString("wellbeingAuthorization"',
    );
    expect(restrictionModule).not.toContain(
      'putString("issue", "usage_access_disabled")',
    );
    expect(restrictionModule).toContain(
      "getLaunchIntentForPackage(packageName)",
    );
    expect(restrictionModule).toContain('"target_unavailable"');
    expect(restrictionModule).toContain(".remove(KEY_CURRENT_PACKAGE)");
    expect(accessibilityService).toContain("isExternalAuthBrowser(target)");
    expect(accessibilityService).toContain("KEY_EXTERNAL_AUTH_BYPASS_BOOT");
    expect(accessibilityService).toContain("METRIC_APP_OPEN_ATTEMPTS");
    expect(accessibilityService).toContain("alreadyPending");
    expect(accessibilityService).toContain("EXTRA_TARGET_ATTEMPTS");
    expect(accessibilityService).toContain(
      "StillSelfProtection.isOwnPackage(packageName, target)",
    );
    expect(
      accessibilityService.indexOf(
        "StillSelfProtection.isOwnPackage(packageName, target)",
      ),
    ).toBeLessThan(accessibilityService.indexOf("val selected ="));
    expect(appPicker).toMatch(
      /StillSelfProtection\s*\.sanitizePreferences\(preferences, packageName\)/,
    );
    expect(appPicker).toContain(
      "!StillSelfProtection.isOwnPackage(packageName, it.packageName)",
    );
    expect(restrictionModule).toContain(
      "StillSelfProtection.sanitizePreferences",
    );
    expect(restrictionModule).toContain('promise.reject("invalid_target"');
    expect(intervention).toContain(
      "StillSelfProtection.isOwnPackage(packageName, targetPackage)",
    );
    expect(selfProtection).toContain("fun withoutOwnPackage");
    expect(selfProtection).toContain(".remove(KEY_CURRENT_PACKAGE)");
  });

  it("keeps iOS identity, deep linking, ads, and Screen Time entitlements in sync", () => {
    const info = nativeFile("ios/Still/Info.plist");
    const project = nativeFile("ios/Still.xcodeproj/project.pbxproj");
    const sharedState = nativeFile(
      "ios/StillNative/SharedRestrictionState.swift",
    );
    const restrictionEngine = nativeFile(
      "ios/StillNative/StillRestrictionEngine.swift",
    );
    const restrictionBridge = nativeFile(
      "ios/StillNative/StillRestrictionEngine.m",
    );
    const shortcutIntent = nativeFile(
      "ios/StillNative/StillShortcutIntent.swift",
    );
    const shieldAction = nativeFile(
      "ios/StillShieldAction/ShieldActionExtension.swift",
    );
    const shieldConfiguration = nativeFile(
      "ios/StillShieldConfiguration/ShieldConfigurationExtension.swift",
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
    expect(sharedState).toContain("beginExternalBrowserBypass");
    expect(sharedState).toContain("externalBrowserBypassActive");
    expect(sharedState).toContain("still.external-browser");
    expect(sharedState).toContain("15 * 60");
    expect(restrictionEngine).toContain("beginExternalAuthSession");
    expect(restrictionEngine).toContain("endExternalAuthSession");
    expect(restrictionBridge).toContain("beginExternalAuthSession");
    expect(restrictionBridge).toContain("endExternalAuthSession");
    expect(restrictionEngine).toContain("enableShortcutMode");
    expect(restrictionEngine).toContain("completeShortcutIntervention");
    expect(restrictionBridge).toContain("enableShortcutMode");
    expect(restrictionBridge).toContain("completeShortcutIntervention");
    expect(sharedState).toContain("targetProductMetrics:");
    expect(sharedState).toContain(
      "guard restrictionsEnabled, !shortcutModeEnabled",
    );
    expect(shortcutIntent).toContain(
      "struct PauseBeforeOpeningIntent: AppIntent",
    );
    expect(shortcutIntent).toContain("requestToContinueInForeground");
    expect(shortcutIntent).toContain('components.scheme = "shortcuts"');
    expect(shortcutIntent).toContain("recordOpenAttempt");
    expect(shortcutIntent).toContain(
      "let targetKey = key(appName: cleanAppName)",
    );
    expect(shortcutIntent).not.toContain(
      "key(appName: String, returnShortcutName:",
    );
    expect(project).toContain("StillShortcutIntent.swift in Sources");
    expect(shieldAction).toContain("targetMetricScope:");
    expect(shieldConfiguration).toContain("todayMetrics(for: application)");

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

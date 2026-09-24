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
    // Today counts Still's own pauses on both platforms; screen time is no
    // longer read, so Usage Access is not requested (ui-clarity-plan D4).
    expect(manifest).not.toContain("android.permission.PACKAGE_USAGE_STATS");
    expect(manifest).toContain(
      'android:name="android.permission.POST_NOTIFICATIONS"',
    );
    expect(manifest).toContain('android:name=".StillAccessibilityService"');
    expect(manifest).toContain(
      'android:value="ca-app-pub-8052007653549292~3132195218"',
    );
    expect(manifest).not.toContain("ca-app-pub-3940256099942544");
    // The shield shows the rewarded ad and the decision in the same screen,
    // with a saved pass beside the ad and the pause all native (no jump to RN).
    // Emergency access is gone (docs/real-impact-stats-plan.md, D1-D3).
    expect(intervention).toContain("StillRewardedAdManager.show(this)");
    expect(intervention).toContain('if (spanish) "Ver anuncio" else "Watch ad"');
    expect(intervention).toContain('"Usar 1 pase de emergencia"');
    // The pass is the quiet option under the ad, never the first choice.
    expect(intervention.indexOf("when (gate.ad)")).toBeLessThan(
      intervention.indexOf("if (gate.passAvailable)"),
    );
    expect(intervention).toContain("if (gate.passAvailable)");
    expect(intervention).toContain("when (gate.ad)");
    expect(intervention).toContain("renderPause()");
    // An ad still loading is waited for at the gate, like the JS flow, and a
    // pause that started is picked up again instead of turning into the ad.
    expect(intervention).toContain('"Preparando el anuncio…"');
    expect(intervention).toContain("StillRewardedAdManager.awaitLoad");
    expect(intervention).toContain("if (!resumePause()) renderByGate()");
    // The free daily allowance is gone: no counter, no "emergency" source. The
    // saved pass is only called an emergency pass in its label.
    expect(intervention).not.toContain("EMERGENCY_REMAINING");
    expect(intervention).not.toContain("EnterSource.EMERGENCY");
    expect(intervention).not.toContain('"emergency"');
    // A visit paid by a fresh ad names that ad, so it never spends a saved pass.
    expect(intervention).toContain('report.put("rewardIntentId", rewardIntentId)');
    expect(intervention).toContain("KEY_UNLOCK_OUTBOX");
    // The old deep-link jump into React Native is gone.
    expect(intervention).not.toContain('scheme("still")');
    expect(intervention).toContain("override fun onNewIntent");
    expect(intervention).toContain("METRIC_APP_AVOIDED_OPENS");
    expect(restrictionModule).toContain("LifecycleEventListener");
    expect(restrictionModule).toContain("override fun onHostResume()");
    expect(restrictionModule).toContain("ComponentName.unflattenFromString");
    expect(restrictionModule).not.toContain('promise.resolve("notDetermined")');
    expect(restrictionModule).toContain("beginExternalAuthSession");
    expect(restrictionModule).toContain("endExternalAuthSession");
    expect(restrictionModule).toContain("cancelCurrentIntervention");
    expect(restrictionModule).toContain("Intent.CATEGORY_HOME");
    // Screen time is gone (D4); Today reads seven local days of Still's own
    // counters, keyed by the phone's day (D6).
    expect(restrictionModule).not.toContain("wellbeingAuthorization");
    expect(restrictionModule).not.toContain("UsageStatsManager");
    expect(restrictionModule).toContain('putArray("history"');
    for (const source of [restrictionModule, intervention, accessibilityService]) {
      expect(source).toContain("StillDay.today()");
      expect(source).not.toContain("ZoneOffset.UTC");
    }
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

  it("keeps the public iOS Shortcuts release identity, deep linking, and ads in sync", () => {
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
    const entitlements = nativeFile("ios/Still/Still.entitlements");

    expect(info).toContain("<string>still</string>");
    expect(info).toContain(
      "<string>ca-app-pub-8052007653549292~7920548119</string>",
    );
    expect(info).not.toContain("NSFamilyControlsUsageDescription");
    expect(info).toContain("<string>UIInterfaceOrientationPortrait</string>");
    expect(info).not.toContain("ca-app-pub-3940256099942544");
    // Missing shared state never mints access, and there is no emergency
    // allowance to fall back on any more.
    expect(sharedState).toContain("LocalWallet(rewarded: 0, resetAt:");
    expect(sharedState).not.toContain("wallet.emergency");
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
    // A regenerated project must keep the intent, or Shortcuts silently loses
    // the action while the app still builds.
    expect(nativeFile("scripts/configure-ios-targets.rb")).toContain(
      "StillShortcutIntent.swift",
    );

    // Pausa vía Atajos v2: targets chosen in Still, direct return, real health.
    expect(info).toContain("<key>LSApplicationQueriesSchemes</key>");
    expect(shortcutIntent).toContain("enum ShortcutTargetStore");
    expect(shortcutIntent).toContain(
      "struct ShortcutTargetOptionsProvider: DynamicOptionsProvider",
    );
    expect(shortcutIntent).toContain(
      "optionsProvider: ShortcutTargetOptionsProvider()",
    );
    expect(shortcutIntent).toContain(
      "let target = ShortcutTargetStore.resolve(appName: requestedName)",
    );
    expect(shortcutIntent).toContain(
      "ShortcutTargetStore.markTriggered(targetKey)",
    );
    // The remote kill switch and a removed app both keep the intent silent.
    expect(shortcutIntent).toContain(
      'guard SharedRestrictionState.restrictionsEnabled, target.state != "removed"',
    );
    expect(shortcutIntent).toContain("consumeSetupProbe(for: targetKey)");
    // "Current App" names Shortcuts when run by hand; never pause it or Still.
    expect(shortcutIntent).toContain(
      "guard !ShortcutTargetStore.isReserved(requestedName) else { return nil }",
    );
    // Only a bare `scheme://` may ever be stored as a way back.
    expect(shortcutIntent).toContain('candidate == "\\(scheme)://"');
    expect(shortcutIntent).toContain('"still", "shortcuts", "http", "https"');
    expect(shortcutIntent).toContain(
      "-> (String, Date, URL, URL?)",
    );
    for (const method of [
      "setShortcutTargets",
      "getShortcutTargetsHealth",
      "beginShortcutSetupProbe",
      "finishShortcutSetupTest",
      "suspendToHome",
    ]) {
      expect(restrictionEngine).toContain(`@objc func ${method}(`);
      expect(restrictionBridge).toContain(`RCT_EXTERN_METHOD(${method}:`);
    }
    // Swift and JavaScript must derive the same return shortcut name, and it
    // must be typeable: the user creates that shortcut by hand.
    expect(shortcutIntent).toContain('returnShortcutPrefix = "Still - "');
    expect(
      nativeFile("src/lib/shortcut-targets.ts"),
    ).toContain("return `Still - ${appName}`;");
    expect(restrictionEngine).toContain('"fallbackReturnUrl"');
    expect(restrictionEngine).toContain('"shortcuts_not_verified"');
    expect(restrictionEngine).not.toContain('"engineActive": true,');
    expect(shieldAction).toContain("targetMetricScope:");
    expect(shieldConfiguration).toContain("todayMetrics(for: application)");

    expect(project).toContain("PRODUCT_BUNDLE_IDENTIFIER = app.still.ios;");
    expect(project).not.toContain("PRODUCT_BUNDLE_IDENTIFIER = com.still.screentime;");
    for (const identifier of [
      "com.still.screentime.shield-action",
      "com.still.screentime.shield-configuration",
      "com.still.screentime.device-activity-monitor",
      "com.still.screentime.device-activity-report",
    ]) {
      expect(project).not.toContain(identifier);
    }

    expect(entitlements).not.toContain(
      "<key>com.apple.developer.family-controls</key>",
    );
    expect(entitlements).toContain("<string>group.app.still.ios</string>");
    expect(entitlements).toContain(
      "<key>com.apple.developer.applesignin</key>",
    );
  });
});

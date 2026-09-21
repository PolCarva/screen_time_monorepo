# Store and privacy checklist

## Apple — outside v1

- Do not submit or configure Apple distribution for the Android-only v1 release. The iOS Shortcuts pause (`ios-shortcuts.md`) is unreleased and off in production.
- Submitting later requires Apple Developer Program membership. The bundle still declares the Family Controls entitlement for the app and its four extensions, so Family Controls distribution approval is needed for every bundle ID unless that entitlement and those targets are removed first. Decide this before the first archive: Shortcuts mode does not use Screen Time at all.
- Keep ads and promotion out of every extension and out of the App Intent. The rewarded ad is only ever presented by the foreground app after an explicit tap, which is also what AdMob's rewarded policy requires.
- Verify App Group and Family Controls entitlements in Release archives, not only Debug builds.

### App Review notes (draft)

Paste into App Store Connect → App Review Information → Notes, and attach a screen recording of the flow:

> Still adds an intentional pause before apps the user chooses. iOS gives apps no way to observe other apps, so the user creates a personal automation in Apple's Shortcuts app ("When [app] is opened → Pause Before Opening", an App Intent provided by Still). Still never creates, edits or reads automations; the in-app guide only explains the steps and opens the Shortcuts app.
>
> To review: 1) open Still and finish onboarding; 2) choose YouTube under "Apps with a pause"; 3) follow the four steps shown to create the automation in Shortcuts; 4) open YouTube. Still comes to the foreground and offers "Watch ad" or "I don't want to go in anymore". The ad is a rewarded ad and only starts after the user taps "Watch ad". After it completes, the user chooses "I want to go in" (Still reopens YouTube through its public URL scheme) or "I don't want to go in anymore".
>
> The target app is visible for a moment before Still appears. That is how iOS orders app launch and automations, not something Still controls.
>
> Still does not block, hide or restrict any app, and it does not use Screen Time shields in this mode. The user can remove the automation in Shortcuts at any time and Still stops appearing.
>
> The names of the chosen apps stay on the device: they are stored in the App Group and are never sent to our servers or to analytics.

### Leaving to the Home Screen

When the user declines, the intended ending is the iOS Home Screen. iOS has no public API for that. Still can do it by sending `suspend` to `UIApplication`, the same effect as a Home press, but that selector is undocumented and App Review may object to it.

- It ships **disabled**, behind the remote `iosHomeOnCancelEnabled` flag, and no review build should have it on unless the decision to defend it has been made.
- With the flag off Still uses public API only: an optional user-created shortcut (`Still - Inicio`, one "Go to Home Screen" action) or a screen that asks the user to swipe up.
- If a submission is rejected for it, switch the flag off in `/admin`; no new build is needed. Remove `suspendToHome` from `StillRestrictionEngine.swift` before resubmitting if the reviewer asks for the code to go.

## Google Play

- Accessibility is a core intervention feature, but the app is not an accessibility tool.
- Submit the in-app prominent disclosure, affirmative consent evidence, declaration form, and a video showing detection, intervention, cancellation, unlock, and Settings recovery.
- Declare package visibility only through the launcher `<queries>` intent. Do not add `QUERY_ALL_PACKAGES` without a new policy review.
- Keep Usage Access limited to local wellbeing statistics and verification.

Suggested disclosure: “Still uses Accessibility to detect when you open only the apps you selected and show an intentional pause. It does not read screen content, type, or collect the names of your selected apps. Processing stays on this device. You can disable access at any time in Android Settings.”

## Ads and impact

- Use Google UMP in the EEA, UK, and Switzerland. The MVP requests non-personalized/limited ads and preserves Emergency Unlock when ads are unavailable.
- Use test ad unit IDs in every non-production build.
- Product copy must say: “The platform allocates a percentage of its advertising revenue to the Impact Fund.” Never attribute a specific donation to a specific ad.
- Mark an open week's revenue as estimated. Show “donated” only after an operator records a real payment and public proof.

## Retention and data rights

- Identifiable wellbeing aggregates: 90 days; later only anonymous aggregates.
- Product analytics: 13 months.
- Revenue, donation, and admin audit records: 7 years or applicable legal requirement.
- Deletion removes auth/profile/devices/wellbeing/push data and pseudonymizes the financial ledger first.
- The age gate stores only the 18+ confirmation.

A qualified legal review is still required before a global Android production launch.

# Store and privacy checklist

## Apple — App Store

- The iOS app is `app.still.ios` on the personal Apple team `JZ9HBXGNK9` (App Group `group.app.still.ios`). `com.still.screentime` stays registered on another team and must not be used for iOS.
- Family Controls is gone: the app ships without the Screen Time extensions, so no Family Controls distribution approval is needed. The pause is the Shortcuts App Intent (`ios-shortcuts.md`); `iosRestrictionEnabled` must be on in production before a review build is submitted, or the reviewer sees an app that never pauses.
- Guideline 4.8: Sign in with Apple is offered ahead of Google wherever an account can be linked (Settings and the Impact vote).
- Keep ads and promotion out of the App Intent. The rewarded ad is only ever presented by the foreground app after an explicit tap, which is also what AdMob's rewarded policy requires.
- `ITSAppUsesNonExemptEncryption` is `false` (HTTPS only), so builds skip the export-compliance question.
- Verify the App Group and Sign in with Apple entitlements in Release archives, not only Debug builds.

### App Review notes

The notes, the reply to App Review and the screen-recording script live in `docs/app-store-review-plan.md` (§6 and §11); `docs/store-listing.md` keeps the copy pasted into App Store Connect. The first submission (0.2.0) came back with guideline 2.1 "Information Needed" because the developer account is new, so every submission from this account carries the recording and the six answers.

- Account deletion revokes Sign in with Apple (`apps/web/lib/apple-sign-in.ts`): the app asks Apple for a fresh authorization code and the server exchanges and revokes it before deleting the account.
- The privacy policy is linked inside the app (Settings → Your data), as 5.1.1(i) requires.

### Leaving to the Home Screen

When the user declines, the intended ending is the iOS Home Screen. iOS has no public API for that.

- Still uses public API only: an optional user-created shortcut (`Still - Inicio`, one "Go to Home Screen" action) or a screen that asks the user to swipe up.
- Builds up to 0.3.0 also carried `suspendToHome`, which sent the undocumented `suspend` selector to `UIApplication` behind the remote `iosHomeOnCancelEnabled` flag. 0.3.1 removed it before the App Store resubmission (guideline 2.5.1: public APIs only). The flag stays in the config contract only because those older builds read it: keep it off.

## Google Play

- Accessibility is a core intervention feature, but the app is not an accessibility tool.
- Submit the in-app prominent disclosure, affirmative consent evidence, declaration form, and a video showing detection, intervention, cancellation, unlock, and Settings recovery.
- Declare package visibility only through the launcher `<queries>` intent. Do not add `QUERY_ALL_PACKAGES` without a new policy review.
- Usage Access (`PACKAGE_USAGE_STATS`) is requested **only by the onboarding story** (docs/onboarding-v2-plan.md, D4), is optional ("Continue without my data") and is read in one file, `StillUsageInsights.kt`. The screen that asks for it is the prominent disclosure: what is read (how much each app is used), what for (showing the user their own time) and that it is worked out on the phone and never leaves it. Nothing is stored or sent: Data safety does not declare it as collected. Today keeps using Still's own pause counters.
- The Accessibility disclosure's acceptance time is stored on the device (`accessibilityDisclosureAcceptedAt`) as evidence of affirmative consent.

Suggested disclosure: “Still uses Accessibility to detect when you open only the apps you selected, show an intentional pause, and close a floating video window that would cover that pause. It does not type for you and does not collect, store, or share your screen content, messages, or the names of your selected apps. Processing stays on this device. You can disable access at any time in Android Settings.”

> Note: closing a floating (Picture-in-Picture) video requires `canRetrieveWindowContent="true"` plus `flagRetrieveInteractiveWindows`. Still uses this only to locate and dismiss the offending PiP window; it never reads, stores, or transmits screen content. Reflect this in the Play Console declaration and the demo video.

### Ads consent (UMP)

- The onboarding asks Google's consent form (UMP) as its own setup step, only where Google requires it (EEA, UK, Switzerland), so it no longer appears in the middle of the first pause. It also covers Android's native shield: UMP writes the IAB TCF strings (`IABTCF_*`) to the app's default SharedPreferences, which the ads SDK reads in the same process (verified on the emulator with UMP's EEA debug geography).
- Users can change it later from Settings (`AdsConsent.showPrivacyOptionsForm`). `reward-provider.ts` still gathers consent before the first ad as a fallback (offline during onboarding, or users onboarded before this).

## Ads and impact

- Use Google UMP in the EEA, UK, and Switzerland. The MVP requests non-personalized/limited ads. When no ad is available, a 15-second pause still lets the user in for five minutes, so nobody is locked out.
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

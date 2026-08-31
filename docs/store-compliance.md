# Store and privacy checklist

## Apple — future, outside v1

- Do not submit or configure Apple distribution for the Android-only v1 release.
- If iOS is revived later, Apple Developer Program membership and Family Controls distribution approval will be required for the app and each extension bundle ID.
- Keep ads and promotion out of every extension.
- Explain the individual-authorization use case and the manual-return fallback in review notes.
- Verify App Group and Family Controls entitlements in Release archives, not only Debug builds.

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

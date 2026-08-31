# Verification report

Run date: 2026-08-31.

## Automated checks

| Check                               | Result                                                                                                                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm check`                        | Passed: ESLint, TypeScript, and 51 unit tests (contracts 11, mobile 13, web 27).                                                                                                                       |
| Expo Doctor                         | Passed all 20 applicable checks after aligning Expo SDK 57 patch releases and React Native 0.86.3. Native configuration is covered by committed Android/iOS regression assertions.                    |
| Production dependency audit         | `pnpm audit --prod --audit-level=moderate` passed with no known vulnerabilities.                                                                                                                      |
| Clean Supabase migration + seed     | Passed on the local PostgreSQL 17 Supabase image through migration `202608310001`.                                                                                                                     |
| `supabase test db`                  | Passed 15 pgTAP database invariants covering RPC grants, operational switches, reconciliation/debt behavior, and deletion recovery.                                                                    |
| `supabase db lint`                  | No errors; only intentional unused wire-compatibility parameters were reported at warning level.                                                                                                       |
| `pnpm --filter web build`           | Passed production compilation and route generation.                                                                                                                                                    |
| Android `:app:compileDebugKotlin`   | Passed with min SDK 29, compile/target SDK 36. Only platform/dependency deprecation warnings remain.                                                                                                   |
| iOS simulator workspace build       | Passed for Still plus Shield Action, Shield Configuration, Device Activity Monitor, and Device Activity Report targets with code signing disabled.                                                     |
| Production Playwright smoke         | `/`, `/impact`, and `/privacy` returned 200 with expected headings and hardened headers; no browser console, page, or real network errors were observed.                                                 |
| Production config fail-closed check | `APP_VARIANT=production` correctly rejects a build with a missing EAS project ID or without Google identity explicitly enabled.                                                                         |
| `git diff --check`                  | Passed.                                                                                                                                                                                                |
| Production Supabase                 | All migrations through `202608310001` applied to `unyhkgmdqbtrmkoxlqnk`; Google Auth is enabled, Apple Auth is disabled, and public product metrics remain real rather than seeded.                       |
| Production data/API                 | Real charities and policy v2 published; the open week reports $0 revenue, 0 participants, 0 rewarded actions, and 0 votes without demo fallbacks.                                                       |
| Production Vercel cron              | Authenticated reward reconciliation returned HTTP 200 with `{ "reconciled": 0 }`.                                                                                                                   |
| Production AdMob configuration      | Approved account; real Android/iOS app and rewarded-unit IDs; SSV points to the production webhook for both units; European and US-state UMP messages are published.                                 |
| Production Android AAB              | EAS build [`d829692a-233c-47de-9629-ae9f87c8a7b1`](https://expo.dev/accounts/goshops/projects/still-screen-time/builds/d829692a-233c-47de-9629-ae9f87c8a7b1) finished from commit `0769426` with store signing, package `com.still.screentime`, version code 5, and a downloadable [AAB artifact](https://expo.dev/artifacts/eas/3I1jVWA1QQiyhK4vv5p23ZTdgqW6-3mRQQwjBLkJm2E.aab). |

Unit coverage targets contract/domain transitions, offline wallet projection, Google-only voting identity, analytics consent, stable mobile API errors, AdMob SSV signature transport, reward-intent signing, HTTP error secrecy/mapping, OAuth redirect safety, security headers, transactional waitlist rate limiting, donation-proof signature validation, asynchronous persisted beta signup behavior, and committed native identity/entitlement configuration.

## Remaining external state

- Google identity is configured in Supabase and EAS; a signed-device link/return test and separate AdMob Reporting OAuth credentials remain.
- Apple Developer still requires account-owner login/2FA for Family Controls distribution only. Apple identity is intentionally excluded.
- App Review must accept the Google-only optional linking model under guideline 4.8; the anonymous session remains primary.
- Family Controls/Managed Settings cannot be validated on the simulator and require approved signed entitlements.
- Android Accessibility timing and OEM background behavior require real devices and Play review.
- A real AdMob test-device impression, SSV callback, Reporting API import, UMP presentation, and provider-link flow require the pending OAuth/store state and signed physical-device runs. Both AdMob apps also remain pending store-listing association.

Use the acceptance matrix in `native-feasibility.md` before promoting beyond a closed beta.

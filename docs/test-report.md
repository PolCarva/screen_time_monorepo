# Verification report

Run date: 2026-08-30.

## Automated checks

| Check                               | Result                                                                                                                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm check`                        | Passed: ESLint, TypeScript, and 36 unit tests (contracts 11, mobile 7, web 18).                                                                                                                        |
| Clean Supabase migration + seed     | Passed on the local PostgreSQL 17 Supabase image through migration `202608300002`.                                                                                                                     |
| `supabase test db`                  | Passed 15 pgTAP database invariants covering RPC grants, operational switches, reconciliation/debt behavior, and deletion recovery.                                                                    |
| `supabase db lint`                  | No errors; only intentional unused wire-compatibility parameters were reported at warning level.                                                                                                       |
| `pnpm --filter web build`           | Passed production compilation and route generation.                                                                                                                                                    |
| Android `:app:compileDebugKotlin`   | Passed with min SDK 29, compile/target SDK 36. Only platform/dependency deprecation warnings remain.                                                                                                   |
| iOS simulator workspace build       | Passed for Still plus Shield Action, Shield Configuration, Device Activity Monitor, and Device Activity Report targets with code signing disabled.                                                     |
| Production Playwright smoke         | `/`, `/impact`, and `/privacy` returned 200 with expected headings; config/current/history APIs returned valid JSON in the configured test environment; no browser console errors or failed responses. |
| Production config fail-closed check | `APP_VARIANT=production` correctly rejected a build with a missing EAS project ID.                                                                                                                     |
| `git diff --check`                  | Passed.                                                                                                                                                                                                |
| Production Supabase                 | All migrations through `202608300002` applied to `unyhkgmdqbtrmkoxlqnk`; prelaunch accounts/telemetry purged, leaving one admin profile and zero product metrics.                                      |
| Production data/API                 | Real charities and policy v2 published; the open week reports $0 revenue, 0 participants, 0 rewarded actions, and 0 votes without demo fallbacks.                                                       |
| Production Vercel cron              | Authenticated reward reconciliation returned HTTP 200 with `{ "reconciled": 0 }`.                                                                                                                   |
| Production Android AAB              | EAS build `f6251fde-375f-43a1-887d-a09952086935` finished with store distribution signing, package `com.still.screentime`, and version code 4.                                                          |

Unit coverage targets the contract/domain transitions, offline wallet projection, stable mobile API errors, AdMob SSV signature transport, reward-intent signing, HTTP error secrecy/mapping, OAuth redirect safety, and donation-proof signature validation.

## Remaining external state

- Google Auth Platform still requires the account owner to accept Google's API user-data policy. After that, the Google login and AdMob Reporting OAuth clients can be issued and connected.
- Apple Developer still requires account-owner login/2FA, followed by Sign in with Apple and Family Controls distribution configuration.
- Family Controls/Managed Settings cannot be validated on the simulator and require approved signed entitlements.
- Android Accessibility timing and OEM background behavior require real devices and Play review.
- A real AdMob test-device impression, SSV callback, Reporting API import, UMP flow, and provider-link flow require the pending OAuth/store state and signed physical-device runs.

Use the acceptance matrix in `native-feasibility.md` before promoting beyond a closed beta.

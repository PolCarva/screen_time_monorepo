# Verification report

Run date: 2026-08-30.

## Automated checks

| Check                               | Result                                                                                                                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm check`                        | Passed: ESLint, TypeScript, and 33 unit tests (contracts 10, mobile 7, web 16).                                                                                                                        |
| Clean Supabase migration + seed     | Passed on the local PostgreSQL 17 Supabase image through migration `202608290004`.                                                                                                                     |
| `supabase test db`                  | Passed 15 pgTAP database invariants covering RPC grants, operational switches, reconciliation/debt behavior, and deletion recovery.                                                                    |
| `supabase db lint`                  | No errors; only intentional unused wire-compatibility parameters were reported at warning level.                                                                                                       |
| `pnpm --filter web build`           | Passed production compilation and route generation.                                                                                                                                                    |
| Android `:app:compileDebugKotlin`   | Passed with min SDK 29, compile/target SDK 36. Only platform/dependency deprecation warnings remain.                                                                                                   |
| iOS simulator workspace build       | Passed for Still plus Shield Action, Shield Configuration, Device Activity Monitor, and Device Activity Report targets with code signing disabled.                                                     |
| Production Playwright smoke         | `/`, `/impact`, and `/privacy` returned 200 with expected headings; config/current/history APIs returned valid JSON in the configured test environment; no browser console errors or failed responses. |
| Production config fail-closed check | `APP_VARIANT=production` correctly rejected a build with a missing EAS project ID.                                                                                                                     |
| `git diff --check`                  | Passed.                                                                                                                                                                                                |

Unit coverage targets the contract/domain transitions, offline wallet projection, stable mobile API errors, AdMob SSV signature transport, reward-intent signing, HTTP error secrecy/mapping, OAuth redirect safety, and donation-proof signature validation.

## Not reproducible without external state

- The target Supabase project still requires a reviewed `supabase db push --dry-run` and deployment; local verification intentionally does not mutate the linked remote project.
- Family Controls/Managed Settings cannot be validated on the simulator and require approved signed entitlements.
- Android Accessibility timing and OEM background behavior require real devices.
- A real AdMob test-device impression, SSV callback, Reporting API import, UMP flow, OAuth provider link, and EAS store-signed binary require the corresponding accounts/credentials.

Use the acceptance matrix in `native-feasibility.md` before promoting beyond a closed beta.

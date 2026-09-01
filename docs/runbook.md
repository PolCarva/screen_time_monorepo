# Development and operations runbook

## Bootstrap

1. Install Node 22+, pnpm 10.8.1, Supabase CLI + Docker, Android SDK 36, and JDK 17. Xcode 26/CocoaPods are optional and used only for the dormant, non-release iOS spike.
2. Copy `.env.example`, `apps/web/.env.example`, and `apps/mobile/.env.example` to matching `.env.local` files.
3. Run `pnpm install --frozen-lockfile`.
4. Run `supabase start`, copy its local URL/keys into the env files, then run `supabase db reset` to apply migrations and `supabase/seed.sql`.
5. Run `pnpm dev:all`, then install the Android native build with `pnpm --filter mobile android`. Expo Go is unsupported.

Do not run `expo prebuild --clean`: it removes the committed restriction-engine sources and extension targets. If native regeneration is unavoidable, preserve those directories, reapply the config plugin, run `ruby apps/mobile/scripts/configure-ios-targets.rb`, and then `pod install`.

The workspace is pinned to Expo SDK 57 / React Native 0.86.3. Expo Doctor's app-config synchronization check is disabled because the native projects are intentionally committed; `src/native/native-config.test.ts` verifies the corresponding values directly. The existing Xcode patch and iOS targets are retained for future evaluation but do not belong to the Android release checklist.

## Environment inventory

Public values are bundled into clients and must never contain secrets.

| Variable                                                                                   | Surface      | Required in production | Purpose                                             |
| ------------------------------------------------------------------------------------------ | ------------ | ---------------------- | --------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`                                                                      | web          | yes                    | canonical HTTPS URL, OAuth callback, robots/sitemap |
| `NEXT_PUBLIC_SUPABASE_URL`                                                                 | web          | yes                    | Supabase project URL                                |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                                                     | web          | yes                    | browser publishable key                             |
| `SUPABASE_SERVICE_ROLE_KEY`                                                                | web          | yes                    | server-only data/RPC/storage access                 |
| `REWARD_INTENT_SECRET`                                                                     | web          | yes                    | signs expiring AdMob custom data                    |
| `INTERNAL_JOB_SECRET`                                                                      | web          | yes                    | AdMob revenue import bearer token                   |
| `CRON_SECRET`                                                                              | web          | yes on Vercel          | stale reward reconciliation bearer token            |
| `WAITLIST_RATE_LIMIT_SECRET`                                                               | web          | recommended            | HMAC key for beta abuse protection                  |
| `ADMOB_PUBLISHER_ACCOUNT`, `ADMOB_CLIENT_ID`, `ADMOB_CLIENT_SECRET`, `ADMOB_REFRESH_TOKEN` | web          | yes for revenue import | AdMob Reporting API                                 |
| `EXPO_PUBLIC_API_URL`                                                                      | mobile       | yes                    | public HTTPS web/API base URL                       |
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                         | mobile       | yes                    | mobile Auth only                                    |
| `EXPO_PUBLIC_EAS_PROJECT_ID`                                                               | mobile       | yes                    | EAS project binding                                 |
| `EXPO_PUBLIC_GOOGLE_AUTH_ENABLED`                                                          | mobile       | yes; must be `true`    | enable the sole social identity provider            |
| `ADMOB_ANDROID_APP_ID`                                                                     | mobile build | yes                    | Android Mobile Ads initialization                   |
| `EXPO_PUBLIC_ADMOB_REWARDED_ANDROID`                                                       | mobile       | yes                    | Android rewarded ad unit                            |
| `ADMOB_IOS_APP_ID`, `EXPO_PUBLIC_ADMOB_REWARDED_IOS`                                       | dormant iOS  | no                     | optional future iOS target; sample defaults only    |
| `EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_POSTHOG_HOST`                                      | mobile       | recommended            | privacy-scrubbed product analytics                  |
| `EXPO_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`                                                     | mobile/web   | recommended            | crash/error telemetry                               |

Use different high-entropy values for `REWARD_INTENT_SECRET`, `INTERNAL_JOB_SECRET`, `CRON_SECRET`, and preferably `WAITLIST_RATE_LIMIT_SECRET`. Vercel automatically sends `Authorization: Bearer $CRON_SECRET` to cron routes. The reconciliation route falls back to `INTERNAL_JOB_SECRET` only for non-Vercel deployments; the waitlist uses a domain-separated HMAC with `INTERNAL_JOB_SECRET` when no dedicated key exists.

`APP_VARIANT=production` is set by `eas.json`. Production config evaluation rejects HTTP endpoints, missing core values, and Google's sample AdMob identifiers. Sample IDs in `.env.example` are development-only.

## Database and storage

Apply every file in `supabase/migrations` in lexical order. For a linked project:

```sh
supabase link --project-ref YOUR_PROJECT_REF
supabase db push --dry-run
supabase db push
```

Review the dry run before applying. The migrations create RLS policies, server-only RPC grants, the public-read `donation-proofs` bucket, transactional waitlist rate limiting, reward reconciliation, runtime-switch enforcement, and deletion rollback support. Never expose the service-role key to the mobile or browser bundles.

The seed is intentionally empty. Use `/admin` to publish operational policy and add verified charities. The cleanup migration removes only the prototype fixture IDs and installs a fail-closed policy if no real active policy exists.

The operations console accepts PDF/PNG/JPEG proof files up to 5 MB and validates their byte signature before uploading. The Storage bucket has a larger database-level ceiling to preserve operational headroom; the web boundary is intentionally stricter.

## Scheduled and weekly operations

- Daily at 03:17 UTC: Vercel calls `GET /api/internal/jobs/reconcile-rewards`; stale provisional grants older than 26 hours are rejected and an available pass is reversed idempotently.
- Daily at 08:42 UTC: Vercel calls `GET /api/internal/jobs/admob-revenue`; the job refreshes the configured Google OAuth token, reads the previous 14 days from the AdMob Reporting API, upserts estimates, and recomputes overlapping open weeks. `POST` remains available only for explicitly publisher-provided corrections.
- Monday: use `/admin` to open the week. The function snapshots the active impact/platform percentages and selected charities.
- Sunday: close voting, import/reconcile final revenue, and confirm the gross amount.
- After payment: upload the actual proof and record the donation. Publication occurs only after the database transition succeeds.

Every state-changing admin RPC writes `admin_audit_log`. Admin forms disable while pending and return inline success/error feedback; retry only after checking the current week state.

## Web deployment

1. Create a Vercel project with root directory `apps/web` and add the web variables above.
2. Set `NEXT_PUBLIC_APP_URL` to the final canonical URL before configuring OAuth redirects.
3. Deploy and verify `/`, `/impact`, `/privacy`, `/terms`, `/api/v1/config`, and `/api/v1/impact/current`.
4. Call the reconciliation route once with the cron bearer token and confirm a JSON `{ "reconciled": number }` response.
5. Configure AdMob SSV to `https://YOUR_HOST/api/webhooks/admob/rewarded` and verify a real test-device callback before enabling rewards.

In the current production inventory, the Android rewarded unit uses `https://screen-time-monorepo-web.vercel.app/api/webhooks/admob/rewarded`. European and US-state UMP messages are published. Google Auth Platform is in production mode with the public homepage, privacy, and terms URLs. The AdMob Reporting OAuth client and Vercel secrets are configured; an authenticated production run imported a real 14-day window as `admob_api`. Policy v3 enables the reward path for the closed Android beta; do not promote beyond the closed track until the Play association and signed-device SSV/consent run pass.

The workspace patches `decode-uri-component@0.2.2` because Expo Router's CommonJS dependency chain cannot consume the ESM-only 0.5.0 release. The patch backports the official 0.5.0 linear decoder for CVE-2026-45822; keep the matching audit exception and regression test together, and remove both once Expo Router ships a compatible fixed dependency.

## Mobile release

1. Add production mobile values to the EAS production environment. This repository is linked to `@goshops/still-screen-time` (`4d11d2ed-73c9-4442-aea8-1b4a6e8bd636`). Set `EXPO_PUBLIC_GOOGLE_AUTH_ENABLED=true`; Apple identity is not part of the product.
2. Run `eas credentials:configure-build -p android -e production`. The production profile explicitly uses remote credentials; EAS injects release signing into Gradle. Do not ship the committed debug keystore.
3. Run `eas build --platform android --profile production`, then `eas submit --platform android --profile production` when the closed-beta gates pass.
4. Enable Google Play App Signing and retain the upload credential according to the account recovery policy.

Google identity uses the web OAuth client callback `https://YOUR_PROJECT.supabase.co/auth/v1/callback`. Supabase must allow the mobile return URL `still://auth/callback`. The API requires a real linked Google identity before accepting an Impact vote.

## Verification

```sh
pnpm check
pnpm audit --prod --audit-level=moderate
npx expo-doctor@latest
supabase test db
pnpm --filter web build
cd apps/mobile/android && ./gradlew :app:compileDebugKotlin
```

For a production web smoke test, start `pnpm --filter web start` after the build and exercise the three public pages plus config/current/history APIs with a real configured backend. See `docs/test-report.md` for the latest repository verification.

## Failure and recovery notes

- If AdMob SSV is delayed, the pass remains provisional. Do not manually edit the ledger; the reconciliation job is idempotent.
- If donation recording fails after upload, the server action removes the uploaded object and reports an inline error.
- If Supabase Auth rejects account deletion, the API invokes `restore_financial_ledger_identity`. A `delete_rollback_failed` response requires operator investigation before retrying.
- If runtime config cannot be loaded, mobile uses its last validated cache for offline continuity. A cold install uses a disabled zero-cap policy; public Impact and config APIs fail explicitly rather than publishing defaults.
- Emulator builds validate compilation only. Accessibility behavior, AdMob SSV, kill/reboot recovery, and OEM timing require signed Android devices.

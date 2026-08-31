# Development and operations runbook

## Bootstrap

1. Install Node 22+, pnpm 10.8.1, Supabase CLI + Docker, Xcode 26, CocoaPods, Android SDK 36, and JDK 17.
2. Copy `.env.example`, `apps/web/.env.example`, and `apps/mobile/.env.example` to matching `.env.local` files.
3. Run `pnpm install --frozen-lockfile`.
4. Run `supabase start`, copy its local URL/keys into the env files, then run `supabase db reset` to apply migrations and `supabase/seed.sql`.
5. Run `pnpm dev:all`, then install a native build with `pnpm --filter mobile ios` or `pnpm --filter mobile android`. Expo Go is unsupported.

Do not run `expo prebuild --clean`: it removes the committed restriction-engine sources and extension targets. If native regeneration is unavoidable, preserve those directories, reapply the config plugin, run `ruby apps/mobile/scripts/configure-ios-targets.rb`, and then `pod install`.

The workspace is pinned to Expo SDK 57 / React Native 0.86.3. Xcode 26 needs `patches/expo-modules-jsi@57.0.6.patch`; pnpm applies it automatically. Re-evaluate the patch after any Expo, React Native, or Xcode upgrade and repeat both native builds. Expo Doctor's app-config synchronization check is disabled because the native projects are intentionally committed; `src/native/native-config.test.ts` verifies the corresponding Android/iOS values directly.

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
| `ADMOB_PUBLISHER_ACCOUNT`, `ADMOB_CLIENT_ID`, `ADMOB_CLIENT_SECRET`, `ADMOB_REFRESH_TOKEN` | web          | yes for revenue import | AdMob Reporting API                                 |
| `EXPO_PUBLIC_API_URL`                                                                      | mobile       | yes                    | public HTTPS web/API base URL                       |
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                         | mobile       | yes                    | mobile Auth only                                    |
| `EXPO_PUBLIC_EAS_PROJECT_ID`                                                               | mobile       | yes                    | EAS project binding                                 |
| `EXPO_PUBLIC_APPLE_AUTH_ENABLED`, `EXPO_PUBLIC_GOOGLE_AUTH_ENABLED`                        | mobile       | yes                    | display social linking only after provider setup    |
| `ADMOB_IOS_APP_ID`, `ADMOB_ANDROID_APP_ID`                                                 | mobile build | yes                    | native Mobile Ads initialization                    |
| `EXPO_PUBLIC_ADMOB_REWARDED_IOS`, `EXPO_PUBLIC_ADMOB_REWARDED_ANDROID`                     | mobile       | yes                    | rewarded ad units                                   |
| `EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_POSTHOG_HOST`                                      | mobile       | recommended            | privacy-scrubbed product analytics                  |
| `EXPO_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`                                                     | mobile/web   | recommended            | crash/error telemetry                               |

Use different high-entropy values for `REWARD_INTENT_SECRET`, `INTERNAL_JOB_SECRET`, and `CRON_SECRET`. Vercel automatically sends `Authorization: Bearer $CRON_SECRET` to cron routes. The reconciliation route falls back to `INTERNAL_JOB_SECRET` only for non-Vercel deployments.

`APP_VARIANT=production` is set by `eas.json`. Production config evaluation rejects HTTP endpoints, missing core values, and Google's sample AdMob identifiers. Sample IDs in `.env.example` are development-only.

## Database and storage

Apply every file in `supabase/migrations` in lexical order. For a linked project:

```sh
supabase link --project-ref YOUR_PROJECT_REF
supabase db push --dry-run
supabase db push
```

Review the dry run before applying. The migrations create RLS policies, server-only RPC grants, the public-read `donation-proofs` bucket, reward reconciliation, runtime-switch enforcement, and deletion rollback support. Never expose the service-role key to the mobile or browser bundles.

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
3. Deploy and verify `/`, `/impact`, `/privacy`, `/api/v1/config`, and `/api/v1/impact/current`.
4. Call the reconciliation route once with the cron bearer token and confirm a JSON `{ "reconciled": number }` response.
5. Configure AdMob SSV to `https://YOUR_HOST/api/webhooks/admob/rewarded` and verify a real test-device callback before enabling rewards.

In the current production inventory, both rewarded units use `https://screen-time-monorepo-web.vercel.app/api/webhooks/admob/rewarded`. European and US-state UMP messages are published. Keep the reward switch disabled until the apps are associated with their store listings and the signed-device SSV/consent run passes.

## Mobile release

1. Add production mobile values to the EAS production environment. This repository is linked to `@goshops/still-screen-time` (`4d11d2ed-73c9-4442-aea8-1b4a6e8bd636`).
2. Run `eas credentials:configure-build -p android -e production` and the iOS equivalent. The production profile explicitly uses remote credentials; EAS injects release signing into Gradle. Do not ship the committed debug keystore.
3. Obtain Family Controls distribution entitlements for the app and all iOS extensions.
4. Run `eas build --platform all --profile production`, then `eas submit --platform android --profile production` / iOS when the closed-beta gates pass.
5. Enable Google Play App Signing and retain the upload credential according to the account recovery policy.

## Verification

```sh
pnpm check
pnpm audit --prod --audit-level=moderate
npx expo-doctor@latest
supabase test db
pnpm --filter web build
cd apps/mobile/android && ./gradlew :app:compileDebugKotlin
cd apps/mobile/ios && pod install
xcodebuild -workspace Still.xcworkspace -scheme Still -configuration Debug \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO build
```

For a production web smoke test, start `pnpm --filter web start` after the build and exercise the three public pages plus config/current/history APIs with a real configured backend. See `docs/test-report.md` for the latest repository verification.

## Failure and recovery notes

- If AdMob SSV is delayed, the pass remains provisional. Do not manually edit the ledger; the reconciliation job is idempotent.
- If donation recording fails after upload, the server action removes the uploaded object and reports an inline error.
- If Supabase Auth rejects account deletion, the API invokes `restore_financial_ledger_identity`. A `delete_rollback_failed` response requires operator investigation before retrying.
- If runtime config cannot be loaded, mobile uses its last validated cache for offline continuity. A cold install uses a disabled zero-cap policy; public Impact and config APIs fail explicitly rather than publishing defaults.
- Simulator builds validate compilation only. Family Controls, Accessibility behavior, AdMob SSV, kill/reboot recovery, and OEM timing require signed physical devices.

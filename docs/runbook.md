# Development and operations runbook

## Bootstrap

1. Install Node 22+, pnpm 10.8.1, Supabase CLI + Docker, Android SDK 36, and JDK 17. Xcode 26+/CocoaPods are optional and used only for the unreleased iOS Shortcuts flow; installing on an iOS 27 device needs an Xcode with the iOS 27 SDK or an EAS build.
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
| `ADMOB_PUBLISHER_ACCOUNT`, `ADMOB_CLIENT_ID`, `ADMOB_CLIENT_SECRET`, `ADMOB_REFRESH_TOKEN` | web          | yes for revenue import | AdMob Reporting API; the refresh token in Vault wins over `ADMOB_REFRESH_TOKEN` |
| `EXPO_PUBLIC_API_URL`                                                                      | mobile       | yes                    | public HTTPS web/API base URL                       |
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                         | mobile       | yes                    | mobile Auth only                                    |
| `EXPO_PUBLIC_EAS_PROJECT_ID`                                                               | mobile       | yes                    | EAS project binding                                 |
| `EXPO_PUBLIC_GOOGLE_AUTH_ENABLED`                                                          | mobile       | yes; must be `true`    | enable the sole social identity provider            |
| `ADMOB_ANDROID_APP_ID`                                                                     | mobile build | yes                    | Android Mobile Ads initialization                   |
| `EXPO_PUBLIC_ADMOB_REWARDED_ANDROID`                                                       | mobile       | yes                    | Android rewarded ad unit                            |
| `ADMOB_IOS_APP_ID`, `EXPO_PUBLIC_ADMOB_REWARDED_IOS`                                       | unreleased iOS | no; required before an iOS release | iOS Shortcuts flow; sample defaults until then. The committed `Info.plist` already carries the production app id |
| `EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_POSTHOG_HOST`                                      | mobile       | recommended            | privacy-scrubbed product analytics                  |
| `EXPO_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`                                                     | mobile/web   | recommended            | crash/error telemetry                               |

Use different high-entropy values for `REWARD_INTENT_SECRET`, `INTERNAL_JOB_SECRET`, `CRON_SECRET`, and preferably `WAITLIST_RATE_LIMIT_SECRET`. Vercel automatically sends `Authorization: Bearer $CRON_SECRET` to cron routes. The reconciliation route falls back to `INTERNAL_JOB_SECRET` only for non-Vercel deployments; the waitlist uses a domain-separated HMAC with `INTERNAL_JOB_SECRET` when no dedicated key exists.

`EXPO_PUBLIC_API_URL` must be the final host, `https://get-still.app` in both EAS environments, never an address that redirects: on a redirect to another host phones drop the `Authorization` header and every signed-in call returns 401 (docs/app-store-review-plan.md §13). `pnpm deploy:apps` and `pnpm update:apps` refuse to run unless `${EXPO_PUBLIC_API_URL}/api/v1/config` answers 200 without a redirect. In Vercel, `NEXT_PUBLIC_APP_URL` is `https://get-still.app` as a **Config** variable (Vercel refuses a `NEXT_PUBLIC_` Secret, and a Secret can't become Config: delete and re-add it).

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

## Operations console access

`/admin/login` asks for an email and sends a one-time code only when that address belongs to a row in `admin_users` (`admin_login_allowed()`); any other address gets the same on-screen answer and no email, so the form cannot be used to mail arbitrary people. Requests and code attempts are rate limited per address and per email (`consume_rate_limit()`, HMAC keys only). After the code, the session is kept in that browser: `apps/web/proxy.ts` refreshes the Supabase session cookies on every `/admin` request, and **Cerrar sesión** ends it.

- The Supabase **Magic link or OTP** template (Authentication → Emails → Templates) is in Spanish and shows `{{ .Token }}` as the code, plus `{{ .ConfirmationURL }}` as a fallback link that signs in through `/auth/callback` in the same browser. Supabase only lets the template be edited while custom SMTP is on.
- To add an operator, create the user in Supabase Auth (Authentication → Users → Add user, with that email) and insert its id into `admin_users` with role `admin`, `operator` or `viewer`.
- Auth emails go through custom SMTP: Gmail (`smtp.gmail.com:465`, sender "Still" <pablocarvalhogimenez@gmail.com>) with a Google app password saved only in Supabase (Authentication → Emails → SMTP Settings). Supabase allows 30 emails per hour and one per address per minute. If sign-in emails stop arriving, the app password was probably revoked: create a new one in the Google account and paste it there.

## Scheduled and weekly operations

- Daily at 03:17 UTC: Vercel calls `GET /api/internal/jobs/reconcile-rewards`; stale provisional grants older than 26 hours are rejected and an available pass is reversed idempotently.
- Daily at 08:42 UTC: Vercel calls `GET /api/internal/jobs/admob-revenue`; the job refreshes the configured Google OAuth token and reads the previous 14 days from the AdMob Reporting API in `America/Los_Angeles` days (the only time zone the API accepts), storing each day in micros. `POST` remains available only for explicitly publisher-provided corrections. Both daily jobs also run `ensure_current_impact_week()`.
- Weeks run by themselves (`docs/real-impact-stats-plan.md`, D9): each Monday (Los Angeles calendar) the current week opens with the active percentages and the previous week's projects (or the three oldest active charities), and weeks that ended stop taking votes. Reading the Impact API does the same, so a missed cron never leaves an old week on screen.
- The fund of a week that is not confirmed is live: every rewarded ad AdMob confirms (SSV) is stored in `ad_views` with its estimated value (the SDK's impression value, else the observed eCPM, else `estimatedRewardedEcpmUsd`), and each day switches to AdMob's own report once it was imported a full day after the day closed.
- After a week ends, `/admin` lists it under «Semanas por cerrar»: confirm the gross (prefilled with the live figure) and later record the donation.
- After payment: upload the actual proof and record the donation. Publication occurs only after the database transition succeeds.
- If the AdMob job fails with `invalid_grant`, the Reporting refresh token expired or was revoked: from `apps/web`, run `pnpm admob:connect` and accept with the AdMob owner's Google account. The command checks that the account can read the publisher and stores the token in Supabase Vault (`set_admob_refresh_token`); the next import uses it, with no Vercel change or redeploy. `ADMOB_REFRESH_TOKEN` is only the fallback while Vault has no token. Until then the fund shows only the per-ad estimates.
- Impression-level ad revenue must be on in AdMob (Settings → Account) for the SDK to report each impression's value; without it every ad is priced by eCPM.

Every state-changing admin RPC writes `admin_audit_log`. Admin forms disable while pending and return inline success/error feedback; retry only after checking the current week state.

## Web deployment

1. Create a Vercel project with root directory `apps/web` and add the web variables above.
2. Set `NEXT_PUBLIC_APP_URL` to the final canonical URL before configuring OAuth redirects.
3. Deploy and verify `/`, `/impact`, `/privacy`, `/terms`, `/api/v1/config`, and `/api/v1/impact/current`.
4. Call the reconciliation route once with the cron bearer token and confirm a JSON `{ "reconciled": number }` response.
5. Configure AdMob SSV to `https://YOUR_HOST/api/webhooks/admob/rewarded` and verify a real test-device callback before enabling rewards.

Domains (Vercel → project → Settings → Domains): `get-still.app` serves Production; `www.get-still.app` 308-redirects to it; `screen-time-monorepo-web.vercel.app` serves Production **without** a redirect, because store builds before the 2026-09-26 OTA call the API there. Its pages still move to `get-still.app` through `apps/web/proxy.ts`, which never touches `/api`, `app-ads.txt` or `.well-known`. Check with `curl -sI`: `…vercel.app/api/v1/config` → 200, `…vercel.app/privacy` → 308 to `get-still.app`, `www.get-still.app` → 308 to `get-still.app`.

Supabase Auth → URL Configuration: Site URL `https://get-still.app`; redirect URLs `still://auth/callback`, `https://get-still.app/auth/callback`, and the old `…vercel.app/auth/callback` and `localhost`. Google Auth Platform branding uses `https://get-still.app` (home, `/privacy`, `/terms`) with authorized domains `get-still.app` and the Supabase project domain; `get-still.app` is verified in Search Console as a Domain property by a Cloudflare TXT record (keep it) and its sitemap is submitted. Since the brand is verified, Google's sign-in shows «Still» instead of the Supabase domain; a Supabase custom domain would need the Pro plan plus a USD 10/month add-on. Store listings point at `get-still.app`: App Store Connect privacy, support and marketing URLs, and Play's contact website (both set through the APIs on 2026-09-26). Play's privacy policy and account-deletion URLs live in App content and Data safety, with no API.

For the custom domain, set the Android rewarded unit's SSV callback in AdMob to `https://get-still.app/api/webhooks/admob/rewarded` and verify a signed test-device callback. European and US-state UMP messages are published. Google Auth Platform is in production mode with the public homepage, privacy, and terms URLs. Search Console verified the previous canonical property through the permanent production meta tag; verify the new domain property and submit its sitemap. Google's brand-review appeal is submitted and pending external review. The AdMob Reporting OAuth client and Vercel secrets are configured; an authenticated production run imported a real 14-day window as `admob_api`. Policy v3 enables the reward path for the closed Android beta; do not promote beyond the closed track until the Play association and signed-device SSV/consent run pass.

The workspace patches `decode-uri-component@0.2.2` because Expo Router's CommonJS dependency chain cannot consume the ESM-only 0.5.0 release. The patch backports the official 0.5.0 linear decoder for CVE-2026-45822; keep the matching audit exception and regression test together, and remove both once Expo Router ships a compatible fixed dependency.

## Mobile release

1. Add production mobile values to the EAS production environment. This repository is linked to `@pablo-carvalhos-team/still` (`0dffe42d-253f-40f4-9f70-5870276707ff`), owned by the personal Expo account; every store, signing and EAS credential belongs to the personal accounts (Apple team `JZ9HBXGNK9`, Play developer account "Still Screen Time"). Set `EXPO_PUBLIC_GOOGLE_AUTH_ENABLED=true`. The iOS app is `app.still.ios` with App Group `group.app.still.ios`; Android stays `com.still.screentime`.
2. Run `eas credentials:configure-build -p android -e production`. The production profile explicitly uses remote credentials; EAS injects release signing into Gradle. Do not ship the committed debug keystore.
3. Run `eas build --platform android --profile production`, then `eas submit --platform android --profile production` when the closed-beta gates pass.
4. Enable Google Play App Signing and retain the upload credential according to the account recovery policy.
5. `eas submit` reads its store keys from the releasing Mac, never from the repository: the App Store Connect API key at `~/.appstoreconnect/private_keys/AuthKey_A8PSU8WY52.p8`, and the Play service account JSON (`still-app@screentime-507114.iam.gserviceaccount.com`, Google Cloud project `screentime-507114`, invited in Play Console with "Release apps to testing tracks") at `~/.config/still/play-service-account.json`. `pnpm deploy:apps` (or `deploy:apps:ios` / `deploy:apps:android`; `--check` runs only the checks) refuses uncommitted or untracked changes, checks both keys against the store APIs, and refuses a version whose store build already has other native code. It then builds on this Mac with `eas build --local` (wrapped in `eas env:exec production` because `app.config.ts` validates production values; iOS needs a working CocoaPods and a UTF-8 locale, Android JDK 17 and `ANDROID_HOME`; `--cloud` builds on EAS instead) and uploads the builds itself: the IPA to TestFlight with `xcrun altool`, the AAB to Play's internal testing track through the Play API, and finally the newest internal release to the closed track `alpha`. Each local build is checked for over-the-air updates (on, runtime equal to the version, channel `production`) and tagged `store/<platform>/<version>+<build>` with its native fingerprint; push those tags (`git push origin <tag>`), `pnpm update:apps` reads them. iOS builds reach the internal TestFlight group once Apple processes them; Android internal testing updates at once for testers who accepted its opt-in link, and the closed track updates after Google's review.
6. JavaScript-only changes can reach the store builds people have without a new version: `pnpm update:apps` (or `update:apps:ios` / `update:apps:android`; `--check` exports and checks without publishing; `--message "..."`; `--rollout 10` for a share of phones) publishes an over-the-air update to EAS Update's `production` channel for the current version's store builds. It refuses uncommitted changes, a HEAD not in `main`, a version without store tags, native files on another version, and any native change since the store build (it lists the files: run `pnpm version:apps <next>`, commit, and `pnpm deploy:apps`). Bump versions only with `pnpm version:apps x.y.z`, which updates `app.config.ts` and every native file, runtime included; `deploy:apps` refuses mismatched files. Phones download at launch without waiting and apply at the next cold start, or on return to a tab after 5 minutes away, never mid-pause or mid-setup. `pnpm update:apps --rollback` (with `--runtime x.y.z` for an older version) sends everyone back to the store build's JavaScript. Only store builds from 0.3.5 on receive updates; TestFlight and the App Store share the channel, as do Play's tracks. Use updates for fixes, copy and small changes in flows the stores already reviewed; new features, the accessibility disclosure, ads, permissions or new data collection go through a store build. EAS Free covers 1,000 monthly update users. Details: `docs/ota-updates-plan.md`.

On iOS, Sign in with Apple links natively: the app sends Apple's ID token to Supabase (`linkIdentity` with a hashed nonce), so the Supabase Apple provider only needs `app.still.ios` in its client IDs and no Services ID or secret key. Votes accept a linked Apple or Google identity.

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

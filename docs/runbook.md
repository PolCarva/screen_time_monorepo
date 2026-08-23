# Development and operations runbook

## Bootstrap

1. Install Node 22+, pnpm 10, Xcode 26, CocoaPods, Android SDK 36, and JDK 17.
2. Copy root and app `.env.example` files to the corresponding `.env.local` files.
3. Run `pnpm install` and `supabase db reset` against a local Supabase stack.
4. Start Next.js with `pnpm --filter web dev` and Metro with `pnpm --filter mobile start`.
5. Install a custom native build with `pnpm --filter mobile ios` or `pnpm --filter mobile android`; Expo Go is unsupported.

Do not run `expo prebuild --clean`: it removes the committed restriction-engine sources and extension targets. If the base native project must be regenerated, preserve those directories and rerun `ruby apps/mobile/scripts/configure-ios-targets.rb` before `pod install`.

The mobile workspace is pinned to Expo SDK 57 / React Native 0.86.2. Xcode 26.0 needs the committed pnpm patch in `patches/expo-modules-jsi@57.0.5.patch`; `pnpm install --frozen-lockfile` applies it automatically. Recheck and preferably remove that patch after upgrading Expo or Xcode, then repeat the full iOS extension build.

## Required secrets

- Supabase URL, publishable key, service-role key, and database connection.
- `REWARD_INTENT_SECRET` and `INTERNAL_JOB_SECRET` (different high-entropy values).
- AdMob app/unit IDs, SSV callback URL, and Reporting API credentials.
- PostHog host/key and Sentry DSN/auth token.
- Apple/Google OAuth providers, Vercel cron secret, EAS project/signing configuration.

Production startup should fail closed when server secrets are missing. Mobile config uses the last validated ETag response or safe local defaults.

## Scheduled operations

- Daily: call `/api/internal/jobs/admob-revenue` with `Authorization: Bearer $INTERNAL_JOB_SECRET` and the reconciled report rows.
- Monday 00:00 UTC: create/open the week and snapshot the current impact/platform percentage.
- Sunday close: stop voting, reconcile final revenue, and select the winning candidate.
- After payment: upload the proof to the controlled public Storage bucket and use the admin console to record the donation.

Every admin action is inserted into `admin_audit_log`.

## Verification

Run `pnpm check`, then compile native code:

```sh
cd apps/mobile/android && ./gradlew :app:compileDebugKotlin
cd apps/mobile/ios && pod install
xcodebuild -workspace Still.xcworkspace -scheme Still -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

Simulator builds validate compilation only. Family Controls, Accessibility behavior, AdMob SSV, kill/reboot recovery, and OEM timing must be signed and tested on physical devices.

# Still — Screen Time Impact

Still is a bilingual iOS/Android app that adds an intentional pause before selected apps, offers non-transferable timed passes, and publishes a weekly record of the advertising revenue allocated to an Impact Fund.

This repository contains the complete v1 system:

- `apps/mobile` — Expo Router UI plus committed Swift/Kotlin restriction engines. Expo Go is not supported.
- `apps/web` — Next.js App Router API, public Impact record, privacy pages, internal jobs, and authenticated operations console.
- `packages/contracts` — shared Zod wire contracts and pure domain rules.
- `supabase` — PostgreSQL schema, RLS, transactional business functions, storage setup, migrations, and an intentionally empty development seed.

## What is real

- Anonymous Supabase sessions, provider-gated Apple/Google identity linking, device registration, wallet reads, rewarded-ad intent/claim/SSV lifecycle, idempotent unlock reporting, voting, wellbeing aggregates, export, and deletion are connected end to end. Social buttons remain disabled until their real provider is enabled; no placeholder login is exposed.
- iOS uses Family Controls, Managed Settings shields, Device Activity monitor/report extensions, an App Group wallet/outbox, and monotonic unlock deadlines.
- Android uses a disclosed Accessibility service, a local app picker, Usage Access aggregates, and monotonic unlock deadlines tied to the current boot.
- Impact pages use only persisted Supabase data. Missing or unavailable data is shown explicitly; production UI never substitutes demo totals.
- Operations can publish runtime policy, add verified charities, open/close weeks, reconcile revenue, upload validated donation proof files, and publish the donation through server-only transactional functions.
- The website beta form persists consented requests in `beta_waitlist`; it does not send mail to an unverified placeholder address.

See [the completion audit](docs/completion-audit.md) for the original gaps and their disposition.

## Local setup

Prerequisites: Node 22+, pnpm 10.8.1, Supabase CLI with Docker, JDK 17/Android SDK 36, and Xcode 26/CocoaPods for iOS.

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env.local
supabase start
supabase db reset
pnpm dev:all
```

Fill the Supabase URLs/keys printed by `supabase status`. The web app runs at `http://localhost:3000`; Metro starts alongside it. Install a native development build with:

```sh
pnpm --filter mobile ios
pnpm --filter mobile android
```

The development configuration permits Google sample ad identifiers. `APP_VARIANT=production` fails closed unless HTTPS API/Supabase endpoints, an EAS project ID, and non-sample AdMob app and rewarded-unit IDs are present.

## Verification

```sh
pnpm check
supabase test db
pnpm --filter web build
cd apps/mobile/android && ./gradlew :app:compileDebugKotlin
cd apps/mobile/ios && pod install
xcodebuild -workspace Still.xcworkspace -scheme Still -configuration Debug \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO build
```

The simulator/emulator builds prove compilation, not platform enforcement. The signed physical-device and store-review gates are listed in [native feasibility](docs/native-feasibility.md).

## Production deployment

1. Create a Supabase project, apply every migration in lexical order, then create real charities and publish policy through `/admin`; the repository does not seed public demo data. Configure Apple/Google Auth redirect URLs only after their real credentials exist.
2. Create a Vercel project rooted at `apps/web`, add the variables documented in [the runbook](docs/runbook.md), deploy, and verify the reward-reconciliation cron.
3. Configure the AdMob SSV callback to `/api/webhooks/admob/rewarded` and the Reporting API credentials for the revenue import job.
4. Configure EAS remote credentials, Apple Family Controls entitlements for the app and extensions, the EAS environment variables, then run `eas build --platform all --profile production` from `apps/mobile`.
5. Complete the signed-device matrix and the seven-day closed-beta soak before store rollout.

Detailed migration, job, credential, rollback, and release instructions are in [the operations runbook](docs/runbook.md). Architecture and trust boundaries are in [architecture](docs/architecture.md).

## Known external gates

Supabase, Vercel, approved AdMob inventory, real rewarded units and SSV callbacks, European/US-state consent messages, EAS, production data, cron authentication, and an Android store AAB are configured. Account-owner action is still required to accept Google Auth Platform's data policy and to sign in to Apple Developer; those steps gate Google/AdMob OAuth, Sign in with Apple, and Family Controls distribution. AdMob store association, Play Accessibility review, and signed physical-device/OEM validation also remain external release gates. PostHog and Sentry are optional and currently disabled rather than mocked. Until the platform gates pass, keep distribution on closed internal tracks.

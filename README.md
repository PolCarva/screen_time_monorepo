# Still — Screen Time Impact

Still is a bilingual Android app that adds an intentional pause before selected apps, offers non-transferable timed passes, and publishes a weekly record of the advertising revenue allocated to an Impact Fund. The repository retains an earlier iOS native spike for possible future use, but iOS is not built, distributed, or a gate for the current v1 release.

This repository contains the complete v1 system:

- `apps/mobile` — Expo Router UI plus committed Swift/Kotlin restriction engines. Expo Go is not supported.
- `apps/web` — Next.js App Router API, public Impact record, privacy pages, internal jobs, and authenticated operations console.
- `packages/contracts` — shared Zod wire contracts and pure domain rules.
- `supabase` — PostgreSQL schema, RLS, transactional business functions, storage setup, migrations, and an intentionally empty development seed.

## What is real

- Anonymous Supabase sessions, Google identity linking, device registration, wallet reads, rewarded-ad intent/claim/SSV lifecycle, idempotent unlock reporting, voting, wellbeing aggregates, export, and deletion are connected end to end. Google is the only social identity provider and the voting API verifies that identity server-side; no placeholder login is exposed.
- Android uses a disclosed Accessibility service, a local app picker, Usage Access aggregates, and monotonic unlock deadlines tied to the current boot.
- The dormant iOS spike contains Family Controls/Managed Settings work, but it has no current release commitment and requires no Apple account for the Android product.
- Impact pages use only persisted Supabase data. Missing or unavailable data is shown explicitly; production UI never substitutes demo totals.
- Operations can publish runtime policy, add verified charities, open/close weeks, reconcile revenue, upload validated donation proof files, and publish the donation through server-only transactional functions.
- The website beta form persists consented requests in `beta_waitlist`, enforces a transactional per-address rate limit without storing raw IPs, and does not send mail to an unverified placeholder address.

See [the completion audit](docs/completion-audit.md) for the original gaps and their disposition.

## Local setup

Prerequisites: Node 22+, pnpm 10.8.1, Supabase CLI with Docker, JDK 17, and Android SDK 36. Xcode/CocoaPods are optional and needed only to inspect the non-release iOS spike.

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
pnpm --filter mobile android
```

The development configuration permits Google sample ad identifiers. `APP_VARIANT=production` fails closed unless HTTPS API/Supabase endpoints, an EAS project ID, and non-sample AdMob app and rewarded-unit IDs are present.

## Verification

```sh
pnpm check
supabase test db
pnpm --filter web build
cd apps/mobile/android && ./gradlew :app:compileDebugKotlin
```

The emulator build proves compilation, not Android platform enforcement. The signed physical-device and Google Play review gates are listed in [native feasibility](docs/native-feasibility.md).

## Production deployment

1. Create a Supabase project, apply every migration in lexical order, then create real charities and publish policy through `/admin`; the repository does not seed public demo data. Configure Google Auth with the Supabase callback and allow `still://auth/callback` in the Supabase redirect allow-list.
2. Create a Vercel project rooted at `apps/web`, add the variables documented in [the runbook](docs/runbook.md), deploy, and verify the reward-reconciliation cron.
3. Configure the AdMob SSV callback to `/api/webhooks/admob/rewarded` and the Reporting API credentials for the revenue import job. Publish OAuth with public homepage, privacy, and terms URLs so operator refresh tokens are not limited to testing mode.
4. Configure EAS Android remote credentials and the production environment variables, then run `eas build --platform android --profile production` from `apps/mobile`.
5. Complete the signed-device matrix and the seven-day closed-beta soak before store rollout.

Detailed migration, job, credential, rollback, and release instructions are in [the operations runbook](docs/runbook.md). Architecture and trust boundaries are in [architecture](docs/architecture.md).

## Known external gates

Supabase, Google identity, Google Auth Platform production publishing, Vercel, AdMob Reporting OAuth, approved Android AdMob inventory, the real rewarded unit and SSV callback, European/US-state consent messages, EAS, production policy v3, cron authentication, and an Android store AAB are configured. Google Search Console verified the canonical web property; Google's brand-review appeal is submitted and is now an external review. The production Reporting job imported and persisted a real 14-day `admob_api` window; its zero revenue/impression totals are the truthful pre-traffic state. Brand review, Play store association, Accessibility review, and signed physical-device/OEM validation remain external release gates. iOS and Apple Developer enrollment are explicitly outside v1, so the Android release does not require the USD 99/year membership. PostHog and Sentry are optional and currently disabled rather than mocked. Until the remaining Android gates pass, keep distribution on closed internal tracks.

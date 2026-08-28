# Screen Time Impact

A bilingual React Native app that adds a deliberate pause before distracting apps, uses non-transferable unlock tokens, and makes a weekly Impact Fund transparent.

## Workspace

- `apps/mobile` — Expo Router app with committed iOS and Android native projects.
- `apps/web` — Next.js API, public impact site, and minimal admin.
- `packages/contracts` — Zod API contracts and domain rules shared by both apps.
- `supabase` — PostgreSQL migrations, row-level security, and seed data.

## Local setup

1. Copy `.env.example` to `.env.local` and fill the Supabase values.
2. Run `pnpm install`.
3. Run `npm run dev:all` (or `pnpm dev:all`) to start the Next.js web/API service and the Expo Metro server together.
4. Because the app contains native Screen Time and Accessibility integrations, use development builds (`pnpm --filter mobile ios` / `android`), not Expo Go.

See `docs/implementation-status.md`, `docs/architecture.md`, `docs/native-feasibility.md`, `docs/store-compliance.md`, and `docs/runbook.md` before changing native enforcement behavior or configuring an environment.

## Validation

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm --filter web build
cd apps/mobile/android && ./gradlew :app:compileDebugKotlin
cd apps/mobile/ios && xcodebuild -workspace Still.xcworkspace -scheme Still \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO build
```

The simulator build validates compilation. The restriction engines must still pass the signed physical-device matrix described in `docs/native-feasibility.md`; Apple Family Controls entitlements and Play Accessibility review cannot be simulated locally.

The committed dependency patch under `patches/` is required by Xcode 26.0 and is applied by pnpm. See the runbook before changing Expo, React Native, or regenerating native projects.

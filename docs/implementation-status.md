# Implementation status

Updated 2026-08-23.

## Implemented in this repository

- pnpm monorepo with Expo SDK 57 / React Native 0.86.2, Next.js 16, shared Zod contracts, CI, environment templates, and committed native projects.
- Bilingual onboarding and core mobile surfaces: Today, Tokens, Impact, Settings, and intervention.
- iOS Family Controls picker, Managed Settings Shield Action/Configuration, Device Activity Monitor/Report extensions, app-group wallet/outbox, and monotonic unlock restoration.
- Android launcher picker, minimal Accessibility service, intervention activity, Usage Stats aggregates, local wallet/outbox, monotonic unlock restoration, and no overlay or `QUERY_ALL_PACKAGES` permission.
- Anonymous Supabase authentication with Apple/Google identity linking for voting.
- Versioned remote configuration with validation, cache fallback, wallet limits, Emergency Unlocks, AdMob adapter, UMP consent, reward intents, provisional claims, signed SSV verification, and append-only token ledger.
- All planned v1 API routes, privacy export/delete, daily wellbeing aggregates, public Impact pages, authenticated admin operations, AdMob revenue import, donation proof records, and audit log.
- PostgreSQL RLS and server-only business RPCs. Unlock duration/time, reward timestamps, weekly snapshots, voting transitions, and donation transitions are database-controlled and atomic.
- Privacy-safe PostHog/Sentry boundary that removes application identity fields.

## Verified locally

- `pnpm check`: 15 unit tests pass; TypeScript and ESLint pass.
- Next.js production build: 18 routes generated successfully.
- Android Kotlin compile: succeeds with min SDK 29, compile SDK 36, and target SDK 36.
- iOS simulator workspace compile: succeeds for the app and all four extension targets with Xcode/iOS SDK 26.
- All migrations plus seed apply to a clean PostgreSQL 18 database. Security assertions confirm authenticated clients cannot execute business RPCs directly and unlock sessions use the server clock and the configured 600-second duration.

## External release gates

The implementation is not a validated store beta until these account/device-dependent checks pass:

1. Apple approves Family Controls distribution entitlements for the app and every extension bundle ID.
2. The signed iOS 16.4/current-device matrix proves Shield, kill/reboot recovery, and reblock behavior.
3. The Android 10–16 Pixel/Samsung/Xiaomi matrix proves intervention latency and OEM behavior.
4. Play accepts the Accessibility declaration/disclosure and evidence video.
5. Real Supabase, Vercel, OAuth, AdMob SSV/Reporting, UMP, PostHog, Sentry, EAS, and signing credentials are configured.
6. Seven-day soak, crash-free, reblock, duplicate-grant, and no-fill fallback acceptance thresholds pass.

Keep external beta closed until both platform gates pass, as specified in `native-feasibility.md`.

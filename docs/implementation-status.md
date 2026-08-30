# Implementation status

Updated 2026-08-30.

## Implemented in this repository

- pnpm monorepo with Expo SDK 57 / React Native 0.86.2, Next.js 16, shared Zod contracts, CI, environment templates, and committed native projects.
- Bilingual onboarding and core mobile surfaces: Today, Tokens, Impact, Settings, and intervention.
- iOS Family Controls picker, Managed Settings Shield Action/Configuration, Device Activity Monitor/Report extensions, app-group wallet/outbox, and monotonic unlock restoration.
- Android launcher picker, minimal Accessibility service, intervention activity, Usage Stats aggregates, local wallet/outbox, monotonic unlock restoration, and no overlay or `QUERY_ALL_PACKAGES` permission.
- Anonymous Supabase authentication with provider-gated Apple/Google identity linking and linked-provider status for voting/recovery.
- Versioned remote configuration with validation, cache fallback, platform/reward/voting kill switches enforced in UI and PostgreSQL, wallet limits, Emergency Unlocks, AdMob adapter, UMP consent, reward intents, provisional claims, signed SSV verification, stale-claim reconciliation, and append-only token ledger.
- All planned v1 API routes, persisted beta waitlist, privacy export/delete with compensating rollback, daily wellbeing aggregates, truthful public Impact pages, authenticated admin policy/charity/week operations, automatic AdMob Reporting import, validated donation-proof upload, and audit log.
- PostgreSQL RLS and server-only business RPCs. Unlock duration/time, reward timestamps, weekly snapshots, voting transitions, and donation transitions are database-controlled and atomic.
- Privacy-safe PostHog/Sentry boundary that removes application identity fields.
- Offline-aware mobile sync status, cached wallet/config/metrics, durable iOS unlock outbox, permission repair, dynamic unlock copy, native weekly iOS reports, and full local cleanup after account deletion.
- Production mobile config that rejects missing HTTPS endpoints, missing EAS binding, and sample AdMob identifiers.

## Verified locally

- `pnpm lint`, `pnpm typecheck`, and `pnpm test`: 35 unit tests pass across contracts, mobile, and web.
- Clean local Supabase startup applies every migration plus seed; 15 pgTAP database invariants pass for RPC grants, runtime switches, reward reconciliation, hidden-debt prevention, and privacy-deletion recovery.
- Next.js production build and Playwright production smoke: public pages and configured config/current/history APIs respond successfully with no browser console or failed-response errors.
- Android Kotlin compile: succeeds with min SDK 29, compile SDK 36, and target SDK 36.
- iOS simulator workspace compile: succeeds for the app and all four extension targets with Xcode/iOS SDK 26.
- Every migration through `202608300001` applies cleanly to the local Supabase PostgreSQL 17 image. The empty seed introduces no public fixtures. Database lint reports only the intentional wire-compatibility parameters documented in the functions.

## External release gates

The implementation is not a validated store beta until these account/device-dependent checks pass:

1. Apple approves Family Controls distribution entitlements for the app and every extension bundle ID.
2. The signed iOS 16.4/current-device matrix proves Shield, kill/reboot recovery, and reblock behavior.
3. The Android 10–16 Pixel/Samsung/Xiaomi matrix proves intervention latency and OEM behavior.
4. Play accepts the Accessibility declaration/disclosure and evidence video.
5. Real Supabase, Vercel, OAuth, AdMob SSV/Reporting, UMP, PostHog, Sentry, EAS, and signing credentials are configured, and the new migrations are applied to that project.
6. Seven-day soak, crash-free, reblock, duplicate-grant, and no-fill fallback acceptance thresholds pass.

Keep external beta closed until both platform gates pass, as specified in `native-feasibility.md`.

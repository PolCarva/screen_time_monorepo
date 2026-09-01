# Implementation status

Updated 2026-08-31.

The current v1 release scope is Android-only. The existing iOS native spike is retained as dormant future code, but it is not built, distributed, or treated as an external release gate.

## Implemented in this repository

- pnpm monorepo with Expo SDK 57 / React Native 0.86.3, Next.js 16, shared Zod contracts, CI, environment templates, and committed native projects.
- Bilingual onboarding and core mobile surfaces: Today, Tokens, Impact, Settings, and intervention.
- Dormant iOS spike with a Family Controls picker and extension prototypes, retained for possible future work without a current distribution commitment.
- Android launcher picker, minimal Accessibility service, intervention activity, Usage Stats aggregates, local wallet/outbox, monotonic unlock restoration, and no overlay or `QUERY_ALL_PACKAGES` permission.
- Anonymous Supabase authentication with Google-only identity linking and linked-provider status for voting/recovery. The voting API verifies the Google identity server-side.
- Versioned remote configuration with validation, cache fallback, platform/reward/voting kill switches enforced in UI and PostgreSQL, wallet limits, Emergency Unlocks, AdMob adapter, UMP consent, reward intents, provisional claims, signed SSV verification, stale-claim reconciliation, and append-only token ledger.
- All planned v1 API routes, persisted beta waitlist, privacy export/delete with compensating rollback, daily wellbeing aggregates, truthful public Impact pages, authenticated admin policy/charity/week operations, automatic AdMob Reporting import, validated donation-proof upload, and audit log.
- PostgreSQL RLS and server-only business RPCs. Unlock duration/time, reward timestamps, weekly snapshots, voting transitions, and donation transitions are database-controlled and atomic.
- Privacy-safe PostHog/Sentry boundary that removes application identity fields.
- Offline-aware mobile sync status, cached wallet/config/metrics, Android permission repair, dynamic unlock copy, durable native state, and full local cleanup after account deletion.
- Production mobile config that rejects missing HTTPS endpoints, missing EAS binding, and sample AdMob identifiers.

## Verified locally

- `pnpm lint`, `pnpm typecheck`, and `pnpm test`: 53 unit tests pass across contracts, mobile, and web, including Google identity enforcement, analytics consent, security headers, waitlist rate limiting, native wallet fail-closed behavior, AdMob, deep-link, permission, extension, entitlement, and persisted beta-signup assertions.
- Expo Doctor passes all 20 applicable checks. The committed-native-project synchronization warning is disabled explicitly after the same fields are verified by the native-config regression suite.
- `pnpm audit --prod --audit-level=moderate` exits successfully. Expo Router's CommonJS-only transitive `decode-uri-component` dependency carries a reviewed exception for CVE-2026-45822 only after the official 0.5.0 linear decoder was backported and covered by a bounded-time regression test. The transitive Expo `xcode` UUID dependency is constrained to the patched release.
- Clean local Supabase startup applies every migration plus seed; 16 pgTAP database invariants pass for RPC grants, runtime switches, bounded active reward intents, reward reconciliation, hidden-debt prevention, and privacy-deletion recovery.
- Next.js production build and Playwright production smoke: public pages and configured config/current/history APIs respond successfully with no browser console or failed-response errors.
- Android Kotlin compile: succeeds with min SDK 29, compile SDK 36, and target SDK 36.
- The dormant iOS workspace previously compiled with signing disabled; this is historical source evidence, not a current release requirement.
- Every migration through `202608310002` applies cleanly and is deployed to production Supabase. The empty seed introduces no public fixtures. Database lint reports only the intentional wire-compatibility parameters documented in the functions.
- A disposable authenticated production flow passed device registration, wallet, wellbeing, reward intent, Emergency Unlock, complete export, deletion, cascade cleanup, and retained-ledger pseudonymization.
- Google Auth Platform is published for external users with real homepage/privacy/terms URLs. Google Search Console verified the canonical web property under the project account, the ownership token is live in production, and Google's brand-review appeal is submitted. AdMob OAuth refresh, account access, report generation, the production Vercel job, and persistence of its 14-day `admob_api` window all passed.
- Expo Router's transitive `decode-uri-component` CVE-2026-45822 is mitigated with a CommonJS-compatible backport of the official 0.5.0 linear decoder. The production audit accepts only that reviewed CVE exception, and a bounded-time regression test covers the patch.

## External release gates

The implementation is not a validated store beta until these account/device-dependent checks pass:

1. The Android 10–16 Pixel/Samsung/Xiaomi matrix proves intervention latency and OEM behavior.
2. Play accepts the Accessibility declaration/disclosure and evidence video.
3. A signed Android-device flow validates the configured Google identity link and return URL.
4. A signed Android AdMob test-device run validates UMP, reward delivery, and SSV; the AdMob app must then be linked to its Play listing. PostHog and Sentry remain optional and deliberately disabled until accounts are selected.
5. Seven-day soak, crash-free, reblock, duplicate-grant, and no-fill fallback acceptance thresholds pass.
6. Google completes the submitted OAuth brand review; the verification center confirms that no sensitive or restricted-scope review is required.

Keep the Android beta closed until these gates pass, as specified in `native-feasibility.md`. Apple enrollment and iOS distribution are outside v1.

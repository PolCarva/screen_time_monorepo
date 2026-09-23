# Architecture

The current release target is Android only. iOS does not participate in v1 deployment or release gating: its Shortcuts-based pause (`ios-shortcuts.md`) is implemented but unreleased and disabled remotely by default, and the older Family Controls shields are switched off whenever Shortcuts mode is active.

Still is a pnpm monorepo with three deployable surfaces:

- `apps/mobile`: Expo Router UI plus committed Swift/Kotlin projects. It requires a development or store build; Expo Go cannot load the restriction engines.
- `apps/web`: Next.js App Router API, public Impact pages, internal jobs, and an authenticated operations console.
- `packages/contracts`: shared Zod request/response contracts and pure domain rules.

Supabase owns Auth, PostgreSQL, RLS, and donation-proof storage. The mobile app talks directly to Supabase only for Auth; business reads and mutations cross the Next.js API, which uses the service role after authenticating the caller. Vercel runs the web/API, daily reward reconciliation, and daily AdMob Reporting import.

## Sources of truth

| Concern                             | Authoritative state                           | Local/offline projection                           |
| ----------------------------------- | --------------------------------------------- | -------------------------------------------------- |
| Rewarded pass balance               | Append-only `token_ledger`                    | SQLite + native App Group/SharedPreferences wallet |
| Unlock duration and timestamps      | Window the user chose + PostgreSQL clock      | Monotonic native deadline for enforcement          |
| Selected apps and detailed activity | Native device-only storage/framework          | Never uploaded                                     |
| Ads watched and their value         | `ad_views` (one row per AdMob-confirmed ad)   | None                                               |
| Weekly Impact totals/status         | `impact_week_totals()` over `ad_views`, `revenue_daily`, `wellbeing_daily`, votes and donations | Read cache only; no demo fallback |
| Runtime switches                    | Active validated `remote_config_versions` row | Last validated config; a cold install fails closed |
| Identity                            | Supabase Auth                                 | SecureStore session                                |

The native wallet is deliberately a projection so the shield/intervention can respond without a network round trip. All native spends are reported through an idempotent outbox and reconciled with the server wallet on foreground.

## Privacy boundary

Selected applications, bundle/package identifiers, Family Controls tokens, and detailed usage history stay inside the iOS App Group or Android SharedPreferences/Usage Stats boundary. The API accepts only a generic app category and daily aggregate counts. Analytics scrubbing rejects common app-identity fields before PostHog or Sentry receive data.

Account deletion pseudonymizes the financial ledger before deleting the Auth user. Because Supabase Auth deletion is an external Admin API transaction, a compensating database function restores the ledger identity if Auth rejects the deletion. Local deletion also removes SQLite state, native selections, shields/sessions, and pending iOS notifications.

## Critical flows

1. A native detector finds a locally selected target and presents the native intervention. Platform kill switches are applied locally and rechecked by the unlock database function.
2. For a React Native unlock, the native engine creates a monotonic session first; only then is the projected wallet spent and the idempotent event reported. This prevents a failed native schedule from consuming a pass. The iOS Shield extension performs the same local spend/outbox sequence atomically before removing the shield.
3. A rewarded ad starts with a signed server intent that lives 24 hours (the Android shield keeps three pre-signed). The trusted SDK callback is claimed server-side before a pass enters the local wallet. AdMob SSV verifies the signed callback with Google's rotating keys and a unique transaction ID. Provisional grants without valid SSV are rejected after 26 hours; an available pass is reversed without creating hidden negative debt. A saved pass is the only way in without an ad (emergency access was removed), and the pause offers it next to the ad. A visit paid by a fresh ad names that ad's intent, so the server spends that ad's pass and never one saved earlier.
4. Every SSV callback Google signs becomes an `ad_views` row, with or without an intent. Its value is what the SDK reported for that impression (impression-level ad revenue, capped at USD 0.10), else the eCPM observed in the last four weeks of AdMob reports, else the configured `estimatedRewardedEcpmUsd`. Test impressions (unknown precision, zero value) count for nothing.
5. A scheduled job refreshes an offline OAuth token and imports per-day AdMob Reporting API earnings in micros, in `America/Los_Angeles` days. An unconfirmed week is computed live by `impact_week_totals()`: settled report days use AdMob's figure, recent days the larger of the partial report and the ads' estimates. Weeks open and close their voting by themselves; an operator confirms revenue, uploads a signature-validated proof file, records the actual donation transactionally, and only then publishes the proof.
6. People and time returned come from the per-device local days the app uploads (up to 14 at a time); the server computes the minutes from the counts and the active configuration.
7. Public Impact responses return persisted data or explicit unconfigured/empty/error states. Build-time or transient backend failures are never cached as fabricated public totals.

## Operational invariants

- `token_ledger` is append-only; grants, reversals, and spends have unique idempotency keys.
- Per-user advisory locks serialize reward claims, reconciliation, and unlock spending in a consistent lock order.
- Reward creation accepts only the implemented AdMob provider and enforces the active reward switch, balance cap, and UTC daily limit in PostgreSQL.
- Unlock insertion and rewarded-token spending happen in one database transaction; the recorded duration is the window the user chose (60 s to 24 h) and server config owns platform enablement.
- Voting requires a linked identity, an open week, an active candidate, and the active voting switch.
- A week snapshots the impact/platform percentages; later config changes cannot rewrite history.
- Native unlock expiry uses monotonic uptime and boot identity rather than the editable wall clock.
- Expected API failures use stable codes; unexpected server details are logged with a request ID and never returned to clients.

## Deployment

- Web/API/jobs: Vercel, with Node runtime for AdMob SSV/reporting and `vercel.json` for both daily schedules.
- Database/Auth/Storage: Supabase migrations in lexical order; the donation-proof bucket is public-read and server-write.
- Android: EAS development/preview/production profiles. Production uses EAS remote signing credentials and fails config evaluation when required endpoints or real Android AdMob identifiers are missing.

# Architecture

Still is a pnpm monorepo with three deployable surfaces:

- `apps/mobile`: Expo Router UI plus committed Swift/Kotlin projects. It requires a development or store build; Expo Go cannot load the restriction engines.
- `apps/web`: Next.js App Router API, public Impact pages, internal jobs, and an authenticated operations console.
- `packages/contracts`: shared Zod request/response contracts and pure domain rules.

Supabase owns Auth, PostgreSQL, RLS, and donation-proof storage. The mobile app talks directly to Supabase only for Auth; business reads and mutations cross the Next.js API, which uses the service role after authenticating the caller. Vercel runs the web/API, daily reward reconciliation, and daily AdMob Reporting import.

## Sources of truth

| Concern                             | Authoritative state                           | Local/offline projection                           |
| ----------------------------------- | --------------------------------------------- | -------------------------------------------------- |
| Rewarded pass balance               | Append-only `token_ledger`                    | SQLite + native App Group/SharedPreferences wallet |
| Emergency allowance                 | UTC-day ledger count and active remote config | Cached wallet for offline use                      |
| Unlock duration and timestamps      | Active config + PostgreSQL clock              | Monotonic native deadline for enforcement          |
| Selected apps and detailed activity | Native device-only storage/framework          | Never uploaded                                     |
| Weekly Impact totals/status         | `impact_weeks`, revenue, votes, donations     | Read cache only; no demo fallback                  |
| Runtime switches                    | Active validated `remote_config_versions` row | Last validated config; a cold install fails closed |
| Identity                            | Supabase Auth                                 | SecureStore session                                |

The native wallet is deliberately a projection so the shield/intervention can respond without a network round trip. All native spends are reported through an idempotent outbox and reconciled with the server wallet on foreground.

## Privacy boundary

Selected applications, bundle/package identifiers, Family Controls tokens, and detailed usage history stay inside the iOS App Group or Android SharedPreferences/Usage Stats boundary. The API accepts only a generic app category and daily aggregate counts. Analytics scrubbing rejects common app-identity fields before PostHog or Sentry receive data.

Account deletion pseudonymizes the financial ledger before deleting the Auth user. Because Supabase Auth deletion is an external Admin API transaction, a compensating database function restores the ledger identity if Auth rejects the deletion. Local deletion also removes SQLite state, native selections, shields/sessions, and pending iOS notifications.

## Critical flows

1. A native detector finds a locally selected target and presents the native intervention. Platform kill switches are applied locally and rechecked by the unlock database function.
2. For a React Native unlock, the native engine creates a monotonic session first; only then is the projected wallet spent and the idempotent event reported. This prevents a failed native schedule from consuming a pass. The iOS Shield extension performs the same local spend/outbox sequence atomically before removing the shield.
3. A rewarded ad starts with a signed, expiring server intent. The trusted SDK callback is claimed server-side before a pass enters the local wallet. AdMob SSV verifies the signed callback with Google's rotating keys and a unique transaction ID. Provisional grants without valid SSV are rejected after 26 hours; an available pass is reversed without creating hidden negative debt.
4. A scheduled job refreshes an offline OAuth token and imports per-day AdMob Reporting API earnings in USD minor units. Missing report days become explicit zero rows only after a successful report response. An operator closes voting, confirms revenue, uploads a signature-validated proof file, records the actual donation transactionally, and only then publishes the proof.
5. Public Impact responses return persisted data or explicit unconfigured/empty/error states. Build-time or transient backend failures are never cached as fabricated public totals.

## Operational invariants

- `token_ledger` is append-only; grants, reversals, and spends have unique idempotency keys.
- Per-user advisory locks serialize reward claims, reconciliation, and unlock spending in a consistent lock order.
- Reward creation accepts only the implemented AdMob provider and enforces the active reward switch, balance cap, and UTC daily limit in PostgreSQL.
- Unlock insertion and rewarded-token spending happen in one database transaction; server config owns duration and platform enablement.
- Voting requires a linked identity, an open week, an active candidate, and the active voting switch.
- A week snapshots the impact/platform percentages; later config changes cannot rewrite history.
- Native unlock expiry uses monotonic uptime and boot identity rather than the editable wall clock.
- Expected API failures use stable codes; unexpected server details are logged with a request ID and never returned to clients.

## Deployment

- Web/API/jobs: Vercel, with Node runtime for AdMob SSV/reporting and `vercel.json` for both daily schedules.
- Database/Auth/Storage: Supabase migrations in lexical order; the donation-proof bucket is public-read and server-write.
- iOS/Android: EAS development/preview/production profiles. Production uses EAS remote signing credentials and fails config evaluation when required endpoints or real AdMob identifiers are missing.

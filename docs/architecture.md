# Architecture

Still is a pnpm monorepo with three deployable surfaces:

- `apps/mobile`: Expo Router UI plus committed Swift/Kotlin projects. It must run as a custom development or store build; Expo Go cannot load the restriction engines.
- `apps/web`: Next.js App Router API, public Impact pages, and a small authenticated operations console.
- `packages/contracts`: Zod request/response contracts and pure domain state machines.

Supabase owns authentication, PostgreSQL, row-level security, and donation-proof storage. The mobile app talks directly to Supabase only for authentication; every business mutation crosses the Next.js API. Token balance is derived from an append-only ledger.

## Privacy boundary

Selected applications, bundle/package identifiers, and detailed device-usage history stay inside the native app-group/shared-preference boundary. The API accepts only generic app categories and daily counts. Analytics scrubbing rejects common app-identity keys before PostHog or Sentry receive data.

## Critical flows

1. A native detector finds a locally selected target and presents a native intervention.
2. “Ahora no” exits immediately. Unlock requests move through React Native, reserve one ledger unit server-side, then create a monotonic native session.
3. Rewarded ads start with a signed server intent. The client callback creates a provisional ledger grant, and AdMob SSV later verifies it using Google's rotating public keys and unique transaction ID.
4. Impact revenue is imported as estimated. An operator closes voting, confirms revenue, records the actual donation, and only then publishes its proof.

## Operational invariants

- `token_ledger` is append-only and every grant/spend has a unique idempotency key.
- Reward intent creation is serialized per user and enforces balance, UTC daily, and unresolved-claim limits in PostgreSQL.
- Unlock session insertion and rewarded-token spending happen in one database transaction.
- A week snapshots the impact percentage; later config changes cannot alter it.
- Native unlock expiry is based on monotonic uptime and boot identity, not the editable wall clock.

## Deployment

- Web/API: Vercel, Node runtime for SSV verification.
- Database/auth/storage: Supabase migrations in lexical order.
- iOS/Android: EAS development/preview/production profiles, with native projects committed and signing provided by the deployment environment.


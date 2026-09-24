import type { PendingUnlockEvent } from "@/native/restriction-engine";

/**
 * What `POST /api/v1/unlock-sessions` receives for a visit. It names the ad
 * that paid for it: without that the server has nothing to charge the visit
 * to and refuses it (saved passes are gone, docs/ads-only-pause-plan.md D6).
 */
export function unlockReportBody(event: PendingUnlockEvent, deviceId: string) {
  return {
    clientSessionId: event.clientSessionId,
    source: "rewarded" as const,
    durationSeconds: event.durationSeconds,
    startedAt: event.startedAt,
    deviceId,
    appCategory: "other" as const,
    ...(event.rewardIntentId ? { rewardIntentId: event.rewardIntentId } : {}),
  };
}

export function mergePendingUnlockEvents(
  ...queues: PendingUnlockEvent[][]
): PendingUnlockEvent[] {
  const events = queues.flat();
  return events.filter(
    (event, index) =>
      events.findIndex(
        (candidate) => candidate.clientSessionId === event.clientSessionId,
      ) === index,
  );
}

/**
 * A visit paid by an ad the shield just showed spends what that ad earns.
 * Until that reward is claimed the server has nothing to spend, so the report
 * waits and the reward and the spend reach the server together.
 */
export function splitReportableUnlocks(
  events: PendingUnlockEvent[],
  unclaimedIntentIds: ReadonlySet<string>,
): { now: PendingUnlockEvent[]; later: PendingUnlockEvent[] } {
  const now: PendingUnlockEvent[] = [];
  const later: PendingUnlockEvent[] = [];
  for (const event of events) {
    if (event.rewardIntentId && unclaimedIntentIds.has(event.rewardIntentId))
      later.push(event);
    else now.push(event);
  }
  return { now, later };
}

/**
 * Refusals that no retry can fix: an unknown source (an emergency access
 * queued by an older build) or a visit that names no ad (a saved pass queued
 * by an older build). Retrying them would keep Still "offline" forever.
 */
const DEFINITIVE_UNLOCK_REFUSALS = new Set([
  "invalid_unlock_source",
  "insufficient_balance",
  "validation_error",
]);

export function isDefinitiveUnlockRefusal(code: string | undefined): boolean {
  return code !== undefined && DEFINITIVE_UNLOCK_REFUSALS.has(code);
}

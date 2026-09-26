/**
 * The `pause_ad_gate` analytics event (docs/ad-preload-plan.md, P9): what the
 * pause met on opening (`ad`), what it offered once any wait was over
 * (`offered`) and how long that took. How often `ad` is "ready" is how often
 * nobody saw "Preparing the ad…". Nothing names the app or the time.
 */
export type PauseAdGateEvent = {
  platform: "ios" | "android";
  ad: "ready" | "preparing" | "none";
  offered: "ready" | "none";
  waitedMs: number;
};

const OPENED = new Set(["ready", "preparing", "none"]);
const OFFERED = new Set(["ready", "none"]);
/** Anything past this is a clock oddity, not a wait. */
const MAX_WAIT_MS = 60_000;

/**
 * The events for what the Android shield recorded, oldest first. Malformed
 * entries are dropped; waits are whole milliseconds, capped at a minute.
 */
export function pauseAdGateEventsFromShield(
  entries: readonly unknown[],
): PauseAdGateEvent[] {
  const events: PauseAdGateEvent[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const { ad, offered, waitedMs } = entry as Record<string, unknown>;
    if (typeof ad !== "string" || !OPENED.has(ad)) continue;
    if (typeof offered !== "string" || !OFFERED.has(offered)) continue;
    if (typeof waitedMs !== "number" || !Number.isFinite(waitedMs)) continue;
    events.push({
      platform: "android",
      ad: ad as PauseAdGateEvent["ad"],
      offered: offered as PauseAdGateEvent["offered"],
      waitedMs: Math.min(MAX_WAIT_MS, Math.max(0, Math.round(waitedMs))),
    });
  }
  return events;
}

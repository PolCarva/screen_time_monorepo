/**
 * Buffer of pre-signed rewarded-ad intents the native Android shield consumes
 * offline. React Native tops it up while it is in the foreground so the ad flow
 * never has to reach the network mid-intervention (Android parity plan §2).
 *
 * Pure and React-Native-free so it can be unit tested (D6). The server lets at
 * most five intents wait per user and expires each one a day after creation
 * (docs/real-impact-stats-plan.md, D10); the shield keeps three, which leaves
 * room for the one the app prepares for its own ad.
 */
export type SignedRewardIntent = {
  id: string;
  customData: string;
  userId: string;
  /** ISO-8601 instant. */
  expiresAt: string;
};

/** Three for the shield; the server allows five waiting per user. */
export const REWARD_INTENT_BUFFER_CAPACITY = 3;

/**
 * Drop an intent unless it stays valid for at least `skewMs` more, so the shield
 * never receives one that expires between the top-up and the tap.
 */
export function pruneExpiredIntents(
  intents: readonly SignedRewardIntent[],
  nowMs: number,
  skewMs = 60_000,
): SignedRewardIntent[] {
  const threshold = nowMs + skewMs;
  return intents.filter((intent) => {
    const expiry = Date.parse(intent.expiresAt);
    return Number.isFinite(expiry) && expiry > threshold;
  });
}

/** How many fresh intents to create to refill the buffer to capacity. */
export function intentsNeeded(
  validCount: number,
  capacity = REWARD_INTENT_BUFFER_CAPACITY,
): number {
  return Math.max(0, capacity - validCount);
}

/** Remove an intent by id, e.g. once its earned reward has been claimed. */
export function removeIntent(
  intents: readonly SignedRewardIntent[],
  id: string,
): SignedRewardIntent[] {
  return intents.filter((intent) => intent.id !== id);
}

/** De-duplicate by id, keeping the first occurrence, capped at capacity. */
export function mergeIntents(
  existing: readonly SignedRewardIntent[],
  added: readonly SignedRewardIntent[],
  capacity = REWARD_INTENT_BUFFER_CAPACITY,
): SignedRewardIntent[] {
  const seen = new Set<string>();
  const result: SignedRewardIntent[] = [];
  for (const intent of [...existing, ...added]) {
    if (seen.has(intent.id)) continue;
    seen.add(intent.id);
    result.push(intent);
    if (result.length >= capacity) break;
  }
  return result;
}

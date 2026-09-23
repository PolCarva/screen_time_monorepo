import type { Wallet } from "@screen-time/contracts";

import type { PendingUnlockEvent } from "@/native/restriction-engine";

export function addProvisionalReward(
  wallet: Wallet,
  maximumBalance: number,
): Wallet {
  return {
    ...wallet,
    rewardedBalance: Math.min(maximumBalance, wallet.rewardedBalance + 1),
    unresolvedRewardClaims: wallet.unresolvedRewardClaims + 1,
  };
}

/** A pass is the only thing a visit can spend: emergency access was removed. */
export function spendLocalWallet(wallet: Wallet): Wallet {
  if (wallet.rewardedBalance < 1)
    throw new Error("insufficient_rewarded_balance");
  if (wallet.rewardedPassesRemainingToday < 1)
    throw new Error("daily_pass_limit_reached");
  return {
    ...wallet,
    rewardedBalance: wallet.rewardedBalance - 1,
    rewardedPassesRemainingToday: wallet.rewardedPassesRemainingToday - 1,
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

export function projectPendingUnlocks(
  serverWallet: Wallet,
  events: PendingUnlockEvent[],
): Wallet {
  return events.reduce((wallet) => {
    try {
      return spendLocalWallet(wallet);
    } catch {
      // The server is authoritative when another client already spent the
      // balance. Never let a local projection create a negative balance.
      return wallet;
    }
  }, serverWallet);
}

/**
 * A visit paid by an ad the shield just showed spends the pass that ad earns.
 * Until that reward is claimed the server has nothing to spend, so the report
 * waits; reporting it first would take a pass the user saved earlier.
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
 * queued by an older build), a pass the server does not have, or today's limit
 * already used. Retrying them would keep Still "offline" forever, and a retry
 * on a later day would spend a pass the user earns then.
 */
const DEFINITIVE_UNLOCK_REFUSALS = new Set([
  "invalid_unlock_source",
  "insufficient_balance",
  "daily_pass_limit",
  "validation_error",
]);

export function isDefinitiveUnlockRefusal(code: string | undefined): boolean {
  return code !== undefined && DEFINITIVE_UNLOCK_REFUSALS.has(code);
}

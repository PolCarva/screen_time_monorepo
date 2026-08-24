import type { Wallet } from "@screen-time/contracts";

import type { PendingUnlockEvent } from "@/native/restriction-engine";

export function addProvisionalReward(wallet: Wallet, maximumBalance: number): Wallet {
  return {
    ...wallet,
    rewardedBalance: Math.min(maximumBalance, wallet.rewardedBalance + 1),
    unresolvedRewardClaims: wallet.unresolvedRewardClaims + 1,
  };
}

export function spendLocalWallet(wallet: Wallet, source: "rewarded" | "emergency"): Wallet {
  if (source === "rewarded") {
    if (wallet.rewardedBalance < 1) throw new Error("insufficient_rewarded_balance");
    return { ...wallet, rewardedBalance: wallet.rewardedBalance - 1 };
  }
  if (wallet.emergencyRemaining < 1) throw new Error("daily_emergency_limit_reached");
  return { ...wallet, emergencyRemaining: wallet.emergencyRemaining - 1 };
}

export function mergePendingUnlockEvents(
  ...queues: PendingUnlockEvent[][]
): PendingUnlockEvent[] {
  const events = queues.flat();
  return events.filter(
    (event, index) =>
      events.findIndex((candidate) => candidate.clientSessionId === event.clientSessionId) === index,
  );
}

export function projectPendingUnlocks(
  serverWallet: Wallet,
  events: PendingUnlockEvent[],
): Wallet {
  return events.reduce((wallet, event) => {
    try {
      return spendLocalWallet(wallet, event.source);
    } catch {
      // The server is authoritative when another client already spent the
      // balance. Never let a local projection create a negative balance.
      return wallet;
    }
  }, serverWallet);
}

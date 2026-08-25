import { defaultRemoteConfig } from "@screen-time/contracts";

import { requireApiUser } from "@/lib/auth";
import { HttpError, routeError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase";

function nextUtcDay(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
}

export async function GET(request: Request) {
  try {
    const user = await requireApiUser(request);
    const client = createAdminClient()!;
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const [balanceResult, emergencyResult, claimsResult, configResult, earnedTodayResult] = await Promise.all([
      client.rpc("rewarded_balance", { p_user_id: user.id }),
      client
        .from("token_ledger")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("entry_type", "emergency_spend")
        .gte("created_at", startOfDay.toISOString()),
      client
        .from("reward_intents")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("state", "provisional")
        .is("verified_at", null),
      client.from("remote_config_versions").select("payload").eq("is_active", true).maybeSingle(),
      client
        .from("reward_intents")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .in("state", ["provisional", "verified"])
        .gte("created_at", startOfDay.toISOString()),
    ]);
    if (balanceResult.error) throw new HttpError(500, "wallet_failed", balanceResult.error.message);
    const config = { ...defaultRemoteConfig, ...(configResult.data?.payload ?? {}) };

    return Response.json(
      {
        rewardedBalance: Math.max(Number(balanceResult.data ?? 0), 0),
        emergencyRemaining: Math.max(config.dailyEmergencyUnlocks - (emergencyResult.count ?? 0), 0),
        unresolvedRewardClaims: claimsResult.count ?? 0,
        rewardAdsRemainingToday: Math.max(config.maxRewardedAdsPerUtcDay - (earnedTodayResult.count ?? 0), 0),
        resetAt: nextUtcDay(),
      },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}

import { remoteConfigSchema } from "@screen-time/contracts";

import { requireApiUser } from "@/lib/auth";
import { HttpError, routeError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase";
import { resolveUserPreferences } from "@/lib/user-preferences";

function nextUtcDay(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  ).toISOString();
}

export async function GET(request: Request) {
  try {
    const user = await requireApiUser(request);
    const client = createAdminClient()!;
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const [
      balanceResult,
      emergencyResult,
      claimsResult,
      configResult,
      earnedTodayResult,
      rewardedUnlocksTodayResult,
      preferencesResult,
    ] = await Promise.all([
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
      client
        .from("remote_config_versions")
        .select("payload")
        .eq("is_active", true)
        .maybeSingle(),
      client
        .from("reward_intents")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .in("state", ["provisional", "verified"])
        .gte("earned_at", startOfDay.toISOString()),
      client
        .from("unlock_sessions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("source", "rewarded")
        .gte("created_at", startOfDay.toISOString()),
      client
        .from("user_preferences")
        .select(
          "daily_pass_limit, unlock_duration_seconds, max_rewarded_ads_per_utc_day, updated_at",
        )
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);
    const walletError =
      balanceResult.error ??
      emergencyResult.error ??
      claimsResult.error ??
      configResult.error ??
      earnedTodayResult.error ??
      rewardedUnlocksTodayResult.error ??
      preferencesResult.error;
    if (walletError)
      throw new HttpError(
        503,
        "wallet_failed",
        "Wallet is temporarily unavailable",
      );
    const parsedConfig = remoteConfigSchema.safeParse(
      configResult.data?.payload,
    );
    if (!parsedConfig.success)
      throw new HttpError(
        503,
        "config_unavailable",
        "No active configuration is available",
      );
    const config = parsedConfig.data;
    const preferences = resolveUserPreferences(config, preferencesResult.data);

    return Response.json(
      {
        rewardedBalance: Math.max(Number(balanceResult.data ?? 0), 0),
        rewardedPassesRemainingToday: Math.max(
          preferences.dailyPassLimit - (rewardedUnlocksTodayResult.count ?? 0),
          0,
        ),
        emergencyRemaining: Math.max(
          config.dailyEmergencyUnlocks - (emergencyResult.count ?? 0),
          0,
        ),
        unresolvedRewardClaims: claimsResult.count ?? 0,
        rewardAdsRemainingToday: Math.max(
          preferences.maxRewardedAdsPerUtcDay - (earnedTodayResult.count ?? 0),
          0,
        ),
        resetAt: nextUtcDay(),
      },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}

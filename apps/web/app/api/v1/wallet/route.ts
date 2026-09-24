import { requireApiUser } from "@/lib/auth";
import { HttpError, routeError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase";

/**
 * Saved passes and the daily limits are gone (docs/ads-only-pause-plan.md): the
 * pause offers only the ad. Current builds no longer read this route. Builds
 * published before that still do, so it keeps their shape with values that
 * leave them with ads and no passes: an empty balance is never offered as a
 * pass, and the remaining counts never reach zero. Drop the route once no
 * such build is in use.
 */
const LEGACY_PASSES_REMAINING_TODAY = 20;
const LEGACY_ADS_REMAINING_TODAY = 30;

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
    const claimsResult = await client
      .from("reward_intents")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("state", "provisional")
      .is("verified_at", null);
    if (claimsResult.error)
      throw new HttpError(
        503,
        "wallet_failed",
        "Wallet is temporarily unavailable",
      );

    return Response.json(
      {
        rewardedBalance: 0,
        rewardedPassesRemainingToday: LEGACY_PASSES_REMAINING_TODAY,
        // Required by builds from before 2026-09-23; always 0 now that
        // emergency access is gone.
        emergencyRemaining: 0,
        unresolvedRewardClaims: claimsResult.count ?? 0,
        rewardAdsRemainingToday: LEGACY_ADS_REMAINING_TODAY,
        resetAt: nextUtcDay(),
      },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}

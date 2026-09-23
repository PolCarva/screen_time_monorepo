import type { SupabaseClient } from "@supabase/supabase-js";

import { type VerifiedSsv, verifyAdMobSsv } from "@/lib/admob-ssv";
import { verifyRewardIntent } from "@/lib/reward-intent";
import { createAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";

/** A signed intent still earns its pass up to a day after it expires. */
const PASS_WINDOW_MS = 24 * 60 * 60 * 1_000;

/**
 * Rules that can refuse the pass without making the ad any less real: the ad
 * still counts for the fund, and Google must not retry the callback.
 */
const EXPECTED_CLAIM_REFUSALS = [
  "reward_intent_expired",
  "wallet_balance_cap_reached",
  "daily_reward_limit_reached",
] as const;

type IntentClaims = ReturnType<typeof verifyRewardIntent>;

function readIntent(customData: string | null): IntentClaims | null {
  if (!customData) return null;
  try {
    return verifyRewardIntent(decodeURIComponent(customData));
  } catch {
    // Custom data Still did not sign cannot earn a pass; the ad still counts.
    return null;
  }
}

async function grantVerifiedPass(
  client: SupabaseClient,
  intent: IntentClaims,
  ssv: VerifiedSsv,
  rewardedAt: string,
) {
  const { data: row, error } = await client
    .from("reward_intents")
    .select("id, state")
    .eq("id", intent.intentId)
    .eq("user_id", intent.userId)
    .maybeSingle();
  if (error) throw error;
  if (!row) return;

  if (row.state !== "provisional" && row.state !== "verified") {
    const { error: claimError } = await client.rpc("claim_reward_intent", {
      p_user_id: intent.userId,
      p_intent_id: intent.intentId,
      p_client_event_id: crypto.randomUUID(),
      p_earned_at: rewardedAt,
    });
    if (claimError) {
      if (EXPECTED_CLAIM_REFUSALS.some((code) => claimError.message.includes(code)))
        return;
      throw claimError;
    }
  }

  // Only the first callback for an intent verifies it; a later ad that reused
  // the same custom data is counted as a view but cannot move the link.
  const now = new Date().toISOString();
  const { error: verifyError } = await client
    .from("reward_intents")
    .update({
      state: "verified",
      provider_transaction_id: ssv.transactionId,
      verified_at: now,
      updated_at: now,
    })
    .eq("id", intent.intentId)
    .eq("user_id", intent.userId)
    .in("state", ["provisional", "verified"])
    .is("provider_transaction_id", null);
  if (verifyError && verifyError.code !== "23505") throw verifyError;
}

export async function GET(request: Request) {
  let ssv: VerifiedSsv;
  try {
    ssv = await verifyAdMobSsv(request.url);
  } catch (error) {
    console.error("AdMob SSV rejected", error);
    return new Response("Invalid callback", { status: 400 });
  }

  const client = createAdminClient();
  if (!client) return new Response("Backend unavailable", { status: 503 });

  try {
    const intent = readIntent(ssv.customData);
    const rewardedAt = new Date(ssv.timestampMs).toISOString();
    // Google signed it: a real ad was watched and paid for, so it counts for
    // the fund whatever happens to the pass (docs/real-impact-stats-plan.md, D4).
    const { error: viewError } = await client.rpc("record_verified_ad_view", {
      p_transaction_id: ssv.transactionId,
      p_ad_unit: ssv.adUnit,
      p_rewarded_at: rewardedAt,
      p_intent_id: intent?.intentId ?? null,
      p_user_id: intent?.userId ?? null,
    });
    if (viewError) throw viewError;

    if (
      intent &&
      new Date(intent.expiresAt).getTime() + PASS_WINDOW_MS >= Date.now()
    ) {
      await grantVerifiedPass(client, intent, ssv, rewardedAt);
    }
    return new Response("OK", { status: 200 });
  } catch (error) {
    // Google retries a failed callback a few times; both steps are idempotent.
    console.error("AdMob SSV could not be recorded", error);
    return new Response("Temporarily unavailable", { status: 503 });
  }
}

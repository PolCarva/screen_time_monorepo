import { verifyAdMobSsv } from "@/lib/admob-ssv";
import { verifyRewardIntent } from "@/lib/reward-intent";
import { createAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const ssv = await verifyAdMobSsv(request.url);
    const claims = verifyRewardIntent(decodeURIComponent(ssv.customData));
    if (new Date(claims.expiresAt).getTime() + 24 * 60 * 60 * 1_000 < Date.now()) {
      throw new Error("Reward intent is outside the verification window");
    }

    const client = createAdminClient();
    if (!client) return new Response("Backend unavailable", { status: 503 });
    const { data: intent } = await client
      .from("reward_intents")
      .select("id, user_id, state")
      .eq("id", claims.intentId)
      .eq("user_id", claims.userId)
      .maybeSingle();
    if (!intent) throw new Error("Reward intent not found");

    if (intent.state !== "provisional" && intent.state !== "verified") {
      const { error: claimError } = await client.rpc("claim_reward_intent", {
        p_user_id: claims.userId,
        p_intent_id: claims.intentId,
        p_client_event_id: crypto.randomUUID(),
        p_earned_at: new Date(ssv.timestampMs).toISOString(),
      });
      if (claimError) throw claimError;
    }

    const { error } = await client
      .from("reward_intents")
      .update({
        state: "verified",
        provider_transaction_id: ssv.transactionId,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", claims.intentId);

    if (error && error.code !== "23505") throw error;
    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("AdMob SSV rejected", error);
    return new Response("Invalid callback", { status: 400 });
  }
}

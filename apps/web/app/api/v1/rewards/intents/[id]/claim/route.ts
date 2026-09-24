import { claimRewardRequestSchema } from "@screen-time/contracts";

import { requireApiUser } from "@/lib/auth";
import { databaseHttpError, parseJson, routeError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser(request);
    const input = await parseJson(request, claimRewardRequestSchema);
    const { id } = await context.params;
    const client = createAdminClient()!;
    if (input.adValue) {
      // What the SDK said this impression paid. Recorded before the claim so a
      // pass refused by a limit or an expired intent still prices the ad; it
      // only counts once AdMob confirms the view.
      const { error: valueError } = await client.rpc("record_ad_paid_value", {
        p_user_id: user.id,
        p_intent_id: id,
        p_value_micros: input.adValue.valueMicros,
        p_currency: input.adValue.currency,
        p_precision: input.adValue.precision,
        p_viewed_at: input.earnedAt,
      });
      if (valueError && !valueError.message.includes("reward_intent_not_found"))
        console.error("Ad value could not be recorded", valueError.message);
    }
    const { data, error } = await client.rpc("claim_reward_intent", {
      p_user_id: user.id,
      p_intent_id: id,
      p_client_event_id: input.clientEventId,
      p_earned_at: input.earnedAt,
    });
    if (error)
      throw databaseHttpError(
        error.message,
        [
          [
            "reward_intent_not_found",
            404,
            "reward_intent_not_found",
            "Reward intent was not found",
          ],
          [
            "reward_intent_expired",
            409,
            "reward_intent_expired",
            "Reward intent has expired",
          ],
        ],
        {
          status: 409,
          code: "reward_claim_failed",
          message: "Reward could not be claimed",
        },
      );
    return Response.json({ intentId: data.id, status: data.state });
  } catch (error) {
    return routeError(error);
  }
}

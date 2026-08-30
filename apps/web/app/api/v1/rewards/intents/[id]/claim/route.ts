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
          [
            "wallet_balance_cap_reached",
            409,
            "wallet_full",
            "Pass limit reached",
          ],
          [
            "daily_reward_limit_reached",
            409,
            "daily_reward_limit",
            "Daily reward limit reached",
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

import { claimRewardRequestSchema } from "@screen-time/contracts";

import { requireApiUser } from "@/lib/auth";
import { HttpError, parseJson, routeError } from "@/lib/http";
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
    if (error) throw new HttpError(409, "reward_claim_failed", error.message);
    return Response.json({ intentId: data.id, status: data.state });
  } catch (error) {
    return routeError(error);
  }
}

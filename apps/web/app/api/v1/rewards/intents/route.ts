import { createRewardIntentRequestSchema } from "@screen-time/contracts";

import { requireApiUser } from "@/lib/auth";
import { HttpError, parseJson, requireIdempotencyKey, routeError } from "@/lib/http";
import { signRewardIntent } from "@/lib/reward-intent";
import { createAdminClient } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request);
    const input = await parseJson(request, createRewardIntentRequestSchema);
    const idempotencyKey = requireIdempotencyKey(request);
    const client = createAdminClient()!;

    const intentId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1_000).toISOString();
    const customData = signRewardIntent({ intentId, userId: user.id, expiresAt });
    const { data, error } = await client.rpc("create_reward_intent", {
      p_id: intentId,
      p_user_id: user.id,
      p_device_id: input.deviceId,
      p_provider: input.provider,
      p_custom_data: customData,
      p_expires_at: expiresAt,
      p_idempotency_key: idempotencyKey,
    });
    if (error) {
      const notFound = error.message.includes("device_not_found");
      throw new HttpError(notFound ? 404 : 409, "reward_intent_failed", error.message);
    }
    return Response.json(
      {
        id: data.id,
        customData: data.custom_data,
        provider: data.provider,
        expiresAt: data.expires_at,
      },
      { status: 201 },
    );
  } catch (error) {
    return routeError(error);
  }
}

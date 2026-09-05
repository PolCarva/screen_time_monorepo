import { createUnlockSessionRequestSchema } from "@screen-time/contracts";

import { requireApiUser } from "@/lib/auth";
import { databaseHttpError, parseJson, routeError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request);
    const input = await parseJson(request, createUnlockSessionRequestSchema);
    const client = createAdminClient()!;
    const { data, error } = await client.rpc("create_unlock_session", {
      p_user_id: user.id,
      p_client_session_id: input.clientSessionId,
      p_device_id: input.deviceId,
      p_source: input.source,
      p_duration_seconds: input.durationSeconds,
      p_app_category: input.appCategory,
      p_started_at: input.startedAt,
    });
    if (error)
      throw databaseHttpError(
        error.message,
        [
          [
            "device_not_found",
            404,
            "device_not_found",
            "Device is not registered",
          ],
          [
            "restrictions_disabled",
            409,
            "restrictions_disabled",
            "Pauses are temporarily disabled for this platform",
          ],
          [
            "insufficient_rewarded_balance",
            409,
            "insufficient_balance",
            "No rewarded pass is available",
          ],
          [
            "daily_emergency_limit_reached",
            409,
            "emergency_limit",
            "Daily emergency limit reached",
          ],
          [
            "daily_pass_limit_reached",
            409,
            "daily_pass_limit",
            "Daily pass limit reached",
          ],
          [
            "invalid_unlock_source",
            400,
            "invalid_unlock_source",
            "Unlock source is invalid",
          ],
        ],
        {
          status: 409,
          code: "unlock_failed",
          message: "Unlock could not be recorded",
        },
      );
    return Response.json(
      { id: data.id, endsAt: data.ends_at, source: data.source },
      { status: 201 },
    );
  } catch (error) {
    return routeError(error);
  }
}

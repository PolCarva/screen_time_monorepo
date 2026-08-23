import { createUnlockSessionRequestSchema } from "@screen-time/contracts";

import { requireApiUser } from "@/lib/auth";
import { HttpError, parseJson, routeError } from "@/lib/http";
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
    if (error) throw new HttpError(409, "unlock_failed", error.message);
    return Response.json(
      { id: data.id, endsAt: data.ends_at, source: data.source },
      { status: 201 },
    );
  } catch (error) {
    return routeError(error);
  }
}

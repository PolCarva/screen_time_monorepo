import { registerDeviceRequestSchema } from "@screen-time/contracts";

import { requireApiUser } from "@/lib/auth";
import { HttpError, parseJson, routeError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request);
    const input = await parseJson(request, registerDeviceRequestSchema);
    const client = createAdminClient()!;
    const { data, error } = await client.rpc("register_device", {
      p_user_id: user.id,
      p_installation_id: input.installationId,
      p_platform: input.platform,
      p_app_version: input.appVersion,
      p_os_version: input.osVersion,
      p_locale: input.locale,
      p_timezone: input.timezone,
    });
    if (error) throw new HttpError(400, "device_registration_failed", error.message);
    return Response.json(
      { deviceId: data.id, registeredAt: data.created_at },
      { status: 201 },
    );
  } catch (error) {
    return routeError(error);
  }
}

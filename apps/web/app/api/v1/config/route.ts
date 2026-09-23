import { remoteConfigSchema } from "@screen-time/contracts";

import { HttpError, routeError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase";

export async function GET(request: Request) {
  try {
    const client = createAdminClient();
    if (!client)
      throw new HttpError(
        503,
        "service_unconfigured",
        "Configuration service is not configured",
      );
    const { data, error } = await client
      .from("remote_config_versions")
      .select("payload")
      .eq("is_active", true)
      .maybeSingle();
    if (error)
      throw new HttpError(
        503,
        "config_unavailable",
        "Configuration is temporarily unavailable",
      );
    const parsed = remoteConfigSchema.safeParse(data?.payload);
    if (!parsed.success || !data)
      throw new HttpError(
        503,
        "config_unavailable",
        "No active configuration is available",
      );
    const config = parsed.data;

    const etag = `W/\"config-${config.version}\"`;
    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304, headers: { etag } });
    }
    // Builds from before 2026-09-23 require the emergency allowance and would
    // fall back to a closed default without it. It is always 0 now that
    // emergency access is gone; drop it once no older build is in use.
    return Response.json({ ...config, dailyEmergencyUnlocks: 0 }, {
      headers: {
        etag,
        "cache-control": "public, max-age=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    return routeError(error);
  }
}

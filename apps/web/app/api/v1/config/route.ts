import { defaultRemoteConfig, remoteConfigSchema } from "@screen-time/contracts";

import { routeError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase";

export async function GET(request: Request) {
  try {
    const client = createAdminClient();
    let config = defaultRemoteConfig;
    if (client) {
      const { data } = await client
        .from("remote_config_versions")
        .select("payload")
        .eq("is_active", true)
        .maybeSingle();
      const parsed = remoteConfigSchema.safeParse(data?.payload);
      if (parsed.success) config = parsed.data;
    }

    const etag = `W/\"config-${config.version}\"`;
    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304, headers: { etag } });
    }
    return Response.json(config, {
      headers: {
        etag,
        "cache-control": "public, max-age=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    return routeError(error);
  }
}

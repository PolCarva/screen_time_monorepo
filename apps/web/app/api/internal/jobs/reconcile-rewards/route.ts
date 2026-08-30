import { HttpError, routeError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const expected = process.env.CRON_SECRET ?? process.env.INTERNAL_JOB_SECRET;
    if (
      !expected ||
      request.headers.get("authorization") !== `Bearer ${expected}`
    ) {
      throw new HttpError(401, "unauthorized", "Invalid internal job token");
    }
    const client = createAdminClient();
    if (!client)
      throw new HttpError(
        503,
        "backend_not_configured",
        "Supabase is not configured",
      );
    const { data, error } = await client.rpc("reconcile_stale_reward_intents", {
      p_limit: 500,
    });
    if (error)
      throw new HttpError(
        503,
        "reconciliation_failed",
        "Reward reconciliation failed",
      );
    return Response.json(
      { reconciled: Number(data ?? 0) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}

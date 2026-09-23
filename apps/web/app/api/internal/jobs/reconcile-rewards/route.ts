import { HttpError, routeError } from "@/lib/http";
import { ensureCurrentImpactWeek } from "@/lib/impact";
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
    // Also runs on the AdMob job; either one keeps the week current even if
    // the other fails (docs/real-impact-stats-plan.md, D9).
    await ensureCurrentImpactWeek(client);
    return Response.json(
      { reconciled: Number(data ?? 0) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}

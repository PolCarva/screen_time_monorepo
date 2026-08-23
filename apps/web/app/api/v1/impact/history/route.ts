import { getCurrentImpactWeek } from "@/lib/impact";
import { routeError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase";

export async function GET() {
  try {
    const client = createAdminClient();
    if (!client) return Response.json([await getCurrentImpactWeek()]);
    const { data, error } = await client
      .from("impact_weeks")
      .select("id, week_start, week_end, status, currency, gross_revenue_minor, impact_fund_minor, impact_percentage, revenue_is_estimated, donations(proof_url)")
      .neq("status", "draft")
      .order("week_start", { ascending: false })
      .limit(52);
    if (error) throw error;
    return Response.json(data, { headers: { "cache-control": "public, max-age=300" } });
  } catch (error) {
    return routeError(error);
  }
}

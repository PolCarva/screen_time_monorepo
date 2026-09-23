import { impactHistorySchema } from "@screen-time/contracts";

import { HttpError, routeError } from "@/lib/http";
import { loadWeekTotals } from "@/lib/impact";
import { createAdminClient } from "@/lib/supabase";

export async function GET() {
  try {
    const client = createAdminClient();
    if (!client)
      throw new HttpError(
        503,
        "service_unconfigured",
        "Impact service is not configured",
      );
    const { data, error } = await client
      .from("impact_weeks")
      .select(
        "id, week_start, week_end, status, currency, gross_revenue_minor, impact_fund_minor, impact_percentage, revenue_is_estimated, donations(proof_url)",
      )
      .neq("status", "draft")
      .order("week_start", { ascending: false })
      .limit(52);
    if (error)
      throw new HttpError(
        503,
        "impact_unavailable",
        "Impact history is temporarily unavailable",
      );
    const weeks = data ?? [];
    // Weeks not yet confirmed show the live estimate, like the current week.
    const totals = await loadWeekTotals(client, weeks).catch(() => {
      throw new HttpError(
        503,
        "impact_unavailable",
        "Impact history is temporarily unavailable",
      );
    });
    const history = weeks.map((week) => {
      const donation = Array.isArray(week.donations)
        ? week.donations[0]
        : week.donations;
      const amounts = totals.get(week.id)!;
      return {
        id: week.id,
        weekStart: week.week_start,
        weekEnd: week.week_end,
        status: week.status,
        currency: week.currency,
        grossRevenueMinor: amounts.grossRevenueMinor,
        impactFundMinor: amounts.impactFundMinor,
        impactPercentage: Number(week.impact_percentage),
        isEstimated: week.revenue_is_estimated,
        donationProofUrl: donation?.proof_url ?? null,
      };
    });
    return Response.json(impactHistorySchema.parse(history), {
      headers: { "cache-control": "public, max-age=300" },
    });
  } catch (error) {
    return routeError(error);
  }
}

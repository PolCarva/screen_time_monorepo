import { z } from "zod";

import { HttpError, parseJson, routeError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase";

const revenueImportSchema = z.object({
  date: z.string().date(),
  grossRevenueMinor: z.number().int().nonnegative(),
  impressions: z.number().int().nonnegative(),
  precision: z.enum(["estimated", "precise", "publisher_provided"]).default("estimated"),
});

export async function POST(request: Request) {
  try {
    const expected = process.env.INTERNAL_JOB_SECRET;
    if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) {
      throw new HttpError(401, "unauthorized", "Invalid internal job token");
    }
    const input = await parseJson(request, revenueImportSchema);
    const client = createAdminClient();
    if (!client) throw new HttpError(503, "backend_not_configured", "Supabase is not configured");
    const { error } = await client.from("revenue_daily").upsert({
      date: input.date,
      gross_revenue_minor: input.grossRevenueMinor,
      impressions: input.impressions,
      precision: input.precision,
      imported_at: new Date().toISOString(),
    });
    if (error) throw error;

    const { data: week, error: weekError } = await client
      .from("impact_weeks")
      .select("id, week_start, week_end")
      .eq("status", "open")
      .lte("week_start", input.date)
      .gte("week_end", input.date)
      .maybeSingle();
    if (weekError) throw weekError;
    if (week) {
      const { data: rows, error: rowsError } = await client
        .from("revenue_daily")
        .select("gross_revenue_minor")
        .gte("date", week.week_start)
        .lte("date", week.week_end);
      if (rowsError) throw rowsError;
      const total = (rows ?? []).reduce((sum, row) => sum + Number(row.gross_revenue_minor), 0);
      const { error: updateError } = await client
        .from("impact_weeks")
        .update({ gross_revenue_minor: total, updated_at: new Date().toISOString() })
        .eq("id", week.id)
        .eq("status", "open");
      if (updateError) throw updateError;
    }
    return Response.json({ imported: true });
  } catch (error) {
    return routeError(error);
  }
}

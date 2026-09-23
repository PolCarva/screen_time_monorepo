import { timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { fetchAdMobRevenue, type AdMobRevenueDay } from "@/lib/admob-reporting";
import { HttpError, parseJson, routeError } from "@/lib/http";
import { ensureCurrentImpactWeek } from "@/lib/impact";
import { createAdminClient } from "@/lib/supabase";

const revenueImportSchema = z.object({
  date: z.string().date(),
  grossRevenueMinor: z.number().int().nonnegative(),
  impressions: z.number().int().nonnegative(),
  precision: z
    .enum(["estimated", "precise", "publisher_provided"])
    .default("publisher_provided"),
});

function authorize(request: Request) {
  const received = request.headers.get("authorization")?.replace(/^Bearer\s+/, "");
  const allowed = [process.env.CRON_SECRET, process.env.INTERNAL_JOB_SECRET].filter(
    (value): value is string => Boolean(value),
  );
  const valid =
    received &&
    allowed.some((expected) => {
      const left = Buffer.from(received);
      const right = Buffer.from(expected);
      return left.length === right.length && timingSafeEqual(left, right);
    });
  if (!valid) throw new HttpError(401, "unauthorized", "Invalid internal job token");
}

function dateOffset(date: Date, days: number): string {
  return new Date(date.getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Stores the report days. Weeks are not written here: an unconfirmed week is
 * computed live from these days and the ads themselves (impact_week_totals),
 * and a confirmed week keeps the amount the operator froze.
 */
async function persistRevenue(
  rows: AdMobRevenueDay[],
  precision: "estimated" | "precise" | "publisher_provided",
  source: "admob_api" | "publisher_provided",
) {
  const client = createAdminClient();
  if (!client)
    throw new HttpError(503, "backend_not_configured", "Supabase is not configured");
  const importedAt = new Date().toISOString();
  const { error } = await client.from("revenue_daily").upsert(
    rows.map((row) => ({
      date: row.date,
      gross_revenue_minor: row.grossRevenueMinor,
      gross_revenue_micros: row.grossRevenueMicros,
      impressions: row.impressions,
      precision,
      source,
      imported_at: importedAt,
    })),
  );
  if (error) throw error;
  await ensureCurrentImpactWeek(client);
}

export async function GET(request: Request) {
  try {
    authorize(request);
    const yesterday = dateOffset(new Date(), -1);
    const startDate = dateOffset(new Date(`${yesterday}T00:00:00.000Z`), -13);
    const rows = await fetchAdMobRevenue(startDate, yesterday);
    await persistRevenue(rows, "estimated", "admob_api");
    return Response.json({
      imported: rows.length,
      startDate,
      endDate: yesterday,
      source: "admob_api",
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    authorize(request);
    const input = await parseJson(request, revenueImportSchema);
    await persistRevenue(
      [
        {
          date: input.date,
          grossRevenueMinor: input.grossRevenueMinor,
          grossRevenueMicros: input.grossRevenueMinor * 10_000,
          impressions: input.impressions,
        },
      ],
      input.precision,
      "publisher_provided",
    );
    return Response.json({ imported: 1, source: "publisher_provided" });
  } catch (error) {
    return routeError(error);
  }
}

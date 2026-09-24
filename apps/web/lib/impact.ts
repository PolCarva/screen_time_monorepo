import "server-only";

import {
  type ImpactWeek,
  impactFundMinorFromMicros,
  microsToMinor,
} from "@screen-time/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase";

export type ImpactWeekResult =
  | { state: "ready"; week: ImpactWeek }
  | { state: "unconfigured" }
  | { state: "empty" }
  | { state: "error"; message: string };

/** A row of `public.impact_week_totals` (docs/real-impact-stats-plan.md, D6-D8). */
export type WeekTotalsRow = {
  week_id: string;
  gross_revenue_micros: number | string;
  estimated_revenue_micros: number | string;
  reported_revenue_micros: number | string;
  ads_watched: number;
  contributors: number;
  people: number;
  minutes_returned: number | string;
  voters: number;
};

type StoredWeek = {
  id: string;
  gross_revenue_minor: number | string;
  impact_fund_minor: number | string;
  impact_percentage: number | string;
  revenue_is_estimated: boolean;
};

export type WeekTotals = Pick<
  ImpactWeek,
  | "grossRevenueMinor"
  | "impactFundMinor"
  | "estimatedRevenueMinor"
  | "reportedRevenueMinor"
  | "rewardedAds"
  | "participants"
  | "people"
  | "minutesReturned"
  | "voters"
>;

/**
 * The amounts a week shows. A confirmed week keeps what the operator froze; an
 * unconfirmed one is the live estimate, measured in micros so a week of a few
 * ads does not round to zero.
 */
export function weekTotals(week: StoredWeek, row: WeekTotalsRow | undefined): WeekTotals {
  const grossMicros = Number(row?.gross_revenue_micros ?? 0);
  const confirmed = !week.revenue_is_estimated;
  return {
    grossRevenueMinor: confirmed
      ? Number(week.gross_revenue_minor)
      : microsToMinor(grossMicros),
    impactFundMinor: confirmed
      ? Number(week.impact_fund_minor)
      : impactFundMinorFromMicros(grossMicros, Number(week.impact_percentage)),
    estimatedRevenueMinor: confirmed
      ? 0
      : microsToMinor(Number(row?.estimated_revenue_micros ?? 0)),
    reportedRevenueMinor: confirmed
      ? Number(week.gross_revenue_minor)
      : microsToMinor(Number(row?.reported_revenue_micros ?? 0)),
    rewardedAds: row?.ads_watched ?? 0,
    participants: row?.contributors ?? 0,
    people: row?.people ?? 0,
    minutesReturned: Math.round(Number(row?.minutes_returned ?? 0)),
    voters: row?.voters ?? 0,
  };
}

export async function loadWeekTotals(
  client: SupabaseClient,
  weeks: StoredWeek[],
): Promise<Map<string, WeekTotals>> {
  if (weeks.length === 0) return new Map();
  const { data, error } = await client.rpc("impact_week_totals", {
    p_week_ids: weeks.map((week) => week.id),
  });
  if (error) throw new Error("Unable to load impact totals");
  const rows = new Map(
    ((data ?? []) as WeekTotalsRow[]).map((row) => [row.week_id, row]),
  );
  return new Map(weeks.map((week) => [week.id, weekTotals(week, rows.get(week.id))]));
}

/**
 * Opens this week and closes the voting of weeks that ended, so "this week" is
 * never a week an operator forgot to open (D9). Failing here must not hide the
 * last published week, so errors are only logged.
 */
export async function ensureCurrentImpactWeek(client: SupabaseClient) {
  const { error } = await client.rpc("ensure_current_impact_week");
  if (error) console.error("Current impact week could not be ensured", error.message);
}

/** Today in the AdMob reporting calendar, the one impact weeks use. */
export function reportingToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

async function latestPublishedWeek(client: SupabaseClient) {
  return client
    .from("impact_weeks")
    .select("*")
    .neq("status", "draft")
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
}

export async function getCurrentImpactWeek(
  userId?: string,
): Promise<ImpactWeekResult> {
  const client = createAdminClient();
  if (!client) return { state: "unconfigured" };

  let { data: week, error } = await latestPublishedWeek(client);
  // Only when the latest week already ended: a read must not write each time.
  if (!error && (!week || week.week_end < reportingToday())) {
    await ensureCurrentImpactWeek(client);
    ({ data: week, error } = await latestPublishedWeek(client));
  }
  if (error)
    return {
      state: "error",
      message: "Unable to load the current impact week",
    };
  if (!week) return { state: "empty" };

  const [candidateResult, voteResult, donationResult, totalsResult, allTimeResult] =
    await Promise.all([
      client
        .from("impact_week_candidates")
        .select("display_order, charity:charities(*)")
        .eq("impact_week_id", week.id)
        .order("display_order"),
      client
        .from("votes")
        .select("charity_id, user_id")
        .eq("impact_week_id", week.id),
      client
        .from("donations")
        .select("proof_url")
        .eq("impact_week_id", week.id)
        .maybeSingle(),
      loadWeekTotals(client, [week]).then(
        (totals) => ({ totals, error: null }),
        (reason: unknown) => ({ totals: null, error: reason }),
      ),
      client.rpc("impact_all_time_totals").maybeSingle(),
    ]);

  const relatedError =
    candidateResult.error ??
    voteResult.error ??
    donationResult.error ??
    totalsResult.error ??
    allTimeResult.error;
  if (relatedError || !totalsResult.totals)
    return {
      state: "error",
      message: "Unable to load the current impact details",
    };

  const voteRows = voteResult.data ?? [];
  const totalVotes = voteRows.length;
  const candidates = (candidateResult.data ?? []).flatMap((row) => {
    const charity = Array.isArray(row.charity) ? row.charity[0] : row.charity;
    if (!charity) return [];
    const charityVotes = voteRows.filter(
      (vote) => vote.charity_id === charity.id,
    );
    return [
      {
        charity: {
          id: charity.id,
          name: charity.name,
          logoUrl: charity.logo_url,
          shortDescription: charity.short_description,
          website: charity.website,
          country: charity.country,
          category: charity.category,
        },
        votes: charityVotes.length,
        percentage:
          totalVotes === 0
            ? 0
            : Math.round((charityVotes.length / totalVotes) * 100),
        selectedByCurrentUser: Boolean(
          userId && charityVotes.some((vote) => vote.user_id === userId),
        ),
      },
    ];
  });

  const totals = totalsResult.totals.get(week.id)!;
  const allTime = allTimeResult.data as {
    people: number;
    minutes_returned: number | string;
    ads_watched: number;
    donated_minor: number | string;
  } | null;

  return {
    state: "ready",
    week: {
      id: week.id,
      weekStart: week.week_start,
      weekEnd: week.week_end,
      status: week.status,
      currency: week.currency,
      impactPercentage: Number(week.impact_percentage),
      isEstimated: week.revenue_is_estimated,
      candidates,
      donationProofUrl: donationResult.data?.proof_url ?? null,
      ...totals,
      allTime: {
        people: allTime?.people ?? 0,
        minutesReturned: Math.round(Number(allTime?.minutes_returned ?? 0)),
        rewardedAds: allTime?.ads_watched ?? 0,
        donatedMinor: Number(allTime?.donated_minor ?? 0),
      },
    },
  };
}

export type OperatorWeek = {
  id: string;
  weekStart: string;
  weekEnd: string;
  status: ImpactWeek["status"];
  impactPercentage: number;
  totals: WeekTotals;
  winner: { id: string; name: string } | null;
};

/**
 * Weeks that ended and still need the operator: revenue to confirm or a
 * donation to record. With weeks opening by themselves several can wait at
 * once, oldest first.
 */
export async function getWeeksAwaitingOperator(): Promise<OperatorWeek[]> {
  const client = createAdminClient();
  if (!client) return [];
  const { data: weeks, error } = await client
    .from("impact_weeks")
    .select(
      "id, week_start, week_end, status, impact_percentage, gross_revenue_minor, impact_fund_minor, revenue_is_estimated",
    )
    .in("status", ["voting_closed", "donation_pending"])
    .order("week_start", { ascending: true });
  if (error || !weeks) return [];
  const totals = await loadWeekTotals(client, weeks);
  return Promise.all(
    weeks.map(async (week) => {
      const [{ data: candidates }, { data: votes }] = await Promise.all([
        client
          .from("impact_week_candidates")
          .select("display_order, charity:charities(id, name)")
          .eq("impact_week_id", week.id)
          .order("display_order"),
        client.from("votes").select("charity_id").eq("impact_week_id", week.id),
      ]);
      // Same rule as admin_record_impact_donation: most votes, ties to the
      // lower display order.
      const ranked = (candidates ?? [])
        .map((row) => {
          const charity = Array.isArray(row.charity) ? row.charity[0] : row.charity;
          return charity
            ? {
                id: charity.id as string,
                name: charity.name as string,
                order: row.display_order as number,
                votes: (votes ?? []).filter((vote) => vote.charity_id === charity.id)
                  .length,
              }
            : null;
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
        .sort((a, b) => b.votes - a.votes || a.order - b.order);
      return {
        id: week.id,
        weekStart: week.week_start,
        weekEnd: week.week_end,
        status: week.status,
        impactPercentage: Number(week.impact_percentage),
        totals: totals.get(week.id)!,
        winner: ranked[0] ? { id: ranked[0].id, name: ranked[0].name } : null,
      };
    }),
  );
}

export type RecentAdView = {
  viewedAt: string;
  verified: boolean;
  platform: "ios" | "android" | null;
  estimatedValueMicros: number;
  estimateSource: "paid_event" | "observed_ecpm" | "default_ecpm" | "test_ad";
};

/** The latest ads and what each is estimated to have earned, for operators. */
export async function getRecentAdViews(limit = 20): Promise<RecentAdView[]> {
  const client = createAdminClient();
  if (!client) return [];
  const { data, error } = await client
    .from("ad_views")
    .select("viewed_at, verified_at, platform, estimated_value_micros, estimate_source")
    .order("viewed_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((row) => ({
    viewedAt: row.viewed_at,
    verified: Boolean(row.verified_at),
    platform: row.platform,
    estimatedValueMicros: Number(row.estimated_value_micros),
    estimateSource: row.estimate_source,
  }));
}

export type PublicImpact =
  | { state: "ready"; week: ImpactWeek }
  | { state: "unconfigured" }
  | { state: "empty" };

/**
 * The impact numbers for statically regenerated pages. A failed query throws
 * so the last good page keeps being served instead of caching an error state
 * (docs/landing-seo-plan.md, D7); a missing configuration (CI builds) or a
 * week without data is a normal state the page explains.
 */
export async function getPublicImpact(): Promise<PublicImpact> {
  const result = await getCurrentImpactWeek();
  if (result.state === "error") throw new Error(result.message);
  return result;
}

import "server-only";

import type { ImpactWeek } from "@screen-time/contracts";

import { createAdminClient } from "@/lib/supabase";

export type ImpactWeekResult =
  | { state: "ready"; week: ImpactWeek }
  | { state: "unconfigured" }
  | { state: "empty" }
  | { state: "error"; message: string };

function dayAfter(date: string): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString();
}

export async function getCurrentImpactWeek(
  userId?: string,
): Promise<ImpactWeekResult> {
  const client = createAdminClient();
  if (!client) return { state: "unconfigured" };

  const { data: week, error } = await client
    .from("impact_weeks")
    .select("*")
    .neq("status", "draft")
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error)
    return {
      state: "error",
      message: "Unable to load the current impact week",
    };
  if (!week) return { state: "empty" };

  const [candidateResult, voteResult, donationResult, rewardResult] =
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
      client
        .from("reward_intents")
        .select("id", { count: "exact", head: true })
        .eq("state", "verified")
        .gte("verified_at", `${week.week_start}T00:00:00.000Z`)
        .lt("verified_at", dayAfter(week.week_end)),
    ]);

  const relatedError =
    candidateResult.error ??
    voteResult.error ??
    donationResult.error ??
    rewardResult.error;
  if (relatedError)
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

  return {
    state: "ready",
    week: {
      id: week.id,
      weekStart: week.week_start,
      weekEnd: week.week_end,
      status: week.status,
      currency: week.currency,
      grossRevenueMinor: Number(week.gross_revenue_minor),
      impactFundMinor: Number(week.impact_fund_minor),
      impactPercentage: Number(week.impact_percentage),
      isEstimated: week.revenue_is_estimated,
      participants: new Set(voteRows.map((vote) => vote.user_id)).size,
      rewardedAds: rewardResult.count ?? 0,
      candidates,
      donationProofUrl: donationResult.data?.proof_url ?? null,
    },
  };
}

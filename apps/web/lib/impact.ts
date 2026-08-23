import "server-only";

import type { ImpactWeek } from "@screen-time/contracts";

import { demoImpactWeek } from "@/lib/demo-data";
import { createAdminClient } from "@/lib/supabase";

export async function getCurrentImpactWeek(userId?: string): Promise<ImpactWeek> {
  const client = createAdminClient();
  if (!client) return demoImpactWeek;

  const { data: week, error } = await client
    .from("impact_weeks")
    .select("*")
    .neq("status", "draft")
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !week) return demoImpactWeek;

  const { data: candidateRows } = await client
    .from("impact_week_candidates")
    .select("display_order, charity:charities(*)")
    .eq("impact_week_id", week.id)
    .order("display_order");
  const { data: votes } = await client.from("votes").select("charity_id, user_id").eq("impact_week_id", week.id);
  const { data: donation } = await client.from("donations").select("proof_url").eq("impact_week_id", week.id).maybeSingle();

  const voteRows = votes ?? [];
  const totalVotes = voteRows.length;
  const candidates = (candidateRows ?? []).map((row) => {
    const charity = Array.isArray(row.charity) ? row.charity[0] : row.charity;
    const charityVotes = voteRows.filter((vote) => vote.charity_id === charity.id);
    return {
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
      percentage: totalVotes === 0 ? 0 : Math.round((charityVotes.length / totalVotes) * 100),
      selectedByCurrentUser: Boolean(userId && charityVotes.some((vote) => vote.user_id === userId)),
    };
  });

  return {
    id: week.id,
    weekStart: week.week_start,
    weekEnd: week.week_end,
    status: week.status,
    currency: "USD",
    grossRevenueMinor: Number(week.gross_revenue_minor),
    impactFundMinor: Number(week.impact_fund_minor),
    impactPercentage: Number(week.impact_percentage),
    isEstimated: week.revenue_is_estimated,
    participants: new Set(voteRows.map((vote) => vote.user_id)).size,
    rewardedAds: 0,
    candidates,
    donationProofUrl: donation?.proof_url ?? null,
  };
}

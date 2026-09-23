import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase", () => ({ createAdminClient: () => null }));

import { reportingToday, weekTotals, type WeekTotalsRow } from "./impact";

const row: WeekTotalsRow = {
  week_id: "week",
  gross_revenue_micros: 24_000,
  estimated_revenue_micros: 4_000,
  reported_revenue_micros: 20_000,
  ads_watched: 3,
  contributors: 2,
  people: 5,
  minutes_returned: "36.0",
  voters: 1,
};

describe("weekly impact totals", () => {
  it("shows an open week's live estimate without rounding its ads away", () => {
    expect(
      weekTotals(
        {
          id: "week",
          gross_revenue_minor: 0,
          impact_fund_minor: 0,
          impact_percentage: "80.00",
          revenue_is_estimated: true,
        },
        row,
      ),
    ).toEqual({
      grossRevenueMinor: 2,
      impactFundMinor: 1,
      estimatedRevenueMinor: 0,
      reportedRevenueMinor: 2,
      rewardedAds: 3,
      participants: 2,
      people: 5,
      minutesReturned: 36,
      voters: 1,
    });
  });

  it("keeps the amount an operator confirmed", () => {
    expect(
      weekTotals(
        {
          id: "week",
          gross_revenue_minor: 12_345,
          impact_fund_minor: 9_876,
          impact_percentage: 80,
          revenue_is_estimated: false,
        },
        row,
      ),
    ).toMatchObject({
      grossRevenueMinor: 12_345,
      impactFundMinor: 9_876,
      estimatedRevenueMinor: 0,
      reportedRevenueMinor: 12_345,
      rewardedAds: 3,
    });
  });

  it("reads a week the database has no totals for as empty", () => {
    expect(
      weekTotals(
        {
          id: "week",
          gross_revenue_minor: 0,
          impact_fund_minor: 0,
          impact_percentage: 80,
          revenue_is_estimated: true,
        },
        undefined,
      ),
    ).toMatchObject({ grossRevenueMinor: 0, rewardedAds: 0, people: 0 });
  });
});

describe("the reporting calendar", () => {
  it("counts days in Los Angeles, like AdMob's reports", () => {
    // 06:00 UTC on a Monday is still Sunday in Los Angeles.
    expect(reportingToday(new Date("2026-09-21T06:00:00.000Z"))).toBe("2026-09-20");
    expect(reportingToday(new Date("2026-09-21T08:00:00.000Z"))).toBe("2026-09-21");
  });
});

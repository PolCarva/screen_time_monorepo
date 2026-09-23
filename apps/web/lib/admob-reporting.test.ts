import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { fetchAdMobRevenue, microsToMinorUnits } from "./admob-reporting";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("AdMob reporting", () => {
  it("keeps a fraction of a cent instead of rounding a day to zero", async () => {
    vi.stubEnv("ADMOB_PUBLISHER_ACCOUNT", "pub-1234567890");
    vi.stubEnv("ADMOB_CLIENT_ID", "client");
    vi.stubEnv("ADMOB_CLIENT_SECRET", "secret");
    vi.stubEnv("ADMOB_REFRESH_TOKEN", "refresh");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({ access_token: "access", expires_in: 3600, token_type: "Bearer" }),
        )
        .mockResolvedValueOnce(
          Response.json([
            {
              row: {
                dimensionValues: { DATE: { value: "20260922" } },
                metricValues: {
                  ESTIMATED_EARNINGS: { microsValue: "4200" },
                  IMPRESSIONS: { integerValue: "1" },
                },
              },
            },
          ]),
        ),
    );

    await expect(fetchAdMobRevenue("2026-09-22", "2026-09-22")).resolves.toEqual([
      { date: "2026-09-22", grossRevenueMinor: 0, grossRevenueMicros: 4_200, impressions: 1 },
    ]);
  });

  it("converts micros to currency minor units with rounding", () => {
    expect(microsToMinorUnits("6500000")).toBe(650);
    expect(microsToMinorUnits("12345")).toBe(1);
    expect(microsToMinorUnits("15000")).toBe(2);
  });

  it("refreshes OAuth and returns one truthful row per requested date", async () => {
    vi.stubEnv("ADMOB_PUBLISHER_ACCOUNT", "pub-1234567890");
    vi.stubEnv("ADMOB_CLIENT_ID", "client");
    vi.stubEnv("ADMOB_CLIENT_SECRET", "secret");
    vi.stubEnv("ADMOB_REFRESH_TOKEN", "refresh");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ access_token: "access", expires_in: 3600, token_type: "Bearer" }),
      )
      .mockResolvedValueOnce(
        Response.json([
          { header: { dateRange: {} } },
          {
            row: {
              dimensionValues: { DATE: { value: "20260828" } },
              metricValues: {
                ESTIMATED_EARNINGS: { microsValue: "6500000" },
                IMPRESSIONS: { integerValue: "42" },
              },
            },
          },
          { footer: { matchingRowCount: "1" } },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchAdMobRevenue("2026-08-28", "2026-08-29")).resolves.toEqual([
      {
        date: "2026-08-28",
        grossRevenueMinor: 650,
        grossRevenueMicros: 6_500_000,
        impressions: 42,
      },
      { date: "2026-08-29", grossRevenueMinor: 0, grossRevenueMicros: 0, impressions: 0 },
    ]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://admob.googleapis.com/v1/accounts/pub-1234567890/networkReport:generate",
      expect.objectContaining({ method: "POST" }),
    );
    // Report days must be the same calendar as the ads and weeks.
    const body = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(body.reportSpec.timeZone).toBe("America/Los_Angeles");
  });
});

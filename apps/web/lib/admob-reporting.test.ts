import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { fetchAdMobRevenue, microsToMinorUnits } from "./admob-reporting";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("AdMob reporting", () => {
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
      { date: "2026-08-28", grossRevenueMinor: 650, impressions: 42 },
      { date: "2026-08-29", grossRevenueMinor: 0, impressions: 0 },
    ]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://admob.googleapis.com/v1/accounts/pub-1234567890/networkReport:generate",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

import "server-only";

import { z } from "zod";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ADMOB_API_URL = "https://admob.googleapis.com/v1";

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive(),
  token_type: z.string().min(1),
});

const reportChunkSchema = z.object({
  row: z
    .object({
      dimensionValues: z
        .record(z.string(), z.object({ value: z.string().optional() }))
        .optional(),
      metricValues: z
        .record(
          z.string(),
          z.object({
            integerValue: z.string().optional(),
            microsValue: z.string().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

export type AdMobRevenueDay = {
  date: string;
  grossRevenueMinor: number;
  impressions: number;
};

type AdMobCredentials = {
  publisherAccount: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};

function requireCredentials(): AdMobCredentials {
  const publisherAccount = process.env.ADMOB_PUBLISHER_ACCOUNT;
  const clientId = process.env.ADMOB_CLIENT_ID;
  const clientSecret = process.env.ADMOB_CLIENT_SECRET;
  const refreshToken = process.env.ADMOB_REFRESH_TOKEN;
  if (!publisherAccount || !clientId || !clientSecret || !refreshToken) {
    throw new Error("AdMob reporting credentials are not configured");
  }
  return { publisherAccount, clientId, clientSecret, refreshToken };
}

function accountResource(value: string): string {
  const normalized = value.startsWith("accounts/") ? value : `accounts/${value}`;
  if (!/^accounts\/pub-\d+$/.test(normalized))
    throw new Error("ADMOB_PUBLISHER_ACCOUNT must use the pub-123 format");
  return normalized;
}

function dateParts(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`Invalid report date: ${date}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function compactDate(value: string): string {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid AdMob DATE dimension: ${value}`);
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function microsToMinorUnits(value: string): number {
  const micros = BigInt(value);
  if (micros < 0n) throw new Error("AdMob earnings cannot be negative");
  const minor = (micros + 5_000n) / 10_000n;
  const result = Number(minor);
  if (!Number.isSafeInteger(result)) throw new Error("AdMob earnings exceed safe integer range");
  return result;
}

function datesBetween(startDate: string, endDate: string): string[] {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end)
    throw new Error("Invalid AdMob report range");
  const result: string[] = [];
  for (let value = start; value <= end; value = new Date(value.getTime() + 86_400_000)) {
    result.push(value.toISOString().slice(0, 10));
    if (result.length > 31) throw new Error("AdMob report range cannot exceed 31 days");
  }
  return result;
}

async function accessToken(credentials: AdMobCredentials): Promise<string> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: credentials.refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`AdMob OAuth refresh failed (${response.status})`);
  return tokenResponseSchema.parse(await response.json()).access_token;
}

export async function fetchAdMobRevenue(
  startDate: string,
  endDate: string,
): Promise<AdMobRevenueDay[]> {
  const requestedDates = datesBetween(startDate, endDate);
  const credentials = requireCredentials();
  const token = await accessToken(credentials);
  const response = await fetch(
    `${ADMOB_API_URL}/${accountResource(credentials.publisherAccount)}/networkReport:generate`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        reportSpec: {
          dateRange: {
            startDate: dateParts(startDate),
            endDate: dateParts(endDate),
          },
          dimensions: ["DATE"],
          metrics: ["ESTIMATED_EARNINGS", "IMPRESSIONS"],
          localizationSettings: { currencyCode: "USD", languageCode: "en-US" },
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!response.ok) throw new Error(`AdMob report failed (${response.status})`);
  const chunks = z.array(reportChunkSchema).parse(await response.json());
  const byDate = new Map<string, AdMobRevenueDay>();
  for (const chunk of chunks) {
    const row = chunk.row;
    const rawDate = row?.dimensionValues?.DATE?.value;
    if (!row || !rawDate) continue;
    const date = compactDate(rawDate);
    const earnings = row.metricValues?.ESTIMATED_EARNINGS?.microsValue ?? "0";
    const impressions = Number(row.metricValues?.IMPRESSIONS?.integerValue ?? "0");
    if (!Number.isSafeInteger(impressions) || impressions < 0)
      throw new Error("AdMob returned invalid impressions");
    byDate.set(date, {
      date,
      grossRevenueMinor: microsToMinorUnits(earnings),
      impressions,
    });
  }

  return requestedDates.map(
    (date) => byDate.get(date) ?? { date, grossRevenueMinor: 0, impressions: 0 },
  );
}

import { describe, expect, it } from "vitest";

import {
  GUESS_STEPS_MINUTES,
  compareToGuess,
  formatDecimal,
  formatGuess,
  formatUsageMinutes,
  lifeTotals,
  nearestGuessStep,
  shareHeadline,
  usageInsights,
  type UsageDay,
  type UsageSummary,
} from "./onboarding-insights";

function day(
  date: string,
  minutes: number,
  unlocks: number,
  complete = true,
): UsageDay {
  return { date, foregroundSeconds: minutes * 60, unlocks, complete };
}

const week: UsageSummary = {
  days: [
    day("2026-09-17", 180, 80),
    day("2026-09-18", 0, 0), // phone off: not averaged
    day("2026-09-19", 200, 90),
    day("2026-09-20", 160, 70),
    day("2026-09-21", 190, 85),
    day("2026-09-22", 170, 75),
    day("2026-09-23", 198, 92),
    day("2026-09-24", 60, 30, false),
  ],
  apps: [
    {
      packageName: "com.instagram.android",
      label: "Instagram",
      seconds: [60, 0, 70, 50, 65, 55, 60, 20].map((minutes) => minutes * 60),
    },
    {
      packageName: "com.google.android.youtube",
      label: "YouTube",
      seconds: [30, 0, 40, 20, 35, 25, 30, 10].map((minutes) => minutes * 60),
    },
    {
      packageName: "com.whatsapp",
      label: "WhatsApp",
      seconds: [20, 0, 20, 20, 20, 20, 20, 5].map((minutes) => minutes * 60),
    },
    {
      packageName: "com.example.rare",
      label: "Rare",
      seconds: [0, 0, 0, 0, 0, 0, 1, 0].map((seconds) => seconds * 20),
    },
  ],
};

describe("usage insights (§3.3, §3.5)", () => {
  it("averages the complete days that had any use", () => {
    const insights = usageInsights(week)!;
    expect(insights.basis).toBe("days");
    expect(insights.measuredDays).toBe(6);
    // (180 + 200 + 160 + 190 + 170 + 198) / 6 = 183
    expect(insights.dailyMinutes).toBe(183);
    // (80 + 90 + 70 + 85 + 75 + 92) / 6 = 82
    expect(insights.unlocksPerDay).toBe(82);
  });

  it("ranks apps over the same days and drops those under a minute", () => {
    const insights = usageInsights(week)!;
    expect(insights.topApps.map((app) => app.label)).toEqual([
      "Instagram",
      "YouTube",
      "WhatsApp",
    ]);
    expect(insights.topApps[0]!.dailyMinutes).toBe(60);
    // (60 + 30 + 20) / 183
    expect(insights.topShare).toBeCloseTo(110 / 183, 5);
  });

  it("falls back to today so far when no complete day has use", () => {
    const insights = usageInsights({
      days: [day("2026-09-23", 0, 0), day("2026-09-24", 45, 12, false)],
      apps: [],
    })!;
    expect(insights).toMatchObject({
      basis: "today",
      measuredDays: 1,
      dailyMinutes: 45,
      unlocksPerDay: 12,
      topShare: 0,
    });
  });

  it("returns null when the phone has no use at all", () => {
    expect(
      usageInsights({ days: [day("2026-09-24", 0, 0, false)], apps: [] }),
    ).toBeNull();
    expect(usageInsights({ days: [], apps: [] })).toBeNull();
  });

  it("counts screen-ons on a phone without a lock screen", () => {
    const insights = usageInsights({
      days: [{ ...day("2026-09-23", 120, 0), screenOns: 40 }],
      apps: [],
    })!;
    expect(insights.unlocksPerDay).toBe(40);
  });

  it("reports no unlock count when the phone recorded neither", () => {
    const insights = usageInsights({
      days: [day("2026-09-23", 120, 0)],
      apps: [],
    })!;
    expect(insights.unlocksPerDay).toBeNull();
  });

  it("keeps at most five apps for the picker suggestions", () => {
    const apps = Array.from({ length: 8 }, (_, index) => ({
      packageName: `app.${index}`,
      label: `App ${index}`,
      seconds: [(index + 1) * 600],
    }));
    const insights = usageInsights({ days: [day("2026-09-23", 400, 10)], apps })!;
    expect(insights.topApps).toHaveLength(5);
    expect(insights.topApps[0]!.packageName).toBe("app.7");
  });
});

describe("guess comparison (§3.3)", () => {
  it("is close within 10 % of the guess", () => {
    expect(compareToGuess(190, 180)).toEqual({ kind: "close", percent: 0 });
    expect(compareToGuess(163, 180)).toEqual({ kind: "close", percent: 0 });
  });

  it("says how much more or less, as a share of the guess", () => {
    expect(compareToGuess(183, 120)).toEqual({ kind: "more", percent: 53 });
    expect(compareToGuess(140, 180)).toEqual({ kind: "less", percent: 22 });
  });

  it("never divides by zero", () => {
    expect(compareToGuess(60, 0).kind).toBe("more");
  });
});

describe("life totals (§3.4)", () => {
  it("adds the daily time up over 30 years and a year", () => {
    // 3 h 3 min a day: 3.05 × 30 / 24 = 3.8 years; × 365 / 24 = 46 days.
    expect(lifeTotals(183)).toEqual({ years: 3.8, daysPerYear: 46 });
  });

  it("is zero for no use", () => {
    expect(lifeTotals(0)).toEqual({ years: 0, daysPerYear: 0 });
  });
});

describe("share headline (§3.5)", () => {
  it("names the share of the three most used apps", () => {
    expect(shareHeadline(0.62)).toBe("moreThanHalf");
    expect(shareHeadline(0.45)).toBe("almostHalf");
    expect(shareHeadline(0.33)).toBe("aThird");
    expect(shareHeadline(0.26)).toBe("aQuarter");
    expect(shareHeadline(0.1)).toBe("top");
  });
});

describe("formats", () => {
  it("writes durations the way the voice guide does", () => {
    expect(formatUsageMinutes(183, "es")).toBe("3 h 3 min");
    expect(formatUsageMinutes(183, "en")).toBe("3 hr 3 min");
    expect(formatUsageMinutes(180, "es")).toBe("3 h");
    expect(formatUsageMinutes(45, "en")).toBe("45 min");
  });

  it("names the last guess stop as open-ended", () => {
    expect(formatGuess(720, "es")).toBe("12 h o más");
    expect(formatGuess(720, "en")).toBe("12 hr or more");
    expect(formatGuess(210, "es")).toBe("3 h 30 min");
  });

  it("uses the locale's decimal mark and drops a trailing zero", () => {
    expect(formatDecimal(3.8, "es")).toBe("3,8");
    expect(formatDecimal(3.8, "en")).toBe("3.8");
    expect(formatDecimal(4, "es")).toBe("4");
    expect(formatDecimal(12.46, "es")).toBe("12,5");
  });

  it("snaps a guess to the slider's 30-minute stops", () => {
    expect(GUESS_STEPS_MINUTES[0]).toBe(30);
    expect(GUESS_STEPS_MINUTES.at(-1)).toBe(720);
    expect(nearestGuessStep(200)).toBe(210);
    expect(nearestGuessStep(5)).toBe(30);
    expect(nearestGuessStep(1_000)).toBe(720);
  });
});

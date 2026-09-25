import { describe, expect, it } from "vitest";

import {
  baselineFromStats,
  baselineIsUsable,
  compareBeforeNow,
  measuredMinutesByApp,
  parseBaseline,
  recentFromStats,
  recentIsFresh,
  returnedToday,
  shiftLocalDate,
  typicalMinutes,
  type RecentUsage,
  type UsageBaseline,
  type UsageStatsInput,
} from "./saved-time";

const now = new Date(2026, 8, 25, 18, 0);

function stats(
  days: { date: string; complete?: boolean }[],
  apps: UsageStatsInput["apps"],
): UsageStatsInput {
  return {
    days: days.map((day) => ({ date: day.date, complete: day.complete ?? true })),
    apps,
  };
}

function baseline(apps: UsageBaseline["apps"], days = 7): UsageBaseline {
  return {
    version: 1,
    capturedAt: now.toISOString(),
    days: Array.from({ length: days }, (_, index) => shiftLocalDate("2026-09-18", index)),
    apps,
  };
}

function recent(apps: RecentUsage["apps"], days: string[]): RecentUsage {
  return { version: 1, computedAt: now.toISOString(), days, apps };
}

describe("shiftLocalDate", () => {
  it("moves across months and years", () => {
    expect(shiftLocalDate("2026-09-25", -7)).toBe("2026-09-18");
    expect(shiftLocalDate("2026-10-01", -1)).toBe("2026-09-30");
    expect(shiftLocalDate("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("baselineFromStats", () => {
  const days = Array.from({ length: 7 }, (_, index) => ({
    date: shiftLocalDate("2026-09-18", index),
  }));

  it("keeps per-app sessions, median and the daily average over days with use", () => {
    const result = baselineFromStats(
      stats(days, [
        {
          packageName: "com.instagram.android",
          sessions: 40,
          medianSeconds: 420,
          seconds: [3600, 3600, 0, 3600, 3600, 3600, 3600],
        },
        {
          packageName: "com.whatsapp",
          sessions: 90,
          medianSeconds: 40,
          seconds: [600, 600, 0, 600, 600, 600, 600],
        },
      ]),
      "2026-09-25",
      now,
    );
    // The day without a second of use is one the phone no longer keeps.
    expect(result.days).toHaveLength(6);
    expect(result.apps["com.instagram.android"]).toEqual({
      sessions: 40,
      medianSeconds: 420,
      dailySeconds: 3600,
    });
    expect(baselineIsUsable(result)).toBe(true);
  });

  it("leaves out the onboarding day and later", () => {
    const result = baselineFromStats(
      stats([...days, { date: "2026-09-25", complete: false }], [
        {
          packageName: "a",
          sessions: 5,
          medianSeconds: 60,
          seconds: [60, 60, 60, 60, 60, 60, 60, 9_000],
        },
      ]),
      "2026-09-24",
      now,
    );
    expect(result.days.at(-1)).toBe("2026-09-23");
    expect(result.apps.a.dailySeconds).toBe(60);
  });

  it("is not usable with fewer than three days", () => {
    const result = baselineFromStats(
      stats(days, [
        { packageName: "a", sessions: 9, medianSeconds: 60, seconds: [0, 0, 0, 0, 0, 60, 60] },
      ]),
      "2026-09-25",
      now,
    );
    expect(result.days).toHaveLength(2);
    expect(baselineIsUsable(result)).toBe(false);
    expect(parseBaseline(JSON.parse(JSON.stringify(result)))).toEqual(result);
  });
});

describe("typicalMinutes", () => {
  const sources = {
    baseline: baseline({ a: { sessions: 12, medianSeconds: 420, dailySeconds: 3_000 } }),
    recent: recent(
      {
        a: { sessions: 30, medianSeconds: 180, seconds: [] },
        b: { sessions: 8, medianSeconds: 90, seconds: [] },
        c: { sessions: 4, medianSeconds: 600, seconds: [] },
      },
      [],
    ),
    configMinutes: 2,
  };

  it("prefers the week before Still, then the last days, then the config", () => {
    expect(typicalMinutes("a", sources)).toEqual({ minutes: 7, source: "before" });
    expect(typicalMinutes("b", sources)).toEqual({ minutes: 1.5, source: "recent" });
    // Four sessions say nothing yet.
    expect(typicalMinutes("c", sources)).toEqual({ minutes: 2, source: "default" });
    expect(typicalMinutes("z", sources)).toEqual({ minutes: 2, source: "default" });
  });

  it("caps one skipped pause at 30 minutes", () => {
    expect(
      typicalMinutes("a", {
        ...sources,
        baseline: baseline({ a: { sessions: 6, medianSeconds: 2 * 3_600, dailySeconds: 1 } }),
      }),
    ).toEqual({ minutes: 30, source: "before" });
  });

  it("ignores a baseline with too few days", () => {
    expect(
      typicalMinutes("a", {
        ...sources,
        baseline: baseline({ a: { sessions: 12, medianSeconds: 420, dailySeconds: 1 } }, 2),
      }),
    ).toEqual({ minutes: 3, source: "recent" });
  });

  it("hands the pause screen only measured apps", () => {
    expect(measuredMinutesByApp(["a", "b", "c"], sources)).toEqual({ a: 7, b: 1.5 });
  });
});

describe("returnedToday", () => {
  const minutesFor = (packageName: string) =>
    packageName === "insta"
      ? { minutes: 7, source: "before" as const }
      : { minutes: 2, source: "default" as const };

  it("counts each app's skipped pauses at its typical session", () => {
    const result = returnedToday({
      apps: [
        { packageName: "insta", label: "Instagram", openAttempts: 5, unlocks: 1, reentries: 1 },
        { packageName: "tiktok", label: "TikTok", openAttempts: 2, unlocks: 2, reentries: 0 },
      ],
      totals: { notEntered: 4, reentries: 1 },
      minutesFor,
      configMinutes: 2,
    });
    // 5 pauses − 1 entry − 1 re-entry = 3 × 7 min (the plan's example).
    expect(result.apps[0]).toMatchObject({ skipped: 3, minutesEach: 7, minutes: 21 });
    expect(result.apps[1]).toMatchObject({ skipped: 0, minutes: 0 });
    expect(result.minutes).toBe(21);
    expect(result.rest).toBe(0);
  });

  it("never counts more than the day's own skips, cutting the shortest sessions first", () => {
    const result = returnedToday({
      apps: [
        { packageName: "insta", label: "Instagram", openAttempts: 4, unlocks: 0, reentries: 0 },
        { packageName: "tiktok", label: "TikTok", openAttempts: 4, unlocks: 0, reentries: 0 },
      ],
      // The day's totals were read before the last pauses.
      totals: { notEntered: 5, reentries: 0 },
      minutesFor,
      configMinutes: 2,
    });
    expect(result.apps.map((app) => app.skipped)).toEqual([1, 4]);
    expect(result.minutes).toBe(7 + 4 * 2);
    expect(
      returnedToday({
        apps: [{ packageName: "insta", label: "Instagram", openAttempts: 4, unlocks: 0, reentries: 0 }],
        totals: { notEntered: 0, reentries: 0 },
        minutesFor,
        configMinutes: 2,
      }).minutes,
    ).toBe(0);
  });

  it("counts pauses of apps no longer chosen at the config's minutes", () => {
    const result = returnedToday({
      apps: [{ packageName: "insta", label: "Instagram", openAttempts: 2, unlocks: 0, reentries: 0 }],
      totals: { notEntered: 5, reentries: 0 },
      minutesFor,
      configMinutes: 2,
    });
    expect(result.rest).toBe(3);
    expect(result.minutes).toBe(2 * 7 + 3 * 2);
  });
});

describe("recentFromStats and recentIsFresh", () => {
  it("keeps complete days only and is read again after six hours or a new day", () => {
    const result = recentFromStats(
      stats(
        [{ date: "2026-09-24" }, { date: "2026-09-25", complete: false }],
        [{ packageName: "a", sessions: 6, medianSeconds: 120, seconds: [600, 300] }],
      ),
      now,
    );
    expect(result.days).toEqual(["2026-09-24"]);
    expect(result.apps.a.seconds).toEqual([600]);
    const day = () => "2026-09-25";
    expect(recentIsFresh(result, new Date(now.getTime() + 60_000), "2026-09-25", day)).toBe(true);
    expect(
      recentIsFresh(result, new Date(now.getTime() + 7 * 3_600_000), "2026-09-25", day),
    ).toBe(false);
    expect(recentIsFresh(result, now, "2026-09-26", day)).toBe(false);
    expect(recentIsFresh(null, now, "2026-09-25", day)).toBe(false);
  });
});

describe("compareBeforeNow", () => {
  const before = baseline({
    insta: { sessions: 30, medianSeconds: 400, dailySeconds: 3_600 },
    tiktok: { sessions: 30, medianSeconds: 400, dailySeconds: 1_800 },
  });
  const days = ["2026-09-18", "2026-09-19", "2026-09-20", "2026-09-21", "2026-09-22"];

  it("compares the chosen apps a day, before Still and on the days after", () => {
    const result = compareBeforeNow({
      baseline: before,
      recent: recent(
        {
          insta: { sessions: 9, medianSeconds: 200, seconds: [9_000, 9_000, 2_400, 2_400, 2_400] },
          tiktok: { sessions: 9, medianSeconds: 200, seconds: [0, 0, 600, 600, 600] },
        },
        days,
      ),
      chosen: ["insta", "tiktok", "never-used"],
      onboardedDay: "2026-09-19",
    });
    expect(result).toEqual({
      before: 5_400,
      now: 3_000,
      beforeDays: 7,
      nowDays: 3,
      apps: [
        { packageName: "insta", before: 3_600, now: 2_400 },
        { packageName: "tiktok", before: 1_800, now: 600 },
      ],
    });
  });

  it("says nothing before three days after the onboarding day", () => {
    expect(
      compareBeforeNow({
        baseline: before,
        recent: recent({}, days),
        chosen: ["insta"],
        onboardedDay: "2026-09-20",
      }),
    ).toBeNull();
    expect(
      compareBeforeNow({ baseline: null, recent: recent({}, days), chosen: ["insta"], onboardedDay: "2026-09-10" }),
    ).toBeNull();
  });
});

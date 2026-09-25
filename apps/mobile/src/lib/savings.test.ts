import { describe, expect, it } from "vitest";

import { returnedToday } from "./saved-time";
import { type SavingsHistory, summarizeSavings } from "./savings";

const now = new Date(2026, 8, 25, 15, 0);
const day = (date: string, openAttempts: number, unlocks: number, reentries = 0) => ({
  date,
  openAttempts,
  avoidedOpens: openAttempts - unlocks,
  unlocks,
  reentries,
});

// Instagram: a 10-minute session; Calendar: nothing measured, the config's 2.
const minutesFor = (key: string) =>
  key === "com.instagram.android"
    ? { minutes: 10, source: "recent" as const }
    : { minutes: 2, source: "default" as const };

const history: SavingsHistory = {
  days: [
    day("2026-09-20", 3, 1),
    day("2026-09-24", 4, 1),
    day("2026-09-25", 5, 1, 1),
  ],
  apps: [
    {
      key: "com.instagram.android",
      label: "Instagram",
      chosen: true,
      days: [day("2026-09-20", 3, 1), day("2026-09-24", 3, 1), day("2026-09-25", 4, 1, 1)],
    },
    {
      key: "com.android.calendar",
      label: "Calendario",
      chosen: false,
      days: [day("2026-09-24", 1, 0), day("2026-09-25", 1, 0)],
    },
  ],
};

const summarize = (period: "today" | "week" | "month" | "all", app: string | null = null) =>
  summarizeSavings({ history, period, app, now, minutesFor, configMinutes: 2 });

describe("savings per app and in total", () => {
  it("gives today the same number as Today's screen", () => {
    const today = summarize("today");
    const expected = returnedToday({
      apps: [
        { packageName: "com.instagram.android", label: "Instagram", openAttempts: 4, unlocks: 1, reentries: 1 },
        { packageName: "com.android.calendar", label: "Calendario", openAttempts: 1, unlocks: 0, reentries: 0 },
      ],
      totals: { notEntered: 4, reentries: 1 },
      minutesFor,
      configMinutes: 2,
    });
    expect(Math.round(today.minutes)).toBe(expected.minutes);
    // Instagram: 3 not entered − 1 re-entry = 2 × 10; Calendar: 1 × 2.
    expect(today.minutes).toBe(22);
    expect(today.skipped).toBe(3);
    expect(today.days).toEqual([{ date: "2026-09-25", minutes: 22 }]);
  });

  it("adds a week up day by day and lists the apps by minutes back", () => {
    const week = summarize("week");
    // 20/9: 2 × 10; 24/9: 2 × 10 + 1 × 2; 25/9: 22.
    expect(week.minutes).toBe(20 + 22 + 22);
    expect(week.pauses).toBe(12);
    expect(week.entered).toBe(3);
    expect(week.skipped).toBe(2 + 3 + 3);
    expect(week.days).toHaveLength(7);
    expect(week.days.map((entry) => entry.minutes)).toEqual([0, 20, 0, 0, 0, 22, 22]);
    expect(week.apps.map((app) => [app.label, app.minutes, app.skipped, app.reentries])).toEqual([
      ["Instagram", 60, 6, 1],
      ["Calendario", 4, 2, 0],
    ]);
    // The rows add up to the total.
    expect(week.apps.reduce((sum, app) => sum + app.minutes, 0)).toBe(week.minutes);
  });

  it("filters to one app, with its own days", () => {
    const calendar = summarize("week", "com.android.calendar");
    expect(calendar.minutes).toBe(4);
    expect(calendar.pauses).toBe(2);
    expect(calendar.entered).toBe(0);
    expect(calendar.days.map((entry) => entry.minutes)).toEqual([0, 0, 0, 0, 0, 2, 2]);
    // The list stays whole so the filter can switch to another app.
    expect(calendar.apps).toHaveLength(2);
    expect(calendar.apps[1]).toMatchObject({ chosen: false, minutesEach: 2, source: "default" });
  });

  it("counts pauses of apps it has no row for at the config's minutes", () => {
    const loose: SavingsHistory = { days: [day("2026-09-25", 3, 0)], apps: [] };
    const today = summarizeSavings({
      history: loose,
      period: "today",
      app: null,
      now,
      minutesFor,
      configMinutes: 2,
    });
    expect(today.minutes).toBe(6);
    expect(today.apps).toEqual([]);
  });

  it("never gives the apps more than the day's own total", () => {
    const racing: SavingsHistory = {
      days: [day("2026-09-25", 1, 0)],
      apps: [
        {
          key: "com.instagram.android",
          label: "Instagram",
          chosen: true,
          days: [day("2026-09-25", 3, 0)],
        },
      ],
    };
    const today = summarizeSavings({
      history: racing,
      period: "today",
      app: null,
      now,
      minutesFor,
      configMinutes: 2,
    });
    expect(today.minutes).toBe(10);
    expect(today.apps[0].skipped).toBe(1);
  });

  it("is empty, not missing, with no history", () => {
    const empty = summarizeSavings({
      history: { days: [], apps: [] },
      period: "month",
      app: null,
      now,
      minutesFor,
      configMinutes: 2,
    });
    expect(empty.minutes).toBe(0);
    expect(empty.days).toHaveLength(30);
    expect(empty.apps).toEqual([]);
  });
});

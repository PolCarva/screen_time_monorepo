import { describe, expect, it } from "vitest";

import {
  dayOutcome,
  lastLocalDates,
  localDateString,
  effectiveNotEntered,
  minutesReturned,
  pauseStatus,
  summarizeWeek,
  weekdayLabel,
  type DayMetrics,
} from "./today-summary";

function day(date: string, openAttempts: number, unlocks: number, avoidedOpens = 0): DayMetrics {
  return { date, openAttempts, unlocks, avoidedOpens };
}

describe("day outcome (D5)", () => {
  it("splits pauses into entered and not entered", () => {
    expect(dayOutcome({ openAttempts: 7, unlocks: 3 })).toEqual({
      pauses: 7,
      entered: 3,
      notEntered: 4,
    });
  });

  it("never reports more entries than pauses", () => {
    expect(dayOutcome({ openAttempts: 1, unlocks: 2 })).toEqual({
      pauses: 2,
      entered: 2,
      notEntered: 0,
    });
    expect(dayOutcome({ openAttempts: -3, unlocks: -1 })).toEqual({
      pauses: 0,
      entered: 0,
      notEntered: 0,
    });
  });

  it("estimates minutes from the pauses that did not end in the app", () => {
    expect(minutesReturned({ notEntered: 4 }, 2)).toBe(8);
    expect(minutesReturned({ notEntered: 3 }, 2.5)).toBe(8);
    expect(minutesReturned({ notEntered: 0 }, 2)).toBe(0);
    // A skip undone by going in right after gives no time back (real-savings D6).
    expect(minutesReturned({ notEntered: 4 }, 2, 1)).toBe(6);
    expect(minutesReturned({ notEntered: 1 }, 2, 3)).toBe(0);
    expect(effectiveNotEntered({ notEntered: 5 }, 2)).toBe(3);
    expect(effectiveNotEntered({ notEntered: 5 })).toBe(5);
  });
});

describe("local dates", () => {
  it("formats the phone's calendar day, not UTC", () => {
    // 22:30 local on the 22nd is already the 23rd in UTC for UTC-3.
    const lateEvening = new Date(2026, 8, 22, 22, 30);
    expect(localDateString(lateEvening)).toBe("2026-09-22");
  });

  it("lists the last seven days oldest first, across a month boundary", () => {
    expect(lastLocalDates(new Date(2026, 9, 3, 9, 0), 7)).toEqual([
      "2026-09-27",
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
    ]);
  });
});

describe("week summary", () => {
  const now = new Date(2026, 8, 22, 20, 0);

  it("fills missing days with zeros and marks today last", () => {
    const week = summarizeWeek([day("2026-09-20", 4, 1), day("2026-09-22", 3, 1)], { now });
    expect(week.columns.map((column) => column.date)).toEqual([
      "2026-09-16",
      "2026-09-17",
      "2026-09-18",
      "2026-09-19",
      "2026-09-20",
      "2026-09-21",
      "2026-09-22",
    ]);
    expect(week.columns.map((column) => column.pauses)).toEqual([0, 0, 0, 0, 4, 0, 3]);
    expect(week.columns.at(-1)?.isToday).toBe(true);
    expect(week.columns.filter((column) => column.isToday)).toHaveLength(1);
  });

  it("totals the week and says how often you did not go in", () => {
    const week = summarizeWeek(
      [day("2026-09-18", 5, 2), day("2026-09-20", 6, 1), day("2026-09-22", 3, 1)],
      { now },
    );
    expect(week.totals).toEqual({ pauses: 14, entered: 4, notEntered: 10 });
    expect(week.notEnteredPercent).toBe(71);
  });

  it("scales bars to the busiest day", () => {
    const week = summarizeWeek([day("2026-09-21", 8, 0), day("2026-09-22", 2, 0)], { now });
    expect(week.columns.at(-2)?.height).toBe(1);
    expect(week.columns.at(-1)?.height).toBe(0.25);
  });

  it("has no percentage for a week without pauses", () => {
    const week = summarizeWeek([], { now });
    expect(week.totals.pauses).toBe(0);
    expect(week.notEnteredPercent).toBeNull();
    expect(week.columns.every((column) => column.height === 0)).toBe(true);
  });

  it("ignores history outside the seven days", () => {
    const week = summarizeWeek([day("2026-09-01", 50, 0)], { now });
    expect(week.totals.pauses).toBe(0);
  });
});

describe("weekday label", () => {
  const labels = {
    today: "Hoy",
    format: (date: Date) => ["dom.", "lun.", "mar.", "mié.", "jue.", "vie.", "sáb."][date.getDay()]!,
  };

  it("names today and trims the abbreviation dot", () => {
    expect(weekdayLabel("2026-09-22", true, labels)).toBe("Hoy");
    expect(weekdayLabel("2026-09-16", false, labels)).toBe("mié");
    expect(weekdayLabel("2026-09-20", false, labels)).toBe("dom");
  });
});

describe("pause status", () => {
  it("follows the remote switch first", () => {
    expect(pauseStatus({ platform: "ios", pausesEnabled: false, chosen: 3, connected: 3 })).toEqual({
      kind: "paused",
    });
  });

  it("asks iOS users to choose, then to connect, then says it is on", () => {
    expect(pauseStatus({ platform: "ios", pausesEnabled: true, chosen: 0, connected: 0 }).kind).toBe(
      "choose",
    );
    expect(pauseStatus({ platform: "ios", pausesEnabled: true, chosen: 3, connected: 1 })).toEqual({
      kind: "connect",
      connected: 1,
      chosen: 3,
    });
    expect(pauseStatus({ platform: "ios", pausesEnabled: true, chosen: 3, connected: 3 })).toEqual({
      kind: "active",
      apps: 3,
    });
  });

  it("asks Android users for the permission, then for apps", () => {
    expect(
      pauseStatus({ platform: "android", pausesEnabled: true, authorized: false, selected: 2 }).kind,
    ).toBe("activate");
    expect(
      pauseStatus({ platform: "android", pausesEnabled: true, authorized: true, selected: 0 }).kind,
    ).toBe("choose");
    expect(
      pauseStatus({ platform: "android", pausesEnabled: true, authorized: true, selected: 2 }),
    ).toEqual({ kind: "active", apps: 2 });
  });
});

describe("pause status when Accessibility is on but not running", () => {
  it("asks to turn Still on again", () => {
    expect(
      pauseStatus({
        platform: "android",
        pausesEnabled: true,
        authorized: true,
        running: false,
        selected: 2,
      }),
    ).toEqual({ kind: "activate" });
    // Older native builds don't report it: trust the switch.
    expect(
      pauseStatus({ platform: "android", pausesEnabled: true, authorized: true, selected: 2 }),
    ).toEqual({ kind: "active", apps: 2 });
  });
});

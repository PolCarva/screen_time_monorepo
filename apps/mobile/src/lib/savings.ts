import {
  type AppDayCounts,
  type SavedTimeSource,
  returnedToday,
} from "./saved-time";
import {
  type DayMetrics,
  dayOutcome,
  effectiveNotEntered,
  lastLocalDates,
} from "./today-summary";

/**
 * The time back per app and in total, over a period (the Savings screen).
 * Each day is worked out exactly like Today's number (`returnedToday`): the
 * same sessions per app, the same re-entries, the same cap at the day's own
 * "didn't go in". So "Today" here and Today's number are one figure, and a
 * week is the sum of its days. Pure, so savings.test.ts pins it down.
 */

export type SavingsPeriod = "today" | "week" | "month" | "all";

export const SAVINGS_PERIODS: readonly SavingsPeriod[] = ["today", "week", "month", "all"];

/** Days each filter covers, ending today. "All" is what the phone keeps, up to a year. */
export const SAVINGS_PERIOD_DAYS: Record<SavingsPeriod, number> = {
  today: 1,
  week: 7,
  month: 30,
  all: 365,
};

/** One app's counters on the days it has any, as the phone reports them. */
export type AppHistory = {
  /** Android: the package name. iOS: the app's name as chosen in Still. */
  key: string;
  label: string;
  /** Still pauses it right now; apps chosen before keep their history. */
  chosen: boolean;
  days: DayMetrics[];
};

/** Still's own counters per day and per app, oldest day first. */
export type SavingsHistory = {
  days: DayMetrics[];
  apps: AppHistory[];
};

export type AppSavings = {
  key: string;
  label: string;
  chosen: boolean;
  /** Minutes back in the period, unrounded so the rows add up to the total. */
  minutes: number;
  /** Pauses that gave time back: didn't go in, minus the re-entries. */
  skipped: number;
  pauses: number;
  entered: number;
  /** Skips undone by going into the app right after: they give nothing back. */
  reentries: number;
  /** What one skipped pause of this app is worth, and where that comes from. */
  minutesEach: number;
  source: SavedTimeSource;
};

export type SavingsSummary = {
  minutes: number;
  skipped: number;
  pauses: number;
  entered: number;
  /** Every app with a pause in the period, most minutes back first. */
  apps: AppSavings[];
  /** One entry per day of the period, oldest first. */
  days: { date: string; minutes: number }[];
};

type Accumulated = Omit<AppSavings, "minutesEach" | "source">;

function sumDays(days: readonly DayMetrics[]): DayMetrics | null {
  if (days.length === 0) return null;
  return days.reduce<DayMetrics>(
    (sum, day) => ({
      date: sum.date,
      openAttempts: sum.openAttempts + day.openAttempts,
      avoidedOpens: sum.avoidedOpens + day.avoidedOpens,
      unlocks: sum.unlocks + day.unlocks,
      reentries: (sum.reentries ?? 0) + (day.reentries ?? 0),
    }),
    { date: days[0].date, openAttempts: 0, avoidedOpens: 0, unlocks: 0, reentries: 0 },
  );
}

/**
 * The period's time back, for every app or only `app` (an `AppHistory.key`).
 * Days are the phone's local days ending on `now`'s.
 */
export function summarizeSavings(input: {
  history: SavingsHistory;
  period: SavingsPeriod;
  app: string | null;
  now: Date;
  minutesFor: (key: string) => { minutes: number; source: SavedTimeSource };
  configMinutes: number;
}): SavingsSummary {
  const dates = lastLocalDates(input.now, SAVINGS_PERIOD_DAYS[input.period]);
  const totalsByDate = new Map(input.history.days.map((day) => [day.date, day]));
  const appDays = input.history.apps.map((app) => ({
    app,
    byDate: new Map(app.days.map((day) => [day.date, day])),
  }));
  const configMinutes = Math.max(0, input.configMinutes);

  const perApp = new Map<string, Accumulated>();
  const days: SavingsSummary["days"] = [];
  let pauses = 0;
  let entered = 0;
  let skipped = 0;

  for (const date of dates) {
    const today = appDays.flatMap(({ app, byDate }) => {
      const day = byDate.get(date);
      return day ? [{ app, day }] : [];
    });
    // Older builds may lack a day's totals; the apps' own counters stand in.
    const totals = totalsByDate.get(date) ?? sumDays(today.map(({ day }) => day));
    if (!totals) {
      days.push({ date, minutes: 0 });
      continue;
    }
    const outcome = dayOutcome(totals);
    const counts: AppDayCounts[] = today.map(({ app, day }) => ({
      packageName: app.key,
      label: app.label,
      openAttempts: day.openAttempts,
      unlocks: day.unlocks,
      reentries: day.reentries ?? 0,
    }));
    const returned = returnedToday({
      apps: counts,
      totals: { notEntered: outcome.notEntered, reentries: totals.reentries ?? 0 },
      minutesFor: input.minutesFor,
      configMinutes,
    });

    let dayMinutes = returned.rest * configMinutes;
    for (const entry of returned.apps) {
      dayMinutes += entry.minutes;
      const app = today.find(({ app: candidate }) => candidate.key === entry.packageName)!.app;
      const appOutcome = dayOutcome(entry);
      const sum = perApp.get(app.key) ?? {
        key: app.key,
        label: app.label,
        chosen: app.chosen,
        minutes: 0,
        skipped: 0,
        pauses: 0,
        entered: 0,
        reentries: 0,
      };
      sum.minutes += entry.minutes;
      sum.skipped += entry.skipped;
      sum.pauses += appOutcome.pauses;
      sum.entered += appOutcome.entered;
      sum.reentries += Math.min(Math.max(0, entry.reentries), appOutcome.notEntered);
      perApp.set(app.key, sum);
      if (input.app === app.key) days.push({ date, minutes: entry.minutes });
    }
    if (input.app === null) {
      days.push({ date, minutes: dayMinutes });
      pauses += outcome.pauses;
      entered += outcome.entered;
      skipped += effectiveNotEntered(outcome, totals.reentries ?? 0);
    } else if (!days.some((day) => day.date === date)) {
      days.push({ date, minutes: 0 });
    }
  }

  const apps = [...perApp.values()]
    .filter((app) => app.pauses > 0)
    .map((app) => {
      const typical = input.minutesFor(app.key);
      return { ...app, minutesEach: typical.minutes, source: typical.source };
    })
    .sort(
      (a, b) =>
        b.minutes - a.minutes ||
        b.pauses - a.pauses ||
        a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
    );

  if (input.app !== null) {
    const app = apps.find((candidate) => candidate.key === input.app);
    return {
      minutes: app?.minutes ?? 0,
      skipped: app?.skipped ?? 0,
      pauses: app?.pauses ?? 0,
      entered: app?.entered ?? 0,
      apps,
      days,
    };
  }
  return {
    minutes: days.reduce((sum, day) => sum + day.minutes, 0),
    skipped,
    pauses,
    entered,
    apps,
    days,
  };
}

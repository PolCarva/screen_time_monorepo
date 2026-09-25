/**
 * Today's numbers and the week, computed the same way on iOS and Android from
 * Still's own counters (docs/ui-clarity-plan.md, D5). Pure, so both platforms
 * and the tests share one definition:
 * - pauses: open attempts Still paused (never fewer than the entries);
 * - entered: unlocks, whatever paid for them (the ad or the free wait);
 * - notEntered: pauses that did not end in the app ("Go back", or leaving the
 *   pause without choosing);
 * - minutes returned (estimated): notEntered, minus the skips undone by going
 *   into the same app right after (docs/real-savings-estimate-plan.md, D6),
 *   × minutes per avoided open.
 */

export type DayMetrics = {
  /** `yyyy-MM-dd` in the phone's own calendar. */
  date: string;
  openAttempts: number;
  avoidedOpens: number;
  unlocks: number;
  /** Skips undone by going into the same app right after; absent on older builds. */
  reentries?: number;
};

export type DayOutcome = {
  pauses: number;
  entered: number;
  notEntered: number;
};

export function dayOutcome(
  metrics: Pick<DayMetrics, "openAttempts" | "unlocks">,
): DayOutcome {
  const entered = Math.max(0, Math.round(metrics.unlocks));
  const pauses = Math.max(entered, Math.round(metrics.openAttempts));
  return { pauses, entered, notEntered: pauses - entered };
}

/** Pauses that give time back: not entered, minus the skips undone right after. */
export function effectiveNotEntered(
  outcome: Pick<DayOutcome, "notEntered">,
  reentries = 0,
): number {
  return Math.max(0, outcome.notEntered - Math.max(0, Math.round(reentries)));
}

export function minutesReturned(
  outcome: Pick<DayOutcome, "notEntered">,
  minutesPerNotEntered: number,
  reentries = 0,
): number {
  return Math.max(
    0,
    Math.round(effectiveNotEntered(outcome, reentries) * minutesPerNotEntered),
  );
}

/** `yyyy-MM-dd` of a moment in the phone's time zone, like the native keys. */
export function localDateString(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The last `days` local dates, oldest first, ending on `now`'s day. */
export function lastLocalDates(now: Date, days: number): string[] {
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(now);
    day.setHours(12, 0, 0, 0);
    day.setDate(day.getDate() - (days - 1 - index));
    return localDateString(day);
  });
}

export type WeekColumn = DayOutcome & {
  date: string;
  isToday: boolean;
  /** This day's pauses relative to the busiest day (0–1), for the bar. */
  height: number;
};

export type WeekSummary = {
  columns: WeekColumn[];
  totals: DayOutcome;
  /** Share of the week's pauses that did not end in the app; null without pauses. */
  notEnteredPercent: number | null;
};

/**
 * Seven columns ending today. Days the native history does not have (a fresh
 * install, a day with no pause) are zero, never skipped, so the labels always
 * line up with real dates.
 */
export function summarizeWeek(
  history: readonly DayMetrics[],
  options: { now: Date; days?: number },
): WeekSummary {
  const dates = lastLocalDates(options.now, options.days ?? 7);
  const today = dates[dates.length - 1];
  const byDate = new Map(history.map((day) => [day.date, day]));
  const outcomes = dates.map((date) => ({
    date,
    ...dayOutcome(byDate.get(date) ?? { openAttempts: 0, unlocks: 0 }),
  }));
  const busiest = Math.max(1, ...outcomes.map((day) => day.pauses));
  const totals = outcomes.reduce<DayOutcome>(
    (sum, day) => ({
      pauses: sum.pauses + day.pauses,
      entered: sum.entered + day.entered,
      notEntered: sum.notEntered + day.notEntered,
    }),
    { pauses: 0, entered: 0, notEntered: 0 },
  );
  return {
    columns: outcomes.map((day) => ({
      ...day,
      isToday: day.date === today,
      height: day.pauses / busiest,
    })),
    totals,
    notEnteredPercent:
      totals.pauses > 0
        ? Math.round((totals.notEntered / totals.pauses) * 100)
        : null,
  };
}

/**
 * The weekday under a column: "mié", "Wed", or "Hoy"/"Today" for today.
 * `format` is injected so tests do not depend on the host's ICU data.
 */
export function weekdayLabel(
  date: string,
  isToday: boolean,
  labels: { today: string; format(date: Date): string },
): string {
  if (isToday) return labels.today;
  return labels.format(new Date(`${date}T12:00:00`)).replace(/\.$/, "");
}

export type PauseStatus =
  | { kind: "paused" }
  | { kind: "choose" }
  | { kind: "activate" }
  | { kind: "connect"; connected: number; chosen: number }
  | { kind: "active"; apps: number };

/**
 * What the "Your apps" row on Today says, from the same facts Settings uses.
 * iOS counts an app as connected once its automation fired; Android needs the
 * Accessibility permission and at least one app.
 */
export function pauseStatus(
  input:
    | { platform: "ios"; pausesEnabled: boolean; chosen: number; connected: number }
    | {
        platform: "android";
        pausesEnabled: boolean;
        authorized: boolean;
        /** The service is bound; undefined from builds that don't report it. */
        running?: boolean;
        selected: number;
      },
): PauseStatus {
  if (!input.pausesEnabled) return { kind: "paused" };
  if (input.platform === "ios") {
    if (input.chosen === 0) return { kind: "choose" };
    if (input.connected < input.chosen)
      return { kind: "connect", connected: input.connected, chosen: input.chosen };
    return { kind: "active", apps: input.chosen };
  }
  if (!input.authorized || input.running === false) return { kind: "activate" };
  if (input.selected === 0) return { kind: "choose" };
  return { kind: "active", apps: input.selected };
}

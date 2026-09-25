import { z } from "zod";

import { effectiveNotEntered } from "./today-summary";

/**
 * The time each skipped pause gives back, from the phone's own usage
 * (docs/real-savings-estimate-plan.md §2). Pure, so the rules are pinned by
 * saved-time.test.ts; only per-app totals are kept, on the phone (D8).
 *
 * - A skipped pause is worth one session of that app: its median, capped.
 * - Source order per app (D5): before Still → last seven days → the config.
 * - A skip undone by going in right after gives nothing back (D6).
 */

/** Fewer sessions than this say nothing about an app (D4). */
export const MIN_SESSIONS = 5;
/** One skipped pause never counts for more than this (D4). */
export const MAX_MINUTES_PER_OPEN = 30;
/** Days before Still the baseline keeps, and the fewest it needs (D7). */
export const BASELINE_DAYS = 7;
export const BASELINE_MIN_DAYS = 3;
/** Complete days after the onboarding day "Before and now" needs (D10). */
export const COMPARE_MIN_DAYS = 3;
/** Recent usage is read again after this long, or on another day (D11). */
export const RECENT_MAX_AGE_MS = 6 * 60 * 60 * 1_000;

export type SavedTimeSource = "before" | "recent" | "default";

const appStatsShape = {
  sessions: z.number().int().min(0),
  medianSeconds: z.number().min(0),
};

export const usageBaselineSchema = z.object({
  version: z.literal(1),
  capturedAt: z.string(),
  /** Local days with use before the onboarding day, oldest first. */
  days: z.array(z.string()),
  apps: z.record(
    z.string(),
    z.object({ ...appStatsShape, dailySeconds: z.number().min(0) }),
  ),
});
export type UsageBaseline = z.infer<typeof usageBaselineSchema>;

export const recentUsageSchema = z.object({
  version: z.literal(1),
  computedAt: z.string(),
  /** Complete local days with use in the window, oldest first. */
  days: z.array(z.string()),
  apps: z.record(
    z.string(),
    z.object({ ...appStatsShape, seconds: z.array(z.number().min(0)) }),
  ),
});
export type RecentUsage = z.infer<typeof recentUsageSchema>;

export function parseBaseline(raw: unknown): UsageBaseline | null {
  const parsed = usageBaselineSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function parseRecent(raw: unknown): RecentUsage | null {
  const parsed = recentUsageSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** What the native reader returns (NativeUsageStats), structurally. */
export type UsageStatsInput = {
  days: { date: string; complete: boolean }[];
  apps: {
    packageName: string;
    sessions: number;
    medianSeconds: number;
    seconds: number[];
  }[];
};

/** `yyyy-MM-dd` moved by whole days, in the phone's calendar. */
export function shiftLocalDate(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const moved = new Date(year, month - 1, day + days, 12);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${moved.getFullYear()}-${pad(moved.getMonth() + 1)}-${pad(moved.getDate())}`;
}

/**
 * Complete days with any use. A day without a second of use is one the phone
 * no longer keeps (or it was off), so it never pulls an average down.
 */
function usedCompleteDays(stats: UsageStatsInput): number[] {
  return stats.days
    .map((day, index) => ({ day, index }))
    .filter(
      ({ day, index }) =>
        day.complete && stats.apps.some((app) => (app.seconds[index] ?? 0) > 0),
    )
    .map(({ index }) => index);
}

/** The week before the onboarding day (D7): kept once, never read again. */
export function baselineFromStats(
  stats: UsageStatsInput,
  onboardedDay: string,
  now: Date,
): UsageBaseline {
  const indexes = usedCompleteDays(stats)
    .filter((index) => stats.days[index].date < onboardedDay)
    .slice(-BASELINE_DAYS);
  const apps: UsageBaseline["apps"] = {};
  for (const app of stats.apps) {
    const total = indexes.reduce((sum, index) => sum + (app.seconds[index] ?? 0), 0);
    if (total <= 0 && app.sessions <= 0) continue;
    apps[app.packageName] = {
      sessions: Math.max(0, Math.round(app.sessions)),
      medianSeconds: Math.max(0, app.medianSeconds),
      dailySeconds: indexes.length ? total / indexes.length : 0,
    };
  }
  return {
    version: 1,
    capturedAt: now.toISOString(),
    days: indexes.map((index) => stats.days[index].date),
    apps,
  };
}

export function baselineIsUsable(baseline: UsageBaseline | null): baseline is UsageBaseline {
  return Boolean(baseline && baseline.days.length >= BASELINE_MIN_DAYS);
}

/** The last seven complete days and today, as read now (D5 source 2). */
export function recentFromStats(stats: UsageStatsInput, now: Date): RecentUsage {
  const indexes = usedCompleteDays(stats);
  const apps: RecentUsage["apps"] = {};
  for (const app of stats.apps) {
    const seconds = indexes.map((index) => app.seconds[index] ?? 0);
    if (app.sessions <= 0 && !seconds.some((value) => value > 0)) continue;
    apps[app.packageName] = {
      sessions: Math.max(0, Math.round(app.sessions)),
      medianSeconds: Math.max(0, app.medianSeconds),
      seconds,
    };
  }
  return {
    version: 1,
    computedAt: now.toISOString(),
    days: indexes.map((index) => stats.days[index].date),
    apps,
  };
}

/** Read within the last six hours, on the same local day (D11). */
export function recentIsFresh(
  recent: RecentUsage | null,
  now: Date,
  today: string,
  computedDay: (iso: string) => string,
): boolean {
  if (!recent) return false;
  const computedAt = Date.parse(recent.computedAt);
  if (!Number.isFinite(computedAt)) return false;
  return (
    now.getTime() - computedAt < RECENT_MAX_AGE_MS &&
    computedDay(recent.computedAt) === today
  );
}

function capped(minutes: number): number {
  return Math.min(MAX_MINUTES_PER_OPEN, Math.max(0, minutes));
}

/** One skipped pause of `packageName`, in minutes, and where that came from. */
export function typicalMinutes(
  packageName: string,
  sources: {
    baseline: UsageBaseline | null;
    recent: RecentUsage | null;
    configMinutes: number;
  },
): { minutes: number; source: SavedTimeSource } {
  const before = baselineIsUsable(sources.baseline)
    ? sources.baseline.apps[packageName]
    : undefined;
  if (before && before.sessions >= MIN_SESSIONS) {
    return { minutes: capped(before.medianSeconds / 60), source: "before" };
  }
  const recent = sources.recent?.apps[packageName];
  if (recent && recent.sessions >= MIN_SESSIONS) {
    return { minutes: capped(recent.medianSeconds / 60), source: "recent" };
  }
  return { minutes: Math.max(0, sources.configMinutes), source: "default" };
}

/** Minutes per skipped pause for the pause screen: only apps measured on the phone. */
export function measuredMinutesByApp(
  packageNames: string[],
  sources: Parameters<typeof typicalMinutes>[1],
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const packageName of packageNames) {
    const typical = typicalMinutes(packageName, sources);
    if (typical.source !== "default") {
      result[packageName] = Math.round(typical.minutes * 10) / 10;
    }
  }
  return result;
}

export type AppDayCounts = {
  packageName: string;
  label: string;
  openAttempts: number;
  unlocks: number;
  reentries: number;
};

export type ReturnedApp = AppDayCounts & {
  /** Pauses that give time back (not entered, minus re-entries). */
  skipped: number;
  minutesEach: number;
  source: SavedTimeSource;
  minutes: number;
};

/**
 * Today's time back (§2.4): each chosen app's skipped pauses × its typical
 * session, plus the config's minutes for pauses of apps no longer chosen.
 */
export function returnedToday(input: {
  apps: AppDayCounts[];
  totals: { notEntered: number; reentries: number };
  minutesFor: (packageName: string) => { minutes: number; source: SavedTimeSource };
  configMinutes: number;
}): { minutes: number; apps: ReturnedApp[]; rest: number } {
  const apps = input.apps.map((app) => {
    const entered = Math.max(0, Math.round(app.unlocks));
    const pauses = Math.max(entered, Math.round(app.openAttempts));
    const skipped = effectiveNotEntered({ notEntered: pauses - entered }, app.reentries);
    const typical = input.minutesFor(app.packageName);
    return {
      ...app,
      skipped,
      minutesEach: typical.minutes,
      source: typical.source,
      minutes: skipped * typical.minutes,
    };
  });
  const counted = apps.reduce((sum, app) => sum + app.skipped, 0);
  const rest = Math.max(
    0,
    effectiveNotEntered({ notEntered: input.totals.notEntered }, input.totals.reentries) - counted,
  );
  const minutes = apps.reduce((sum, app) => sum + app.minutes, 0) +
    rest * Math.max(0, input.configMinutes);
  return { minutes: Math.max(0, Math.round(minutes)), apps, rest };
}

export type BeforeNow = {
  /** Seconds a day of the chosen apps, before Still and now. */
  before: number;
  now: number;
  beforeDays: number;
  nowDays: number;
  /** Up to three apps, most used before Still first. */
  apps: { packageName: string; before: number; now: number }[];
};

/** "Before and now" (§2.5, D10), or null until it can be told honestly. */
export function compareBeforeNow(input: {
  baseline: UsageBaseline | null;
  recent: RecentUsage | null;
  chosen: string[];
  onboardedDay: string;
}): BeforeNow | null {
  const { baseline, recent } = input;
  if (!baselineIsUsable(baseline) || !recent || input.chosen.length === 0) return null;
  const nowIndexes = recent.days
    .map((day, index) => ({ day, index }))
    .filter(({ day }) => day > input.onboardedDay)
    .slice(-7)
    .map(({ index }) => index);
  if (nowIndexes.length < COMPARE_MIN_DAYS) return null;
  const apps = input.chosen.map((packageName) => {
    const seconds = recent.apps[packageName]?.seconds ?? [];
    const total = nowIndexes.reduce((sum, index) => sum + (seconds[index] ?? 0), 0);
    return {
      packageName,
      before: baseline.apps[packageName]?.dailySeconds ?? 0,
      now: total / nowIndexes.length,
    };
  });
  return {
    before: apps.reduce((sum, app) => sum + app.before, 0),
    now: apps.reduce((sum, app) => sum + app.now, 0),
    beforeDays: baseline.days.length,
    nowDays: nowIndexes.length,
    apps: apps
      .filter((app) => app.before > 0 || app.now > 0)
      .sort((a, b) => b.before - a.before || b.now - a.now)
      .slice(0, 3),
  };
}

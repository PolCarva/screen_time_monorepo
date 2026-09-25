/**
 * The numbers the onboarding story tells (docs/onboarding-v2-plan.md §3): the
 * user's guess, their real daily use, how it compares, what it adds up to and
 * which apps take most of it. Pure, so every figure the story shows has one
 * definition the tests pin down. Nothing here leaves the phone (D4).
 */

export type Locale = "en" | "es";

/** One local day as the native usage reader returns it, oldest first. */
export type UsageDay = {
  /** `yyyy-MM-dd` in the phone's calendar. */
  date: string;
  foregroundSeconds: number;
  unlocks: number;
  /** False for today, which is still running. */
  complete: boolean;
};

/** An app's foreground seconds for each entry of `UsageSummary.days`. */
export type UsageApp = {
  packageName: string;
  label: string;
  seconds: number[];
};

export type UsageSummary = { days: UsageDay[]; apps: UsageApp[] };

export type TopApp = {
  packageName: string;
  label: string;
  dailyMinutes: number;
};

export type UsageInsights = {
  dailyMinutes: number;
  /** Unlocks a day; null when the phone recorded none (no lock screen). */
  unlocksPerDay: number | null;
  /** "days" = average of complete days; "today" = today so far. */
  basis: "days" | "today";
  measuredDays: number;
  /** The five most used apps, most used first (the picker suggests them). */
  topApps: TopApp[];
  /** Share of the daily time the three most used apps take (0–1). */
  topShare: number;
};

/** The guess slider: every 30 minutes from 30 min to "12 h or more". */
export const GUESS_STEPS_MINUTES = Array.from(
  { length: 24 },
  (_, index) => (index + 1) * 30,
);
export const MAX_GUESS_MINUTES = 720;
export const DEFAULT_GUESS_MINUTES = 180;
/** How many years ahead the story adds the daily time up to. */
export const LIFE_HORIZON_YEARS = 30;

export function nearestGuessStep(minutes: number): number {
  let best = GUESS_STEPS_MINUTES[0]!;
  for (const step of GUESS_STEPS_MINUTES) {
    if (Math.abs(step - minutes) < Math.abs(best - minutes)) best = step;
  }
  return best;
}

/**
 * Averages the complete days that had any use, so a day the phone was off
 * does not pull the average down. A phone with no complete day yet falls back
 * to today so far. No use at all returns null: the story goes on with the guess.
 */
export function usageInsights(summary: UsageSummary): UsageInsights | null {
  const completeDays = summary.days
    .map((day, index) => ({ day, index }))
    .filter(({ day }) => day.complete && day.foregroundSeconds > 0);
  let basis: UsageInsights["basis"] = "days";
  let picked = completeDays;
  if (picked.length === 0) {
    picked = summary.days
      .map((day, index) => ({ day, index }))
      .filter(({ day }) => !day.complete && day.foregroundSeconds > 0);
    basis = "today";
  }
  if (picked.length === 0) return null;

  const count = picked.length;
  const totalSeconds = picked.reduce(
    (sum, { day }) => sum + Math.max(0, day.foregroundSeconds),
    0,
  );
  const dailyMinutes = Math.round(totalSeconds / count / 60);
  if (dailyMinutes <= 0) return null;
  const totalUnlocks = picked.reduce(
    (sum, { day }) => sum + Math.max(0, day.unlocks),
    0,
  );
  const topApps = summary.apps
    .map((app) => ({
      packageName: app.packageName,
      label: app.label,
      dailyMinutes: Math.round(
        picked.reduce(
          (sum, { index }) => sum + Math.max(0, app.seconds[index] ?? 0),
          0,
        ) /
          count /
          60,
      ),
    }))
    .filter((app) => app.dailyMinutes >= 1)
    .sort((a, b) => b.dailyMinutes - a.dailyMinutes)
    .slice(0, 5);
  const topThree = topApps
    .slice(0, 3)
    .reduce((sum, app) => sum + app.dailyMinutes, 0);
  return {
    dailyMinutes,
    unlocksPerDay: totalUnlocks > 0 ? Math.round(totalUnlocks / count) : null,
    basis,
    measuredDays: count,
    topApps,
    topShare: Math.min(1, topThree / dailyMinutes),
  };
}

export type GuessComparison = {
  kind: "close" | "more" | "less";
  /** Whole percent of the guess; 0 when close. */
  percent: number;
};

/** Within 10 % of the guess reads as "very close". */
export function compareToGuess(
  realMinutes: number,
  guessMinutes: number,
): GuessComparison {
  const guess = Math.max(1, guessMinutes);
  const ratio = (realMinutes - guess) / guess;
  if (Math.abs(ratio) < 0.1) return { kind: "close", percent: 0 };
  return {
    kind: ratio > 0 ? "more" : "less",
    percent: Math.round(Math.abs(ratio) * 100),
  };
}

export type LifeTotals = {
  /** Years of the horizon spent on the phone, one decimal. */
  years: number;
  /** Whole days a year. */
  daysPerYear: number;
};

export function lifeTotals(
  dailyMinutes: number,
  horizonYears = LIFE_HORIZON_YEARS,
): LifeTotals {
  const hours = Math.max(0, dailyMinutes) / 60;
  return {
    years: Math.round(((hours * horizonYears) / 24) * 10) / 10,
    daysPerYear: Math.round((hours * 365) / 24),
  };
}

/** Which headline 3.5 uses for the share of the three most used apps. */
export type ShareHeadline =
  | "moreThanHalf"
  | "almostHalf"
  | "aThird"
  | "aQuarter"
  | "top";

export function shareHeadline(share: number): ShareHeadline {
  if (share >= 0.5) return "moreThanHalf";
  if (share >= 0.4) return "almostHalf";
  if (share >= 0.3) return "aThird";
  if (share >= 0.25) return "aQuarter";
  return "top";
}

/** "3 h 3 min" in Spanish, "3 hr 3 min" in English (voice guide). */
export function formatUsageMinutes(minutes: number, locale: Locale): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  const hourUnit = locale === "es" ? "h" : "hr";
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} ${hourUnit}` : `${hours} ${hourUnit} ${rest} min`;
}

/** The guess as the slider shows it; the last stop is "12 h or more". */
export function formatGuess(minutes: number, locale: Locale): string {
  if (minutes >= MAX_GUESS_MINUTES) {
    return locale === "es" ? "12 h o más" : "12 hr or more";
  }
  return formatUsageMinutes(minutes, locale);
}

/**
 * One decimal at most, with the locale's decimal mark ("3,8" / "3.8").
 * Formatted by hand so every engine prints the same thing.
 */
export function formatDecimal(value: number, locale: Locale): string {
  const fixed = (Math.round(value * 10) / 10).toFixed(1).replace(/\.0$/, "");
  return locale === "es" ? fixed.replace(".", ",") : fixed;
}

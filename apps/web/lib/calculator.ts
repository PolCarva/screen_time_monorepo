/**
 * The screen-time calculator (docs/landing-seo-plan.md, F4). Pure and local:
 * nothing the person types leaves the browser.
 */
export type ProjectionInput = {
  hoursPerDay: number;
  age: number;
  /** Reference age the projection runs to; shown to the person as an assumption. */
  horizonAge?: number;
  minutesSavedPerDay?: number;
};

export type Projection = {
  /** Whole days per year spent on the phone. */
  daysPerYear: number;
  /** Years on the phone from now to the reference age. */
  yearsUntilHorizon: number;
  /** Days per year a smaller daily habit gives back. */
  daysSavedPerYear: number;
  /** Years it gives back from now to the reference age. */
  yearsSavedUntilHorizon: number;
  yearsLeft: number;
};

export const LIMITS = {
  hoursPerDay: { min: 0.5, max: 16, step: 0.5 },
  age: { min: 13, max: 79 },
  minutesSavedPerDay: { min: 5, max: 240, step: 5 },
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

export function projectScreenTime(input: ProjectionInput): Projection {
  const horizon = input.horizonAge ?? 80;
  const hours = clamp(input.hoursPerDay, LIMITS.hoursPerDay.min, LIMITS.hoursPerDay.max);
  const age = clamp(input.age, LIMITS.age.min, LIMITS.age.max);
  const savedMinutes = clamp(
    input.minutesSavedPerDay ?? 30,
    LIMITS.minutesSavedPerDay.min,
    Math.min(LIMITS.minutesSavedPerDay.max, hours * 60),
  );
  const yearsLeft = Math.max(0, horizon - age);
  return {
    daysPerYear: (hours * 365) / 24,
    yearsUntilHorizon: (hours * yearsLeft) / 24,
    daysSavedPerYear: (savedMinutes / 60) * 365 / 24,
    yearsSavedUntilHorizon: ((savedMinutes / 60) * yearsLeft) / 24,
    yearsLeft,
  };
}

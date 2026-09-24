import { describe, expect, it } from "vitest";

import { projectScreenTime } from "./calculator";

describe("projectScreenTime", () => {
  it("turns daily hours into days a year and years until the reference age", () => {
    const result = projectScreenTime({ hoursPerDay: 6, age: 30 });
    expect(result.daysPerYear).toBeCloseTo(91.25);
    expect(result.yearsLeft).toBe(50);
    expect(result.yearsUntilHorizon).toBeCloseTo(12.5);
  });

  it("measures what 30 minutes less a day gives back by default", () => {
    const result = projectScreenTime({ hoursPerDay: 4, age: 20 });
    expect(result.daysSavedPerYear).toBeCloseTo(7.604, 2);
    expect(result.yearsSavedUntilHorizon).toBeCloseTo(1.25);
  });

  it("keeps inputs inside sensible bounds", () => {
    const tooMuch = projectScreenTime({ hoursPerDay: 30, age: 5, minutesSavedPerDay: 999 });
    expect(tooMuch.daysPerYear).toBeCloseTo((16 * 365) / 24);
    expect(tooMuch.yearsLeft).toBe(67);
    // Never saves more than the time actually spent.
    const little = projectScreenTime({ hoursPerDay: 0.5, age: 40, minutesSavedPerDay: 120 });
    expect(little.daysSavedPerYear).toBeCloseTo(little.daysPerYear);
    const broken = projectScreenTime({ hoursPerDay: Number.NaN, age: Number.NaN });
    expect(broken.daysPerYear).toBeCloseTo((0.5 * 365) / 24);
  });
});

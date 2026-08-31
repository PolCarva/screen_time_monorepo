import { describe, expect, it } from "vitest";

import { ApiError } from "./api-error";
import { isMissingImpactWeekError } from "./impact-errors";

describe("isMissingImpactWeekError", () => {
  it("matches the public API error used when no week is published", () => {
    expect(
      isMissingImpactWeekError(
        new ApiError(404, "impact_week_not_found", "No published week"),
      ),
    ).toBe(true);
  });

  it("does not hide availability failures behind the empty state", () => {
    expect(
      isMissingImpactWeekError(
        new ApiError(503, "impact_unavailable", "Temporarily unavailable"),
      ),
    ).toBe(false);
  });
});

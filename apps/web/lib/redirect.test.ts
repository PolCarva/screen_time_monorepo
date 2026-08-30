import { describe, expect, it } from "vitest";

import { safeLocalRedirect } from "./redirect";

describe("safeLocalRedirect", () => {
  it("keeps local paths and query strings", () => {
    expect(safeLocalRedirect("/admin?week=current")).toBe(
      "/admin?week=current",
    );
  });

  it.each([
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "\\evil.test",
    null,
  ])("rejects unsafe redirect %s", (value) =>
    expect(safeLocalRedirect(value)).toBe("/admin"),
  );
});

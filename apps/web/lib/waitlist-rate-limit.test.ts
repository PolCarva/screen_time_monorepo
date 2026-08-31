import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createWaitlistRateLimitKey,
  getClientAddress,
} from "./waitlist-rate-limit";

describe("waitlist rate limiting", () => {
  it("uses Vercel's anti-spoofed client address", () => {
    const request = new Request("https://still.example", {
      headers: { "x-forwarded-for": "203.0.113.8, 10.0.0.1" },
    });

    expect(getClientAddress(request)).toBe("203.0.113.8");
  });

  it("creates a stable non-reversible database key", () => {
    const request = new Request("https://still.example", {
      headers: { "x-forwarded-for": "203.0.113.8" },
    });

    const key = createWaitlistRateLimitKey(request, "test-secret");
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(key).not.toContain("203.0.113.8");
    expect(createWaitlistRateLimitKey(request, "test-secret")).toBe(key);
  });

  it("fails closed when the server secret is unavailable", () => {
    const request = new Request("https://still.example");

    expect(() => createWaitlistRateLimitKey(request, "")).toThrow(
      "Waitlist is not configured",
    );
  });
});

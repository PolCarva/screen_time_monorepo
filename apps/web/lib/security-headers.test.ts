import { describe, expect, it } from "vitest";

import { createSecurityHeaders } from "./security-headers";

function asRecord(environment: string) {
  return Object.fromEntries(
    createSecurityHeaders(environment).map(({ key, value }) => [key, value]),
  );
}

describe("production security headers", () => {
  it("denies framing and constrains executable resources", () => {
    const headers = asRecord("production");

    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Content-Security-Policy"]).toContain(
      "frame-ancestors 'none'",
    );
    expect(headers["Content-Security-Policy"]).toContain("object-src 'none'");
    expect(headers["Content-Security-Policy"]).toContain(
      "upgrade-insecure-requests",
    );
    expect(headers["Content-Security-Policy"]).not.toContain("'unsafe-eval'");
  });

  it("allows only the extra transports required by the local dev server", () => {
    const headers = asRecord("development");

    expect(headers["Content-Security-Policy"]).toContain("http: ws:");
    expect(headers["Content-Security-Policy"]).toContain("'unsafe-eval'");
    expect(headers["Content-Security-Policy"]).not.toContain(
      "upgrade-insecure-requests",
    );
  });
});

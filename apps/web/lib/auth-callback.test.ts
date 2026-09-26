import { describe, expect, it } from "vitest";

import { authCallbackUrl } from "./auth-callback";

const production = "https://get-still.app";

describe("email sign-in callback", () => {
  it("returns to this computer when the link was asked for locally", () => {
    expect(authCallbackUrl("http://localhost:3000", production)).toBe(
      "http://localhost:3000/auth/callback",
    );
  });

  it("returns to production when asked for there", () => {
    expect(authCallbackUrl(production, production)).toBe(
      `${production}/auth/callback`,
    );
  });

  it("never returns to a site it does not know", () => {
    expect(authCallbackUrl("https://evil.example.com", production)).toBe(
      `${production}/auth/callback`,
    );
    expect(authCallbackUrl(null, `${production}/`)).toBe(
      `${production}/auth/callback`,
    );
  });

  it("carries no query string, which Supabase's allow-list would not match", () => {
    expect(authCallbackUrl("http://localhost:3000", production)).not.toContain("?");
  });
});

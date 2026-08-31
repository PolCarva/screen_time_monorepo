import type { User } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { hasGoogleIdentity } from "./google-identity";

function user(overrides: Partial<User>): User {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    aud: "authenticated",
    created_at: "2026-08-31T00:00:00.000Z",
    app_metadata: {},
    user_metadata: {},
    ...overrides,
  } as User;
}

describe("Google identity requirement", () => {
  it("accepts a linked Google identity", () => {
    expect(
      hasGoogleIdentity(
        user({
          identities: [
            {
              id: "google-user",
              user_id: "00000000-0000-4000-8000-000000000001",
              identity_id: "00000000-0000-4000-8000-000000000002",
              provider: "google",
              identity_data: {},
              created_at: "2026-08-31T00:00:00.000Z",
              updated_at: "2026-08-31T00:00:00.000Z",
            },
          ],
        }),
      ),
    ).toBe(true);
  });

  it("accepts Google in Supabase provider metadata", () => {
    expect(
      hasGoogleIdentity(
        user({ app_metadata: { provider: "email", providers: ["google"] } }),
      ),
    ).toBe(true);
  });

  it("rejects anonymous and non-Google accounts", () => {
    expect(
      hasGoogleIdentity(
        user({
          is_anonymous: true,
          app_metadata: { provider: "anonymous", providers: ["anonymous"] },
        }),
      ),
    ).toBe(false);
    expect(
      hasGoogleIdentity(
        user({ app_metadata: { provider: "apple", providers: ["apple"] } }),
      ),
    ).toBe(false);
  });
});

import type { User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: null as unknown,
  order: [] as string[],
  revoke: vi.fn(),
  deleteError: null as { message: string } | null,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({
  requireApiUser: async () => mocks.user,
}));
vi.mock("@/lib/apple-sign-in", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/apple-sign-in")>()),
  revokeAppleAuthorization: mocks.revoke,
}));
vi.mock("@/lib/supabase", () => ({
  createAdminClient: () => ({
    rpc: vi.fn(async (name: string) => {
      mocks.order.push(name);
      return { error: null };
    }),
    auth: {
      admin: {
        deleteUser: vi.fn(async () => {
          mocks.order.push("deleteUser");
          return { error: mocks.deleteError };
        }),
      },
    },
  }),
}));

import { POST } from "./route";

const anonymous = { id: "user-1", identities: [] } as unknown as User;
const withApple = {
  id: "user-1",
  identities: [
    { provider: "apple", id: "001234.apple", identity_data: { sub: "001234.apple" } },
  ],
} as unknown as User;

function request(body?: unknown) {
  return new Request("https://still.test/api/v1/privacy/delete", {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  mocks.order = [];
  mocks.deleteError = null;
  mocks.revoke.mockReset();
  mocks.revoke.mockImplementation(async () => {
    mocks.order.push("revoke");
    return "revoked";
  });
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("account deletion", () => {
  it("keeps deleting accounts for builds that send no body", async () => {
    mocks.user = anonymous;
    const response = await POST(request());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      appleRevocation: "no_apple_identity",
    });
    expect(mocks.order).toEqual([
      "pseudonymize_financial_ledger",
      "deleteUser",
    ]);
    expect(mocks.revoke).not.toHaveBeenCalled();
  });

  it("revokes Sign in with Apple before anything is deleted", async () => {
    mocks.user = withApple;
    const response = await POST(request({ appleAuthorizationCode: "code-1" }));
    await expect(response.json()).resolves.toEqual({ appleRevocation: "revoked" });
    expect(mocks.revoke).toHaveBeenCalledWith({ code: "code-1", user: withApple });
    expect(mocks.order).toEqual([
      "revoke",
      "pseudonymize_financial_ledger",
      "deleteUser",
    ]);
  });

  it("still deletes the account when the revocation fails or no code came", async () => {
    mocks.user = withApple;
    mocks.revoke.mockResolvedValueOnce("failed");
    const failed = await POST(request({ appleAuthorizationCode: "code-1" }));
    await expect(failed.json()).resolves.toEqual({ appleRevocation: "failed" });

    const noCode = await POST(request({}));
    await expect(noCode.json()).resolves.toEqual({ appleRevocation: "no_code" });
    expect(mocks.order.filter((step) => step === "deleteUser")).toHaveLength(2);
    expect(console.warn).toHaveBeenCalledTimes(2);
  });

  it("rejects a malformed body before touching the account", async () => {
    mocks.user = withApple;
    const response = await POST(request({ appleAuthorizationCode: "" }));
    expect(response.status).toBe(400);
    expect(mocks.order).toEqual([]);
  });
});

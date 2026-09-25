import { generateKeyPairSync, verify } from "node:crypto";

import type { User } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  appleClientSecret,
  appleSignInCredentials,
  appleSubject,
  revokeAppleAuthorization,
  type AppleSignInCredentials,
} from "./apple-sign-in";

const { privateKey, publicKey } = generateKeyPairSync("ec", {
  namedCurve: "P-256",
});

const credentials: AppleSignInCredentials = {
  teamId: "JZ9HBXGNK9",
  keyId: "KEY1234567",
  clientId: "app.still.ios",
  privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
};

const NOW = Date.UTC(2026, 8, 25, 12);

function decode(segment: string) {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
}

function idToken(sub: string) {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "RS256" })}.${encode({ sub, aud: "app.still.ios" })}.signature`;
}

function user(identities: Array<Partial<NonNullable<User["identities"]>[number]>>) {
  return { id: "user-1", identities } as unknown as User;
}

const appleUser = user([
  { provider: "anonymous", id: "user-1" },
  { provider: "apple", id: "001234.apple", identity_data: { sub: "001234.apple" } },
]);

function appleFetch({
  sub = "001234.apple",
  exchange = Response.json({
    access_token: "access",
    refresh_token: "refresh",
    id_token: idToken(sub),
  }),
  revoke = new Response(null, { status: 200 }),
}: { sub?: string; exchange?: Response; revoke?: Response } = {}) {
  return vi.fn(async (url: string | URL | Request) =>
    String(url).endsWith("/auth/token") ? exchange : revoke,
  ) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

function form(call: unknown[]) {
  return Object.fromEntries(
    new URLSearchParams((call[1] as RequestInit).body as URLSearchParams),
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Sign in with Apple revocation", () => {
  it("signs the ES256 client secret Apple expects", () => {
    const secret = appleClientSecret(credentials, NOW);
    const [header, payload, signature] = secret.split(".");
    expect(decode(header!)).toEqual({ alg: "ES256", kid: "KEY1234567" });
    expect(decode(payload!)).toEqual({
      iss: "JZ9HBXGNK9",
      iat: NOW / 1000,
      exp: NOW / 1000 + 300,
      aud: "https://appleid.apple.com",
      sub: "app.still.ios",
    });
    expect(
      verify(
        "sha256",
        Buffer.from(`${header}.${payload}`),
        { key: publicKey, dsaEncoding: "ieee-p1363" },
        Buffer.from(signature!, "base64url"),
      ),
    ).toBe(true);
  });

  it("reads the key from the environment, including a one-line PEM", () => {
    expect(appleSignInCredentials()).toBeNull();
    vi.stubEnv("APPLE_TEAM_ID", credentials.teamId);
    vi.stubEnv("APPLE_SIGN_IN_KEY_ID", credentials.keyId);
    vi.stubEnv("APPLE_SIGN_IN_CLIENT_ID", credentials.clientId);
    vi.stubEnv(
      "APPLE_SIGN_IN_PRIVATE_KEY",
      credentials.privateKey.replace(/\n/g, "\\n"),
    );
    expect(appleSignInCredentials()).toEqual(credentials);
  });

  it("finds the Apple ID the account is linked to", () => {
    expect(appleSubject(appleUser)).toBe("001234.apple");
    expect(
      appleSubject(user([{ provider: "apple", id: "009999.apple" }])),
    ).toBe("009999.apple");
    expect(appleSubject(user([{ provider: "google", id: "g-1" }]))).toBeNull();
  });

  it("exchanges the code and revokes the refresh token", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetcher = appleFetch();
    await expect(
      revokeAppleAuthorization({
        code: "code-1",
        user: appleUser,
        credentials,
        fetcher,
        now: NOW,
      }),
    ).resolves.toBe("revoked");

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0]![0]).toBe("https://appleid.apple.com/auth/token");
    expect(form(fetcher.mock.calls[0]!)).toMatchObject({
      client_id: "app.still.ios",
      code: "code-1",
      grant_type: "authorization_code",
    });
    expect(fetcher.mock.calls[1]![0]).toBe("https://appleid.apple.com/auth/revoke");
    expect(form(fetcher.mock.calls[1]!)).toMatchObject({
      client_id: "app.still.ios",
      token: "refresh",
      token_type_hint: "refresh_token",
    });
    expect(console.error).not.toHaveBeenCalled();
  });

  it("never revokes a code that belongs to another Apple ID", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetcher = appleFetch({ sub: "005555.someone-else" });
    await expect(
      revokeAppleAuthorization({ code: "code-1", user: appleUser, credentials, fetcher }),
    ).resolves.toBe("account_mismatch");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("reports a failed exchange or revocation without throwing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(
      revokeAppleAuthorization({
        code: "used-code",
        user: appleUser,
        credentials,
        fetcher: appleFetch({
          exchange: Response.json({ error: "invalid_grant" }, { status: 400 }),
        }),
      }),
    ).resolves.toBe("failed");
    expect(console.error).toHaveBeenCalledWith(
      "Apple authorization code exchange failed",
      { status: 400, error: "invalid_grant" },
    );

    await expect(
      revokeAppleAuthorization({
        code: "code-1",
        user: appleUser,
        credentials,
        fetcher: appleFetch({ revoke: new Response(null, { status: 500 }) }),
      }),
    ).resolves.toBe("failed");

    await expect(
      revokeAppleAuthorization({
        code: "code-1",
        user: appleUser,
        credentials,
        fetcher: vi.fn(async () => {
          throw new TypeError("fetch failed");
        }),
      }),
    ).resolves.toBe("failed");
  });

  it("skips accounts without Apple and servers without the key", async () => {
    const fetcher = appleFetch();
    await expect(
      revokeAppleAuthorization({
        code: "code-1",
        user: user([{ provider: "google", id: "g-1" }]),
        credentials,
        fetcher,
      }),
    ).resolves.toBe("no_apple_identity");
    await expect(
      revokeAppleAuthorization({
        code: "code-1",
        user: appleUser,
        credentials: null,
        fetcher,
      }),
    ).resolves.toBe("not_configured");
    expect(fetcher).not.toHaveBeenCalled();
  });
});

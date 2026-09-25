import "server-only";

import { createPrivateKey, sign } from "node:crypto";

import type { AppleRevocation } from "@screen-time/contracts";
import type { User } from "@supabase/supabase-js";
import { z } from "zod";

const APPLE_ID_URL = "https://appleid.apple.com";
// Both Apple calls run inside the app's 15 s request deadline, before the
// deletion itself.
const APPLE_REQUEST_TIMEOUT_MS = 5_000;
/** Apple accepts up to six months; each deletion signs its own. */
const CLIENT_SECRET_TTL_SECONDS = 300;

export type AppleSignInCredentials = {
  teamId: string;
  keyId: string;
  /** The app's bundle ID: native Sign in with Apple issues codes for it. */
  clientId: string;
  /** The Sign in with Apple key (.p8, PKCS#8 PEM). */
  privateKey: string;
};

/**
 * Null until the Sign in with Apple key is configured, so account deletion
 * keeps working (without revoking) in environments that lack it.
 */
export function appleSignInCredentials(): AppleSignInCredentials | null {
  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_SIGN_IN_KEY_ID;
  const clientId = process.env.APPLE_SIGN_IN_CLIENT_ID;
  // Dashboards often store a PEM on one line with literal "\n".
  const privateKey = process.env.APPLE_SIGN_IN_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n",
  );
  if (!teamId || !keyId || !clientId || !privateKey) return null;
  return { teamId, keyId, clientId, privateKey };
}

/** The ES256 client secret Apple's token endpoints expect. */
export function appleClientSecret(
  credentials: AppleSignInCredentials,
  now = Date.now(),
): string {
  const issuedAt = Math.floor(now / 1000);
  const header = encode({ alg: "ES256", kid: credentials.keyId });
  const payload = encode({
    iss: credentials.teamId,
    iat: issuedAt,
    exp: issuedAt + CLIENT_SECRET_TTL_SECONDS,
    aud: APPLE_ID_URL,
    sub: credentials.clientId,
  });
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), {
    key: createPrivateKey(credentials.privateKey),
    dsaEncoding: "ieee-p1363",
  }).toString("base64url");
  return `${header}.${payload}.${signature}`;
}

/** The Apple user ID (`sub`) of the account's linked Apple identity. */
export function appleSubject(user: User): string | null {
  const identity = user.identities?.find(
    (candidate) => candidate.provider === "apple",
  );
  if (!identity) return null;
  const sub: unknown = identity.identity_data?.sub;
  if (typeof sub === "string" && sub.length > 0) return sub;
  return identity.id || null;
}

const tokenResponseSchema = z.object({
  access_token: z.string().min(1).optional(),
  refresh_token: z.string().min(1).optional(),
  id_token: z.string().min(1),
});

/**
 * Revokes Still's access to the account's Apple ID, as Apple asks of apps
 * that offer Sign in with Apple and account deletion. The app sends a fresh
 * authorization code; exchanging it here yields the tokens to revoke, and the
 * ID token that comes back from Apple says which Apple ID the code belongs
 * to. Never throws: deletion goes on whatever happens here.
 */
export async function revokeAppleAuthorization({
  code,
  user,
  credentials = appleSignInCredentials(),
  fetcher = fetch,
  now = Date.now(),
}: {
  code: string;
  user: User;
  credentials?: AppleSignInCredentials | null;
  fetcher?: typeof fetch;
  now?: number;
}): Promise<AppleRevocation> {
  const expectedSubject = appleSubject(user);
  if (!expectedSubject) return "no_apple_identity";
  if (!credentials) return "not_configured";

  try {
    const clientSecret = appleClientSecret(credentials, now);
    const exchanged = await postForm(fetcher, "/auth/token", {
      client_id: credentials.clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
    });
    if (!exchanged.ok) {
      console.error("Apple authorization code exchange failed", {
        status: exchanged.status,
        error: await appleErrorCode(exchanged),
      });
      return "failed";
    }
    const tokens = tokenResponseSchema.parse(await exchanged.json());
    if (jwtSubject(tokens.id_token) !== expectedSubject) {
      console.error("Apple authorization code belongs to another Apple ID");
      return "account_mismatch";
    }

    const token = tokens.refresh_token ?? tokens.access_token;
    if (!token) return "failed";
    const revoked = await postForm(fetcher, "/auth/revoke", {
      client_id: credentials.clientId,
      client_secret: clientSecret,
      token,
      token_type_hint: tokens.refresh_token ? "refresh_token" : "access_token",
    });
    if (!revoked.ok) {
      console.error("Apple token revocation failed", {
        status: revoked.status,
        error: await appleErrorCode(revoked),
      });
      return "failed";
    }
    return "revoked";
  } catch (error) {
    console.error(
      "Apple token revocation failed",
      error instanceof Error ? error.message : error,
    );
    return "failed";
  }
}

function postForm(
  fetcher: typeof fetch,
  path: string,
  fields: Record<string, string>,
): Promise<Response> {
  return fetcher(`${APPLE_ID_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
    signal: AbortSignal.timeout(APPLE_REQUEST_TIMEOUT_MS),
  });
}

/** Apple's `{ "error": "invalid_grant" }`, never the tokens or the code. */
async function appleErrorCode(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json();
    return typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
      ? body.error
      : null;
  } catch {
    return null;
  }
}

/**
 * The `sub` claim without verifying the signature: the token comes straight
 * from Apple's token endpoint over TLS, in answer to our own request.
 */
function jwtSubject(token: string): string | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const claims: unknown = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    return typeof claims === "object" &&
      claims !== null &&
      "sub" in claims &&
      typeof claims.sub === "string"
      ? claims.sub
      : null;
  } catch {
    return null;
  }
}

function encode(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

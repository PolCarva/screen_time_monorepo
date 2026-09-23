import "server-only";

import { createHmac } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

/** The first address a proxy forwarded, which Vercel sets to the client. */
export function clientAddressFrom(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * The stored key is an HMAC, so the rate-limit table never holds an address,
 * an email or anything that says who was asking.
 */
export function rateLimitKey(scope: string, subject: string): string {
  const secret = process.env.RATE_LIMIT_SECRET ?? process.env.INTERNAL_JOB_SECRET;
  if (!secret) throw new Error("Rate limiting is not configured");
  return createHmac("sha256", secret).update(`${scope}:${subject}`).digest("hex");
}

/** True while `subject` stays under `limit` requests in the window. */
export async function consumeRateLimit(
  client: SupabaseClient,
  scope: string,
  subject: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const { data, error } = await client.rpc("consume_rate_limit", {
    p_key_hash: rateLimitKey(scope, subject),
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw new Error("Rate limit could not be checked");
  return data === true;
}

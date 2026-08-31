import "server-only";

import { createHmac } from "node:crypto";

import { HttpError } from "./http";

export function getClientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const address = forwarded?.split(",", 1)[0]?.trim();
  return address || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function createWaitlistRateLimitKey(
  request: Request,
  secret =
    process.env.WAITLIST_RATE_LIMIT_SECRET ?? process.env.INTERNAL_JOB_SECRET,
): string {
  if (!secret) {
    throw new HttpError(
      503,
      "waitlist_unavailable",
      "Waitlist is not configured",
    );
  }
  return createHmac("sha256", secret)
    .update(`beta-waitlist:${getClientAddress(request)}`)
    .digest("hex");
}

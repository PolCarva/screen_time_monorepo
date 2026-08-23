import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { requireSecret } from "@/lib/env";

type RewardIntentClaims = {
  intentId: string;
  userId: string;
  expiresAt: string;
};

function secret(): string {
  return process.env.REWARD_INTENT_SECRET ?? requireSecret("INTERNAL_JOB_SECRET");
}

export function signRewardIntent(claims: RewardIntentClaims): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyRewardIntent(value: string): RewardIntentClaims {
  const [payload, signature] = value.split(".");
  if (!payload || !signature) throw new Error("Malformed reward custom data");
  const expected = createHmac("sha256", secret()).update(payload).digest();
  const received = Buffer.from(signature, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new Error("Invalid reward custom data signature");
  }
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as RewardIntentClaims;
}

import "server-only";

import { createPublicKey, verify } from "node:crypto";

const KEY_URL = "https://www.gstatic.com/admob/reward/verifier-keys.json";
const MAX_KEY_AGE_MS = 24 * 60 * 60 * 1_000;

type AdMobKey = { keyId: number; pem: string; base64: string };
type KeyCache = { fetchedAt: number; keys: Map<number, AdMobKey> };

let cache: KeyCache | null = null;

async function getKeys(): Promise<Map<number, AdMobKey>> {
  if (cache && Date.now() - cache.fetchedAt < MAX_KEY_AGE_MS) return cache.keys;
  const response = await fetch(KEY_URL, { cache: "no-store", signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error(`Unable to load AdMob verifier keys: ${response.status}`);
  const body = (await response.json()) as { keys: AdMobKey[] };
  const keys = new Map(body.keys.map((key) => [key.keyId, key]));
  if (keys.size === 0) throw new Error("AdMob verifier returned no keys");
  cache = { fetchedAt: Date.now(), keys };
  return keys;
}

function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export type VerifiedSsv = {
  customData: string;
  transactionId: string;
  timestampMs: number;
};

export async function verifyAdMobSsv(url: string): Promise<VerifiedSsv> {
  // AdMob signs the decoded URI query (equivalent to Java URI#getQuery), while
  // Request.url preserves percent escapes such as the space in "Unlock Token".
  // Decode once before slicing the signed bytes and keep the original ordering.
  const query = decodeURIComponent(new URL(url).search.slice(1));
  const signatureMarker = "&signature=";
  const signatureIndex = query.indexOf(signatureMarker);
  if (signatureIndex < 0) throw new Error("SSV signature is missing");
  const content = query.slice(0, signatureIndex);
  const tail = query.slice(signatureIndex + 1);
  const keyMarker = "&key_id=";
  const keyIndex = tail.indexOf(keyMarker);
  if (keyIndex < 0) throw new Error("SSV key_id is missing");
  const encodedSignature = tail.slice("signature=".length, keyIndex);
  const keyId = Number(tail.slice(keyIndex + keyMarker.length));

  const keys = await getKeys();
  const key = keys.get(keyId);
  if (!key) throw new Error(`Unknown AdMob verifier key: ${keyId}`);
  const valid = verify(
    "sha256",
    Buffer.from(content, "utf8"),
    createPublicKey(key.pem),
    decodeBase64Url(encodedSignature),
  );
  if (!valid) throw new Error("Invalid AdMob SSV signature");

  const params = new URLSearchParams(content);
  const customData = params.get("custom_data");
  const transactionId = params.get("transaction_id");
  const timestampMs = Number(params.get("timestamp"));
  if (!customData || !transactionId || !Number.isFinite(timestampMs)) {
    throw new Error("SSV payload is incomplete");
  }
  return { customData, transactionId, timestampMs };
}

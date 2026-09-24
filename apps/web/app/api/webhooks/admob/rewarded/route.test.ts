import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyAdMobSsv: vi.fn(),
  verifyRewardIntent: vi.fn(),
  client: null as unknown,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/admob-ssv", () => ({ verifyAdMobSsv: mocks.verifyAdMobSsv }));
vi.mock("@/lib/reward-intent", () => ({
  verifyRewardIntent: mocks.verifyRewardIntent,
}));
vi.mock("@/lib/supabase", () => ({ createAdminClient: () => mocks.client }));

import { GET } from "./route";

type Outcome = { error: { message: string; code?: string } | null };

function fakeClient({
  intentState = "intent" as string | null,
  claim = { error: null } as Outcome,
  view = { error: null } as Outcome,
} = {}) {
  const rpc = vi.fn(async (name: string) => {
    if (name === "record_verified_ad_view") return view;
    if (name === "claim_reward_intent") return claim;
    return { error: null };
  });
  const updates: unknown[] = [];
  const chain = (result: unknown) => {
    const query = {
      select: () => query,
      eq: () => query,
      in: () => query,
      is: () => query,
      maybeSingle: async () => result,
      then: (resolve: (value: unknown) => unknown) => resolve(result),
    };
    return query;
  };
  return {
    rpc,
    updates,
    from: vi.fn(() => ({
      select: () =>
        chain({
          data: intentState ? { id: "intent-1", state: intentState } : null,
          error: null,
        }),
      update: (values: unknown) => {
        updates.push(values);
        return chain({ error: null });
      },
    })),
  };
}

const callback = "https://still.test/api/webhooks/admob/rewarded?signed";
const ssv = {
  customData: "signed.intent",
  adUnit: "5537927350",
  transactionId: "tx-1",
  timestampMs: Date.parse("2026-09-23T15:00:00.000Z"),
};
const intent = {
  intentId: "8a5116a1-f1a8-46fa-9bdf-1ade3f5b8a1e",
  userId: "8a5116a1-f1a8-46fa-9bdf-1ade3f5b8a1f",
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
};

beforeEach(() => {
  mocks.verifyAdMobSsv.mockReset().mockResolvedValue(ssv);
  mocks.verifyRewardIntent.mockReset().mockReturnValue(intent);
});

describe("AdMob rewarded callback", () => {
  it("rejects a callback Google did not sign", async () => {
    const client = fakeClient();
    mocks.client = client;
    mocks.verifyAdMobSsv.mockRejectedValue(new Error("Invalid AdMob SSV signature"));

    const response = await GET(new Request(callback));

    expect(response.status).toBe(400);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("counts the ad, grants the pass and verifies the intent", async () => {
    const client = fakeClient();
    mocks.client = client;

    const response = await GET(new Request(callback));

    expect(response.status).toBe(200);
    expect(client.rpc).toHaveBeenNthCalledWith(1, "record_verified_ad_view", {
      p_transaction_id: "tx-1",
      p_ad_unit: "5537927350",
      p_rewarded_at: "2026-09-23T15:00:00.000Z",
      p_intent_id: intent.intentId,
      p_user_id: intent.userId,
    });
    expect(client.rpc).toHaveBeenNthCalledWith(
      2,
      "claim_reward_intent",
      expect.objectContaining({ p_intent_id: intent.intentId }),
    );
    expect(client.updates).toEqual([
      expect.objectContaining({ state: "verified", provider_transaction_id: "tx-1" }),
    ]);
  });

  it("counts an ad shown without an intent, unattributed and without a pass", async () => {
    const client = fakeClient();
    mocks.client = client;
    mocks.verifyAdMobSsv.mockResolvedValue({ ...ssv, customData: null });

    const response = await GET(new Request(callback));

    expect(response.status).toBe(200);
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledWith(
      "record_verified_ad_view",
      expect.objectContaining({ p_intent_id: null, p_user_id: null }),
    );
  });

  it("keeps counting the ad when its intent expired before the claim", async () => {
    const client = fakeClient({
      claim: { error: { message: "reward_intent_expired" } },
    });
    mocks.client = client;

    const response = await GET(new Request(callback));

    expect(response.status).toBe(200);
    expect(client.rpc).toHaveBeenCalledWith("record_verified_ad_view", expect.anything());
    expect(client.updates).toEqual([]);
  });

  it("does not claim an intent that expired more than a day ago", async () => {
    const client = fakeClient();
    mocks.client = client;
    mocks.verifyRewardIntent.mockReturnValue({
      ...intent,
      expiresAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    });

    const response = await GET(new Request(callback));

    expect(response.status).toBe(200);
    expect(client.rpc).toHaveBeenCalledTimes(1);
  });

  it("asks Google to retry when the view cannot be stored", async () => {
    mocks.client = fakeClient({ view: { error: { message: "connection reset" } } });

    const response = await GET(new Request(callback));

    expect(response.status).toBe(503);
  });
});

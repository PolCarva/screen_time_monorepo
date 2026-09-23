import { generateKeyPairSync, sign } from "node:crypto";

import { afterEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { verifyAdMobSsv } from "./admob-ssv";

const { privateKey, publicKey } = generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
});
const keyId = 3_335_741_209;

afterEach(() => vi.unstubAllGlobals());

it.each(["Unlock%20Token", "Unlock+Token"])(
  "verifies AdMob callbacks with transported reward item %s without reordering the signed query",
  async (transportedRewardItem) => {
    const content = [
      "ad_network=5450213213286189855",
      "ad_unit=5537927350",
      "custom_data=signed.intent_value",
      "reward_amount=1",
      "reward_item=Unlock Token",
      "timestamp=1787527150000",
      "transaction_id=test-transaction",
    ].join("&");
    const signature = sign("sha256", Buffer.from(content, "utf8"), privateKey).toString("base64url");
    const encodedContent = content.replace("Unlock Token", transportedRewardItem);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          keys: [
            {
              keyId,
              pem: publicKey.export({ type: "spki", format: "pem" }).toString(),
              base64: "unused",
            },
          ],
        }),
      ),
    );

    await expect(
      verifyAdMobSsv(
        `https://still.test/api/webhooks/admob/rewarded?${encodedContent}&signature=${signature}&key_id=${keyId}`,
      ),
    ).resolves.toEqual({
      customData: "signed.intent_value",
      adUnit: "5537927350",
      timestampMs: 1_787_527_150_000,
      transactionId: "test-transaction",
    });
  },
);

function stubKeys() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        keys: [
          {
            keyId,
            pem: publicKey.export({ type: "spki", format: "pem" }).toString(),
            base64: "unused",
          },
        ],
      }),
    ),
  );
}

it("accepts a signed callback without custom data, so an ad shown without an intent still counts", async () => {
  const content = [
    "ad_network=5450213213286189855",
    "ad_unit=5537927350",
    "reward_amount=1",
    "reward_item=Pass",
    "timestamp=1787527150000",
    "transaction_id=no-intent-transaction",
  ].join("&");
  const signature = sign("sha256", Buffer.from(content, "utf8"), privateKey).toString("base64url");
  stubKeys();

  await expect(
    verifyAdMobSsv(
      `https://still.test/api/webhooks/admob/rewarded?${content}&signature=${signature}&key_id=${keyId}`,
    ),
  ).resolves.toEqual({
    customData: null,
    adUnit: "5537927350",
    timestampMs: 1_787_527_150_000,
    transactionId: "no-intent-transaction",
  });
});

it("rejects a callback whose content was changed after Google signed it", async () => {
  const content = "ad_unit=5537927350&timestamp=1787527150000&transaction_id=original";
  const signature = sign("sha256", Buffer.from(content, "utf8"), privateKey).toString("base64url");
  stubKeys();

  await expect(
    verifyAdMobSsv(
      `https://still.test/api/webhooks/admob/rewarded?${content.replace("original", "forged")}&signature=${signature}&key_id=${keyId}`,
    ),
  ).rejects.toThrow("Invalid AdMob SSV signature");
});

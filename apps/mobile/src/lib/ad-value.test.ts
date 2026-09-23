import { describe, expect, it } from "vitest";

import { adValueFromMicros, adValueFromPaidEvent } from "./ad-value";

describe("impression value from the SDK", () => {
  it("turns the React Native paid event into micros", () => {
    expect(
      adValueFromPaidEvent({ value: 0.0042, currency: "USD", precision: 3 }),
    ).toEqual({ valueMicros: 4_200, currency: "USD", precision: "precise" });
  });

  it("names every precision both SDKs report", () => {
    expect(adValueFromMicros(1, "USD", 0)?.precision).toBe("unknown");
    expect(adValueFromMicros(1, "USD", 1)?.precision).toBe("estimated");
    expect(adValueFromMicros(1, "USD", 2)?.precision).toBe("publisher_provided");
    expect(adValueFromMicros(1, "USD", 3)?.precision).toBe("precise");
    expect(adValueFromMicros(1, "USD", 9)?.precision).toBe("unknown");
  });

  it("keeps a test impression's zero value so the server can tell it apart", () => {
    expect(adValueFromMicros(0, "usd", 0)).toEqual({
      valueMicros: 0,
      currency: "USD",
      precision: "unknown",
    });
  });

  it("drops values that are not an amount", () => {
    expect(adValueFromPaidEvent(null)).toBeUndefined();
    expect(adValueFromMicros(Number.NaN, "USD", 3)).toBeUndefined();
    expect(adValueFromMicros(-5, "USD", 3)).toBeUndefined();
    expect(adValueFromMicros(5, "", 3)).toBeUndefined();
    expect(adValueFromMicros(5, "dollars", 3)).toBeUndefined();
  });

  it("bounds an absurd value to what the claim accepts", () => {
    expect(adValueFromMicros(5e9, "USD", 3)?.valueMicros).toBe(10_000_000);
  });
});

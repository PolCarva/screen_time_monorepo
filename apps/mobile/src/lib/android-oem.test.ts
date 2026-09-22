import { describe, expect, it } from "vitest";

import { isAggressiveOem, oemGuidance } from "./android-oem";

describe("oemGuidance", () => {
  it("maps Xiaomi sub-brands to Xiaomi guidance", () => {
    for (const maker of ["Xiaomi", "Redmi", "POCO", "xiaomi"]) {
      const guidance = oemGuidance(maker);
      expect(guidance.key).toBe("xiaomi");
      expect(guidance.tips.some((tip) => /pop-up|emergentes/.test(tip.en + tip.es))).toBe(true);
    }
  });

  it("groups OnePlus and Realme with Oppo, and iQOO with vivo", () => {
    expect(oemGuidance("OnePlus").key).toBe("oppo");
    expect(oemGuidance("realme").key).toBe("oppo");
    expect(oemGuidance("iQOO").key).toBe("vivo");
    expect(oemGuidance("HONOR").key).toBe("huawei");
  });

  it("falls back to generic guidance for unknown or Pixel devices", () => {
    const guidance = oemGuidance("Google");
    expect(guidance.key).toBe("generic");
    expect(guidance.name).toBe("");
    expect(guidance.tips).toHaveLength(1);
    expect(isAggressiveOem("Google")).toBe(false);
    expect(isAggressiveOem("Xiaomi")).toBe(true);
  });
});

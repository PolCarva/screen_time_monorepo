import { describe, expect, it } from "vitest";

import { accessibilityPathTip, isAggressiveOem, oemGuidance } from "./android-oem";

describe("oemGuidance", () => {
  it("maps Xiaomi sub-brands to Xiaomi guidance", () => {
    for (const maker of ["Xiaomi", "Redmi", "POCO", "xiaomi"]) {
      const guidance = oemGuidance(maker);
      expect(guidance.key).toBe("xiaomi");
      expect(guidance.tips.some((tip) => /pop-up|emergentes/.test(tip.en + tip.es))).toBe(true);
    }
  });

  it("asks Xiaomi users for Autostart and to lock Still in Recents", () => {
    // Without them, closing Still from Recents leaves the pause off.
    const tips = oemGuidance("Xiaomi").tips.map((tip) => tip.es);
    expect(tips[0]).toContain("Inicio automático");
    expect(tips.some((tip) => tip.includes("Recientes"))).toBe(true);
  });

  it("takes every tip to the screen where it is done", () => {
    // Autostart and battery live in Still's app info on Xiaomi.
    expect(oemGuidance("Xiaomi").tips.map((tip) => tip.opens)).toEqual([
      "appInfo",
      "appInfo",
      "recents",
      "popups",
    ]);
    expect(oemGuidance("Google").tips[0]!.opens).toBe("battery");
    for (const maker of ["Samsung", "Huawei", "OPPO", "vivo"]) {
      expect(oemGuidance(maker).tips.every((tip) => Boolean(tip.opens))).toBe(true);
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

describe("where each maker keeps the Accessibility switch", () => {
  it("names the usual path for known makers and nothing for others", () => {
    expect(accessibilityPathTip("Xiaomi")?.es).toContain("Ajustes adicionales");
    expect(accessibilityPathTip("samsung")?.en).toContain("Installed apps");
    expect(accessibilityPathTip("Google")).toBeNull();
  });
});

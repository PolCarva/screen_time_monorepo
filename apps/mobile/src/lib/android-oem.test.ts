import { describe, expect, it } from "vitest";

import {
  accessibilityPathTip,
  isAggressiveOem,
  needsAutostart,
  oemGuidance,
  tipsToShow,
} from "./android-oem";

describe("oemGuidance", () => {
  it("maps Xiaomi sub-brands to Xiaomi guidance", () => {
    for (const maker of ["Xiaomi", "Redmi", "POCO", "xiaomi"]) {
      const guidance = oemGuidance(maker);
      expect(guidance.key).toBe("xiaomi");
      expect(guidance.tips.some((tip) => /pop-up|emergentes/.test(tip.en + tip.es))).toBe(true);
    }
  });

  it("asks Xiaomi users for Autostart first, and not to lock Still in Recents", () => {
    // Without Autostart, closing Still from Recents leaves the pause off; a
    // locked card is closed all the same (android-parity-plan §15).
    const tips = oemGuidance("Xiaomi").tips;
    expect(tips[0]!.es).toContain("Inicio automático");
    expect(tips[0]!.reported).toBe("autostart");
    expect(tips.some((tip) => tip.es.includes("Recientes"))).toBe(false);
  });

  it("drops the Autostart tip once the phone reports it", () => {
    const tips = oemGuidance("Xiaomi").tips;
    expect(tipsToShow(tips, "allowed")).toHaveLength(tips.length - 1);
    expect(tipsToShow(tips, "denied").some((tip) => tip.reported)).toBe(false);
    expect(tipsToShow(tips, "unknown")).toEqual(tips);
    expect(tipsToShow(tips, undefined)).toEqual(tips);
  });

  it("asks for Autostart only when the phone says it is off", () => {
    expect(needsAutostart("denied")).toBe(true);
    expect(needsAutostart("allowed")).toBe(false);
    expect(needsAutostart("unknown")).toBe(false);
    expect(needsAutostart(undefined)).toBe(false);
  });

  it("takes every tip to the screen where it is done", () => {
    // Autostart and battery live in Still's app info on Xiaomi.
    expect(oemGuidance("Xiaomi").tips.map((tip) => tip.opens)).toEqual([
      "appInfo",
      "appInfo",
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

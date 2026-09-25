/// <reference types="node" />

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  ANDROID_SETTINGS_STRINGS,
  SHORTCUTS_STRINGS,
  androidSettingsString,
  fillSystemString,
  shortcutsString,
  systemVariantFor,
  usageAccessKeys,
} from "./system-strings";

describe("system strings", () => {
  it("uses Spain's tables only for Spanish from Spain", () => {
    expect(systemVariantFor({ languageCode: "es", languageTag: "es-ES" })).toBe("es");
    expect(
      systemVariantFor({ languageCode: "es", languageTag: "es-UY", languageRegionCode: "ES" }),
    ).toBe("es");
    expect(systemVariantFor({ languageTag: "es" })).toBe("es");
  });

  it("uses Latin American tables for every other Spanish", () => {
    for (const languageTag of ["es-419", "es-MX", "es-US", "es-UY", "es-AR"]) {
      expect(systemVariantFor({ languageCode: "es", languageTag })).toBe("es-419");
    }
  });

  it("falls back to English like the rest of Still", () => {
    expect(systemVariantFor({ languageCode: "en", languageTag: "en-US" })).toBe("en");
    expect(systemVariantFor({ languageCode: "pt", languageTag: "pt-BR" })).toBe("en");
    expect(systemVariantFor({})).toBe("en");
  });

  it("quotes the exact button each variant shows", () => {
    expect(shortcutsString("en", "runImmediately")).toBe("Run Immediately");
    expect(shortcutsString("es", "runImmediately")).toBe("Ejecutar inmediatamente");
    expect(shortcutsString("es-419", "runImmediately")).toBe("Ejecutar de inmediato");
    expect(androidSettingsString("es-419", "deny")).toBe("Rechazar");
    expect(androidSettingsString("es", "deny")).toBe("Denegar");
  });

  it("fills the app name into Apple's and Android's templates", () => {
    expect(shortcutsString("en", "whenOpened", { app: "Instagram" })).toBe(
      "When “Instagram” is opened",
    );
    expect(shortcutsString("es-419", "whenOpened", { app: "Instagram" })).toBe(
      "Cuando se abra Instagram",
    );
    expect(shortcutsString("es", "getScopeApp", { scope: "Actual" })).toBe(
      "Obtener la app Actual",
    );
    expect(androidSettingsString("es", "useService", { app: "Still" })).toBe(
      "Usar Still",
    );
    expect(fillSystemString("Open ${x}", { x: "App" })).toBe("Open App");
  });

  it("quotes Still's action as its App Intent shows it in Spanish", () => {
    // ios/Still/Localizable.xcstrings translates the intent (D12); the guide
    // must name it the same way or Spanish phones would not find it.
    const catalog = JSON.parse(
      readFileSync(new URL("../../ios/Still/Localizable.xcstrings", import.meta.url), "utf8"),
    ) as { strings: Record<string, { localizations?: { es?: { stringUnit?: { value?: string } } } }> };
    const spanish = (key: string) => catalog.strings[key]?.localizations?.es?.stringUnit?.value;
    for (const variant of ["es", "es-419"] as const) {
      expect(spanish("Pause App")).toBe(shortcutsString(variant, "stillAction"));
      expect(spanish("Pause ${app}")).toBe(
        `${shortcutsString(variant, "stillSummaryPrefix")} \${app}`,
      );
      expect(spanish("Pause Before Opening")).toBe(
        shortcutsString(variant, "legacyStillAction"),
      );
    }
  });

  it("has every entry in all three variants", () => {
    for (const table of [SHORTCUTS_STRINGS, ANDROID_SETTINGS_STRINGS]) {
      for (const entry of Object.values(table)) {
        expect(entry.en.length).toBeGreaterThan(0);
        expect(entry.es.length).toBeGreaterThan(0);
        expect(entry["es-419"].length).toBeGreaterThan(0);
      }
    }
  });
});

describe("usage access labels by Android release", () => {
  it("follows the page's renames (android14/15/16-release)", () => {
    expect(usageAccessKeys(34)).toEqual({ title: "usageAccess", toggle: "permitUsageAccess" });
    expect(usageAccessKeys(35)).toEqual({ title: "usageAccess", toggle: "permitUsageAccess15" });
    expect(usageAccessKeys(36)).toEqual({ title: "usageAccess16", toggle: "permitUsageAccess16" });
    expect(androidSettingsString("es-419", "permitUsageAccess16")).toBe(
      "Permitir el acceso a los datos de uso de la app",
    );
  });
});

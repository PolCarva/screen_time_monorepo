import { describe, expect, it } from "vitest";

import {
  ANDROID_SETTINGS_STRINGS,
  SHORTCUTS_STRINGS,
  androidSettingsString,
  fillSystemString,
  shortcutsString,
  systemVariantFor,
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

/// <reference types="node" />

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  IOS_APP_CATALOG,
  catalogUrl,
  findCatalogApp,
  normalizeAppName,
} from "./ios-app-catalog";

describe("iOS app catalog", () => {
  it("normalizes display names the same way the App Intent does", () => {
    expect(normalizeAppName("  YouTube ")).toBe("youtube");
    expect(normalizeAppName("Disney+")).toBe("disney");
    expect(normalizeAppName("Prime Video")).toBe("primevideo");
    expect(normalizeAppName("Pokémon GO")).toBe("pokemongo");
    expect(normalizeAppName("BeReal.")).toBe("bereal");
    expect(normalizeAppName("微信")).toBe("微信");
    expect(normalizeAppName("   ")).toBe("");
  });

  it("finds an app by name or alias regardless of case and accents", () => {
    expect(findCatalogApp("instagram")?.id).toBe("instagram");
    expect(findCatalogApp("Twitter")?.id).toBe("x");
    expect(findCatalogApp("mercado livre")?.id).toBe("mercado-libre");
    expect(findCatalogApp("Some Unknown App")).toBeUndefined();
    expect(findCatalogApp("")).toBeUndefined();
  });

  it("keeps ids and match keys unique so one name never resolves to two apps", () => {
    const ids = IOS_APP_CATALOG.map((app) => app.id);
    expect(new Set(ids).size).toBe(ids.length);

    const keys = IOS_APP_CATALOG.flatMap((app) => [
      ...new Set([app.name, ...app.aliases].map(normalizeAppName)),
    ]);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((key) => key.length > 0)).toBe(true);
  });

  it("only lists well-formed schemes that cannot hijack Still, Shortcuts or the web", () => {
    for (const app of IOS_APP_CATALOG) {
      expect(app.scheme).toMatch(/^[a-z][a-z0-9+.-]*$/);
      expect(["still", "shortcuts", "http", "https", "tel", "sms"]).not.toContain(
        app.scheme,
      );
      expect(catalogUrl(app)).toBe(`${app.scheme}://`);
    }
  });

  it("stays in sync with LSApplicationQueriesSchemes and under the iOS limit of 50", () => {
    const info = readFileSync(
      new URL("../../ios/Still/Info.plist", import.meta.url),
      "utf8",
    );
    const block = info.match(
      /<key>LSApplicationQueriesSchemes<\/key>\s*<array>([\s\S]*?)<\/array>/,
    );
    expect(block).not.toBeNull();
    const declared = [...block![1]!.matchAll(/<string>([^<]+)<\/string>/g)].map(
      (match) => match[1],
    );
    const expected = [
      ...new Set([...IOS_APP_CATALOG.map((app) => app.scheme), "shortcuts"]),
    ].sort();

    expect([...declared].sort()).toEqual(expected);
    expect(declared.length).toBeLessThanOrEqual(50);
  });
});

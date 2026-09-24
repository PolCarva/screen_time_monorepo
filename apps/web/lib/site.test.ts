import { describe, expect, it } from "vitest";

import { STORES, liveStoreUrls, resolveSiteUrl, storeNote } from "./site";

describe("resolveSiteUrl", () => {
  it("uses the configured origin without a trailing slash", () => {
    expect(resolveSiteUrl("https://example.com/", "production")).toBe(
      "https://example.com",
    );
  });

  it("refuses to guess the production origin", () => {
    expect(() => resolveSiteUrl(undefined, "production")).toThrow(
      "NEXT_PUBLIC_APP_URL",
    );
    expect(() => resolveSiteUrl("  ", "production")).toThrow();
  });

  it("falls back to localhost outside production", () => {
    expect(resolveSiteUrl(undefined, "preview")).toBe("http://localhost:3000");
    expect(resolveSiteUrl(undefined, undefined)).toBe("http://localhost:3000");
  });
});

describe("store state", () => {
  const live = {
    ios: { ...STORES.ios, status: "live" as const },
    android: { ...STORES.android, status: "live" as const },
  };

  it("says where each version stands while they are not public", () => {
    expect(storeNote(STORES)).toBe(
      "Gratis · iPhone en revisión de Apple · Android en pruebas cerradas de Google Play.",
    );
    expect(liveStoreUrls(STORES)).toEqual([]);
  });

  it("lists only the public listings", () => {
    expect(storeNote(live)).toBe("Gratis en iPhone y Android.");
    expect(liveStoreUrls(live)).toEqual([STORES.ios.url, STORES.android.url]);
    expect(
      storeNote({ ...STORES, ios: { ...STORES.ios, status: "live" } }),
    ).toBe(
      "Gratis · disponible en iPhone · Android en pruebas cerradas de Google Play.",
    );
  });
});

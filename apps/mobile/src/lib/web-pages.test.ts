/// <reference types="node" />

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { PRIVACY_POLICY_PATH, webPageUrl } from "./web-pages";

describe("web pages", () => {
  it("resolves a page against the site's origin", () => {
    expect(webPageUrl(PRIVACY_POLICY_PATH, "https://still.example")).toBe(
      "https://still.example/privacy",
    );
    expect(webPageUrl("/soporte", "https://still.example/api/")).toBe(
      "https://still.example/soporte",
    );
  });

  it("links the privacy policy from Settings", () => {
    // App Review 5.1.1(i) rejects apps whose policy is only in the store listing.
    const settings = readFileSync(
      new URL("../../app/(tabs)/(settings)/index.tsx", import.meta.url),
      "utf8",
    );
    expect(settings).toContain("webPageUrl(PRIVACY_POLICY_PATH)");
  });
});

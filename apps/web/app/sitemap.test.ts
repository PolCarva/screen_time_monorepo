import { describe, expect, it } from "vitest";

import { PUBLIC_ROUTES } from "@/lib/routes";

import sitemap from "./sitemap";

describe("sitemap", () => {
  it("lists every public route once, with its date and no ignored fields", () => {
    const entries = sitemap();
    expect(entries).toHaveLength(PUBLIC_ROUTES.length);
    for (const entry of entries) {
      expect(entry.url).toMatch(/^https?:\/\//);
      expect(entry.lastModified).toBeTruthy();
      expect(entry).not.toHaveProperty("priority");
      expect(entry).not.toHaveProperty("changeFrequency");
    }
    expect(entries.map((entry) => entry.url)).not.toContain(
      expect.stringContaining("/admin"),
    );
  });
});

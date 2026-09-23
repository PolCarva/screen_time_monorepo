/// <reference types="node" />

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// The setup guides draw Apple's and Google's screens in code
// (docs/ui-clarity-plan.md §4): no screenshot may come back into the app.
const root = new URL("../..", import.meta.url).pathname;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx|js|mjs)$/.test(name) ? [path] : [];
  });
}

describe("setup guides", () => {
  it("do not load captures of Shortcuts or of Android's Settings", () => {
    const offenders = [...sources(join(root, "app")), ...sources(join(root, "src"))]
      .filter((path) => !path.endsWith("guide-assets.test.ts"))
      .filter((path) => {
        const text = readFileSync(path, "utf8");
        return text.includes("assets/shortcut-guide") || text.includes("assets/android-guide");
      });
    expect(offenders).toEqual([]);
  });
});

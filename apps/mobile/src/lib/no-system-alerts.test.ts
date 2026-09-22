/// <reference types="node" />

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = new URL("../../", import.meta.url).pathname;

function sources(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(entry) && !entry.includes(".test.") ? [path] : [];
  });
}

describe("system alerts", () => {
  it("are never used: every notice is a Still sheet or toast", () => {
    // The system alert cannot carry Still's look or the button that fixes the
    // problem it reports. Use useStillSheet() from components/still-sheet.
    const offenders = [join(root, "app"), join(root, "src")]
      .flatMap(sources)
      .filter((path) => {
        const source = readFileSync(path, "utf8");
        return (
          /\bAlert\.alert\s*\(/.test(source) ||
          /import\s*\{[^}]*\bAlert\b[^}]*\}\s*from\s*["']react-native["']/.test(
            source,
          )
        );
      })
      .map((path) => path.replace(root, ""));
    expect(offenders).toEqual([]);
  });
});

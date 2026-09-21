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

describe("React Native Linking usage", () => {
  it("never passes Linking.openURL as a bare function reference", () => {
    // `openURL` is a class method that reads `this`. Handed over unbound
    // (`openUrl: Linking.openURL`) it throws a TypeError before iOS sees the
    // URL, which silently broke the return to the app after a pause.
    const offenders = [join(root, "app"), join(root, "src")]
      .flatMap(sources)
      .filter((path) =>
        /Linking\.(openURL|canOpenURL|openSettings)\b(?!\s*\()/.test(
          readFileSync(path, "utf8"),
        ),
      )
      .map((path) => path.replace(root, ""));
    expect(offenders).toEqual([]);
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ANDROID_LABELS, SHORTCUTS_LABELS } from "./system-labels";

const source = readFileSync(
  join(__dirname, "../../mobile/src/lib/system-strings.ts"),
  "utf8",
);

/** The `es-419` value of one key, or the shared value of a `same(...)` entry. */
function es419(key: string): string | undefined {
  const block = source.match(new RegExp(`\\n  ${key}: ([\\s\\S]*?)\\n  [a-zA-Z]+:`));
  const entry = block?.[1] ?? "";
  const variant = entry.match(/"es-419": "([^"]*)"/);
  if (variant) return variant[1];
  return entry.match(/^same\("([^"]*)"\)/)?.[1];
}

describe("setup guide labels", () => {
  it("quote Shortcuts exactly as the app's es-419 strings", () => {
    for (const [key, label] of Object.entries(SHORTCUTS_LABELS)) {
      expect(es419(key), key).toBe(label);
    }
  });

  it("quote Android Settings exactly as the app's es-419 strings", () => {
    for (const [key, label] of Object.entries(ANDROID_LABELS)) {
      const expected = es419(key)?.replace("${app}", "Still");
      expect(expected, key).toBe(label);
    }
  });
});

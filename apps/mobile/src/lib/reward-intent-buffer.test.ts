import { describe, expect, it } from "vitest";

import {
  intentsNeeded,
  mergeIntents,
  pruneExpiredIntents,
  removeIntent,
  type SignedRewardIntent,
} from "./reward-intent-buffer";

const at = (isoOffsetMinutes: number): string =>
  new Date(Date.now() + isoOffsetMinutes * 60_000).toISOString();

function intent(id: string, expiresInMinutes: number): SignedRewardIntent {
  return {
    id,
    customData: "signed-custom-data-payload",
    userId: "anonymous",
    expiresAt: at(expiresInMinutes),
  };
}

describe("pruneExpiredIntents", () => {
  it("keeps intents valid past the skew and drops the rest", () => {
    const now = Date.now();
    const kept = pruneExpiredIntents(
      [intent("fresh", 10), intent("soon", 0.5), intent("dead", -5)],
      now,
    );
    expect(kept.map((entry) => entry.id)).toEqual(["fresh"]);
  });

  it("drops intents with an unparseable expiry", () => {
    const now = Date.now();
    const kept = pruneExpiredIntents(
      [{ id: "x", customData: "signed-custom-data", userId: "a", expiresAt: "nope" }],
      now,
    );
    expect(kept).toEqual([]);
  });
});

describe("intentsNeeded", () => {
  it("fills up to capacity and never goes negative", () => {
    expect(intentsNeeded(0)).toBe(3);
    expect(intentsNeeded(2)).toBe(1);
    expect(intentsNeeded(3)).toBe(0);
    expect(intentsNeeded(5)).toBe(0);
  });
});

describe("removeIntent", () => {
  it("removes a claimed intent by id", () => {
    const list = [intent("a", 10), intent("b", 10)];
    expect(removeIntent(list, "a").map((entry) => entry.id)).toEqual(["b"]);
  });
});

describe("mergeIntents", () => {
  it("de-duplicates by id and caps at capacity", () => {
    const merged = mergeIntents(
      [intent("a", 10), intent("b", 10)],
      [intent("b", 10), intent("c", 10), intent("d", 10)],
    );
    expect(merged.map((entry) => entry.id)).toEqual(["a", "b", "c"]);
  });
});

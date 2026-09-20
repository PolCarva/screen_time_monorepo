import { describe, expect, it } from "vitest";

import {
  type NativeShortcutTarget,
  type ShortcutTarget,
  activeTargets,
  addCustomTarget,
  catalogTargets,
  disableTargetScheme,
  hydrateTargets,
  mergeNativeTargets,
  returnShortcutName,
  setTargetSelected,
  toNativeTargets,
} from "./shortcut-targets";

function find(targets: readonly ShortcutTarget[], id: string) {
  const target = targets.find((entry) => entry.id === id);
  if (!target) throw new Error(`missing target ${id}`);
  return target;
}

describe("shortcut targets", () => {
  it("starts with every catalog app on the shelf and none chosen", () => {
    const targets = hydrateTargets([]);
    expect(targets.length).toBe(catalogTargets().length);
    expect(activeTargets(targets)).toEqual([]);
    expect(find(targets, "instagram").urlScheme).toBe("instagram://");
  });

  it("selecting and deselecting never deletes, so the intent can stay silent", () => {
    const selected = setTargetSelected(hydrateTargets([]), "youtube", true);
    expect(activeTargets(selected).map((target) => target.id)).toEqual([
      "youtube",
    ]);
    const removed = setTargetSelected(selected, "youtube", false);
    expect(find(removed, "youtube").state).toBe("removed");
    expect(removed.length).toBe(selected.length);
  });

  it("refreshes catalog data from the build while keeping the stored choice", () => {
    const stored: ShortcutTarget[] = [
      {
        id: "x",
        name: "Old name",
        aliases: [],
        urlScheme: "stale://",
        origin: "catalog",
        state: "active",
      },
    ];
    const x = find(hydrateTargets(stored), "x");
    expect(x).toMatchObject({
      name: "X",
      urlScheme: "twitter://",
      state: "active",
    });
    expect(x.aliases).toContain("Twitter");
  });

  it("keeps a scheme disabled once it failed on this device", () => {
    const broken = disableTargetScheme(
      setTargetSelected(hydrateTargets([]), "tiktok", true),
      "tiktok",
    );
    expect(find(hydrateTargets(broken), "tiktok").urlScheme).toBeNull();
  });

  it("adds a custom app without a scheme and rejects unusable names", () => {
    const base = hydrateTargets([]);
    const added = addCustomTarget(base, "  My   Bank ");
    expect(added.error).toBeUndefined();
    expect(find(added.targets, "custom:mybank")).toMatchObject({
      name: "My Bank",
      urlScheme: null,
      origin: "custom",
      state: "active",
    });
    expect(addCustomTarget(base, "   ").error).toBe("empty");
    expect(addCustomTarget(base, "a".repeat(81)).error).toBe("too_long");
    expect(addCustomTarget(added.targets, "my bank").error).toBe("duplicate");
  });

  it("turns a typed catalog name or alias into the catalog app instead of a duplicate", () => {
    const result = addCustomTarget(hydrateTargets([]), "twitter");
    expect(result.id).toBe("x");
    expect(result.targets.length).toBe(catalogTargets().length);
    expect(find(result.targets, "x").state).toBe("active");
  });

  it("adopts apps the intent detected and activates catalog apps it matched", () => {
    const native: NativeShortcutTarget[] = [
      {
        id: "detected:mybank",
        name: "My Bank",
        matchKeys: ["mybank"],
        urlScheme: null,
        origin: "detected",
        state: "active",
      },
      {
        id: "reddit",
        name: "Reddit",
        matchKeys: ["reddit"],
        urlScheme: "reddit://",
        origin: "catalog",
        state: "active",
      },
    ];
    const merged = mergeNativeTargets(hydrateTargets([]), native);
    expect(find(merged, "detected:mybank")).toMatchObject({
      origin: "detected",
      state: "active",
    });
    expect(find(merged, "reddit").state).toBe("active");
    expect(mergeNativeTargets(merged, native)).toEqual(merged);
  });

  it("never lets the intent resurrect an app the user removed", () => {
    const removed = setTargetSelected(
      setTargetSelected(hydrateTargets([]), "reddit", true),
      "reddit",
      false,
    );
    const merged = mergeNativeTargets(removed, [
      {
        id: "reddit",
        name: "Reddit",
        matchKeys: ["reddit"],
        urlScheme: "reddit://",
        origin: "catalog",
        state: "active",
      },
    ]);
    expect(find(merged, "reddit").state).toBe("removed");
  });

  it("hands a detected app over to the catalog once the catalog covers it", () => {
    const stored: ShortcutTarget[] = [
      {
        id: "detected:bluesky",
        name: "Bluesky",
        aliases: [],
        urlScheme: null,
        origin: "detected",
        state: "active",
      },
    ];
    const hydrated = hydrateTargets(stored);
    expect(hydrated.some((target) => target.id === "detected:bluesky")).toBe(
      false,
    );
    expect(find(hydrated, "bluesky")).toMatchObject({
      state: "active",
      urlScheme: "bluesky://",
    });
  });

  it("mirrors match keys for every alias to the native store", () => {
    const x = toNativeTargets(hydrateTargets([])).find(
      (target) => target.id === "x",
    );
    expect(x?.matchKeys).toEqual(["x", "twitter"]);
    expect(x).not.toHaveProperty("aliases");
  });

  it("derives the return shortcut name with the middle dot the intent expects", () => {
    expect(returnShortcutName("YouTube")).toBe("Still · YouTube");
  });
});

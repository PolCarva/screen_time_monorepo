import { describe, expect, it } from "vitest";

import { POPULAR_APP_IDS, pickerSections, searchTargets } from "./ios-app-picker";
import {
  type ShortcutTarget,
  addCustomTarget,
  catalogTargets,
  setTargetSelected,
} from "./shortcut-targets";

const none = { installed: new Set<string>(), chosenBefore: new Set<string>() };
const ids = (targets: readonly ShortcutTarget[]) => targets.map((target) => target.id);

describe("iOS app picker sections", () => {
  it("puts the popular apps first when nothing is known about this iPhone", () => {
    const sections = pickerSections(catalogTargets(), none);
    expect(sections.onDevice).toEqual([]);
    expect(ids(sections.popular)).toEqual(POPULAR_APP_IDS);
    // Every catalog app is still reachable, exactly once.
    const all = [...sections.chosen, ...sections.popular, ...sections.more];
    expect(new Set(ids(all)).size).toBe(catalogTargets().length);
    expect(ids(sections.more)).not.toContain("instagram");
  });

  it("lists the chosen apps first, then the ones on this iPhone, then the popular ones", () => {
    const chosen = setTargetSelected(catalogTargets(), "spotify", true);
    const sections = pickerSections(chosen, {
      installed: new Set(["netflix", "tiktok", "spotify"]),
      chosenBefore: new Set(["spotify"]),
    });
    expect(ids(sections.chosen)).toEqual(["spotify"]);
    // Most common first, then alphabetically.
    expect(ids(sections.onDevice)).toEqual(["tiktok", "netflix"]);
    expect(ids(sections.popular)).not.toContain("tiktok");
    expect(ids(sections.popular)).not.toContain("netflix");
    expect(ids(sections.more)).not.toContain("spotify");
  });

  it("leaves Apple's own apps out of the ones found on this iPhone", () => {
    const sections = pickerSections(catalogTargets(), {
      installed: new Set(["apple-photos", "apple-calendar", "instagram"]),
      chosenBefore: new Set(),
    });
    expect(ids(sections.onDevice)).toEqual(["instagram"]);
    expect(ids(sections.more)).toContain("apple-photos");
    const chosen = setTargetSelected(catalogTargets(), "apple-photos", true);
    const sectionsAfter = pickerSections(chosen, {
      installed: new Set(["apple-photos"]),
      chosenBefore: new Set(["apple-photos"]),
    });
    expect(ids(sectionsAfter.chosen)).toEqual(["apple-photos"]);
    expect(ids(sectionsAfter.more)).not.toContain("apple-photos");
  });

  it("does not move a chip to another section when it is tapped", () => {
    const before = pickerSections(catalogTargets(), none);
    const tapped = setTargetSelected(catalogTargets(), "tiktok", true);
    const after = pickerSections(tapped, none);
    expect(ids(after.popular)).toEqual(ids(before.popular));
    expect(after.popular.find((target) => target.id === "tiktok")?.state).toBe("active");
  });

  it("keeps apps added by name in their own section", () => {
    const { targets } = addCustomTarget(catalogTargets(), "Tilo");
    const sections = pickerSections(targets, none);
    expect(sections.mine.map((target) => target.name)).toEqual(["Tilo"]);
    // Once chosen when the screen opens, it is listed with the chosen ones.
    const reopened = pickerSections(targets, {
      installed: new Set(),
      chosenBefore: new Set(["custom:tilo"]),
    });
    expect(ids(reopened.chosen)).toEqual(["custom:tilo"]);
    expect(reopened.mine).toEqual([]);
  });

  it("sorts the long tail alphabetically", () => {
    const { more } = pickerSections(catalogTargets(), none);
    const names = more.map((target) => target.name);
    expect(names).toEqual(
      [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })),
    );
  });
});

describe("iOS app picker search", () => {
  it("finds apps by alias and ignores accents and capitals", () => {
    expect(ids(searchTargets(catalogTargets(), "twitter").matches)).toEqual(["x"]);
    expect(ids(searchTargets(catalogTargets(), "MERCADO").matches)).toEqual([
      "mercado-libre",
    ]);
  });

  it("ranks names that start with the query first", () => {
    const { matches } = searchTargets(catalogTargets(), "tube");
    expect(ids(matches)[0]).toBe("youtube");
    const { matches: t } = searchTargets(catalogTargets(), "t");
    // Every "T…" app comes before apps that only contain a t.
    const firstContaining = t.findIndex((target) => !/^t/i.test(target.name));
    expect(t.slice(firstContaining).every((target) => !/^t/i.test(target.name))).toBe(true);
  });

  it("offers to add a typed app only when nothing listed is exactly it", () => {
    expect(searchTargets(catalogTargets(), "Tilo").addable).toBe("Tilo");
    expect(searchTargets(catalogTargets(), "  Mi   banco ").addable).toBe("Mi banco");
    expect(searchTargets(catalogTargets(), "instagram").addable).toBeNull();
    expect(searchTargets(catalogTargets(), "Atajos").addable).toBeNull();
    expect(searchTargets(catalogTargets(), "   ")).toEqual({ matches: [], addable: null });
  });
});

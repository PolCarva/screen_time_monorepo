import {
  IOS_APP_CATALOG,
  catalogUrl,
  normalizeAppName,
} from "./ios-app-catalog";

export type ShortcutTargetOrigin = "catalog" | "custom" | "detected";

/**
 * `available` is a catalog app the user has not chosen. It is mirrored to the
 * App Intent anyway so an automation that names it is adopted with its return
 * scheme instead of as an unknown app. `removed` keeps the intent silent when
 * the user drops an app in Still but the automation still fires.
 */
export type ShortcutTargetState = "active" | "available" | "removed";

export type ShortcutTarget = {
  id: string;
  /** Display name, and the value the Shortcuts action passes to the intent. */
  name: string;
  aliases: string[];
  /** Full URL (`instagram://`) used to return; null falls back to the return shortcut. */
  urlScheme: string | null;
  origin: ShortcutTargetOrigin;
  state: ShortcutTargetState;
};

export type NativeShortcutTarget = Omit<ShortcutTarget, "aliases"> & {
  matchKeys: string[];
};

export type AddCustomTargetError =
  | "empty"
  | "too_long"
  | "duplicate"
  | "reserved";

/**
 * Still itself and Apple's Shortcuts app can never be paused: "Current App"
 * reports Shortcuts when a shortcut is run by hand, and pausing either one
 * would lock the user out of the setup. Mirrored in StillShortcutIntent.swift.
 */
const RESERVED_APP_KEYS = new Set([
  "still",
  "stilldevelopment",
  "stillpreview",
  "shortcuts",
  "atajos",
]);

export function isReservedAppName(name: string): boolean {
  return RESERVED_APP_KEYS.has(normalizeAppName(name));
}

export const MAX_APP_NAME_LENGTH = 80;

function matchKeys(target: Pick<ShortcutTarget, "name" | "aliases">): string[] {
  return [
    ...new Set(
      [target.name, ...target.aliases].map(normalizeAppName).filter(Boolean),
    ),
  ];
}

function sharesKey(
  a: Pick<ShortcutTarget, "name" | "aliases">,
  b: Pick<ShortcutTarget, "name" | "aliases">,
) {
  const keys = new Set(matchKeys(a));
  return matchKeys(b).some((key) => keys.has(key));
}

export function catalogTargets(): ShortcutTarget[] {
  return IOS_APP_CATALOG.map((app) => ({
    id: app.id,
    name: app.name,
    aliases: [...app.aliases],
    urlScheme: catalogUrl(app),
    origin: "catalog",
    state: "available",
  }));
}

/**
 * Rebuilds the list from storage against the catalog shipped in this build:
 * catalog entries take their name, aliases and scheme from the build (so a
 * corrected scheme reaches existing users) and only keep their stored state.
 * A stored `urlScheme: null` on a catalog app means the scheme failed on this
 * device and must stay disabled.
 */
export function hydrateTargets(stored: readonly ShortcutTarget[]): ShortcutTarget[] {
  const storedById = new Map(stored.map((target) => [target.id, target]));
  const catalog = catalogTargets().map((target) => {
    const previous = storedById.get(target.id);
    if (!previous) return target;
    return {
      ...target,
      state: previous.state,
      urlScheme: previous.urlScheme === null ? null : target.urlScheme,
    };
  });
  const catalogIds = new Set(catalog.map((target) => target.id));
  const others: ShortcutTarget[] = [];
  for (const target of stored) {
    if (catalogIds.has(target.id) || target.origin === "catalog") continue;
    if (isReservedAppName(target.name)) continue;
    const twin = catalog.findIndex((entry) => sharesKey(entry, target));
    if (twin < 0) {
      others.push({ ...target, urlScheme: null });
      continue;
    }
    // An app first seen as unknown that a newer catalog now covers: the
    // catalog entry inherits the choice and gains its return scheme.
    if (target.state === "active" && catalog[twin]!.state === "available")
      catalog[twin] = { ...catalog[twin]!, state: "active" };
  }
  return [...catalog, ...others];
}

export function activeTargets(targets: readonly ShortcutTarget[]): ShortcutTarget[] {
  return targets.filter((target) => target.state === "active");
}

export function setTargetSelected(
  targets: readonly ShortcutTarget[],
  id: string,
  selected: boolean,
): ShortcutTarget[] {
  return targets.map((target) => {
    if (target.id !== id) return target;
    // Deselecting never deletes: the automation may still fire, and a
    // `removed` target is what tells the intent to stay silent.
    return { ...target, state: selected ? "active" : "removed" };
  });
}

export function addCustomTarget(
  targets: readonly ShortcutTarget[],
  rawName: string,
): { targets: ShortcutTarget[]; error?: AddCustomTargetError; id?: string } {
  const name = rawName.trim().replace(/\s+/g, " ");
  if (!name) return { targets: [...targets], error: "empty" };
  if (name.length > MAX_APP_NAME_LENGTH)
    return { targets: [...targets], error: "too_long" };
  if (isReservedAppName(name)) return { targets: [...targets], error: "reserved" };

  const candidate = { name, aliases: [] };
  const existing = targets.find((target) => sharesKey(target, candidate));
  if (existing) {
    if (existing.state === "active")
      return { targets: [...targets], error: "duplicate", id: existing.id };
    return {
      targets: setTargetSelected(targets, existing.id, true),
      id: existing.id,
    };
  }

  const id = `custom:${normalizeAppName(name)}`;
  return {
    targets: [
      ...targets,
      { id, name, aliases: [], urlScheme: null, origin: "custom", state: "active" },
    ],
    id,
  };
}

/**
 * Folds what the App Intent learned back into the JavaScript list: apps the
 * intent adopted from an automation (`detected`) appear in Still, and catalog
 * apps it activated are shown as chosen. JavaScript state wins for anything
 * the user explicitly removed.
 */
export function mergeNativeTargets(
  targets: readonly ShortcutTarget[],
  native: readonly NativeShortcutTarget[],
): ShortcutTarget[] {
  let merged = [...targets];
  for (const incoming of native) {
    const candidate = { name: incoming.name, aliases: [] as string[] };
    const index = merged.findIndex(
      (target) => target.id === incoming.id || sharesKey(target, candidate),
    );
    if (index >= 0) {
      const current = merged[index]!;
      if (current.state === "available" && incoming.state === "active")
        merged[index] = { ...current, state: "active" };
      continue;
    }
    if (incoming.origin !== "detected" || isReservedAppName(incoming.name))
      continue;
    merged = [
      ...merged,
      {
        id: incoming.id,
        name: incoming.name,
        aliases: [],
        urlScheme: null,
        origin: "detected",
        state: incoming.state === "removed" ? "removed" : "active",
      },
    ];
  }
  return merged;
}

/** A scheme that failed to open on this device falls back to the return shortcut. */
export function disableTargetScheme(
  targets: readonly ShortcutTarget[],
  id: string,
): ShortcutTarget[] {
  return targets.map((target) =>
    target.id === id ? { ...target, urlScheme: null } : target,
  );
}

/** The return scheme this build's catalog knows for a target, even if disabled. */
export function catalogSchemeFor(
  target: Pick<ShortcutTarget, "id" | "origin">,
): string | null {
  if (target.origin !== "catalog") return null;
  const app = IOS_APP_CATALOG.find((entry) => entry.id === target.id);
  return app ? catalogUrl(app) : null;
}

/**
 * Undoes `disableTargetScheme` once the scheme is seen working again, so one
 * transient failure does not cost the direct return forever.
 */
export function restoreTargetScheme(
  targets: readonly ShortcutTarget[],
  id: string,
): ShortcutTarget[] {
  return targets.map((target) =>
    target.id === id
      ? { ...target, urlScheme: catalogSchemeFor(target) ?? target.urlScheme }
      : target,
  );
}

export function toNativeTargets(
  targets: readonly ShortcutTarget[],
): NativeShortcutTarget[] {
  return targets.map(({ aliases, ...target }) => ({
    ...target,
    matchKeys: matchKeys({ name: target.name, aliases }),
  }));
}

/**
 * The user types this name in Shortcuts, so it only uses characters that exist
 * on the stock iOS keyboard. An earlier middle dot (U+00B7) could not be typed.
 * Must match `returnShortcutPrefix` in StillShortcutIntent.swift.
 */
export function returnShortcutName(appName: string): string {
  return `Still - ${appName}`;
}

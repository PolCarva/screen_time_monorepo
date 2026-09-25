import { IOS_APP_CATALOG, normalizeAppName } from "./ios-app-catalog";
import { type ShortcutTarget, isReservedAppName } from "./shortcut-targets";

/**
 * The apps most people want to pause, in order. They are shown first when
 * iOS cannot tell which catalog apps are on this iPhone.
 */
export const POPULAR_APP_IDS: readonly string[] = [
  "instagram",
  "tiktok",
  "youtube",
  "whatsapp",
  "x",
  "facebook",
  "reddit",
  "snapchat",
  "threads",
  "netflix",
];

export type PickerSections = {
  /** Apps already chosen when the screen opened. */
  chosen: ShortcutTarget[];
  /** Other apps added by name or adopted from an automation. */
  mine: ShortcutTarget[];
  /** Catalog apps found on this iPhone. */
  onDevice: ShortcutTarget[];
  /** The popular apps not already listed above. */
  popular: ShortcutTarget[];
  /** Everything else in the catalog, alphabetically. */
  more: ShortcutTarget[];
};

const byName = (a: ShortcutTarget, b: ShortcutTarget) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

const popularity = (target: ShortcutTarget) => {
  const index = POPULAR_APP_IDS.indexOf(target.id);
  return index < 0 ? POPULAR_APP_IDS.length : index;
};

const byPopularity = (a: ShortcutTarget, b: ShortcutTarget) =>
  popularity(a) - popularity(b) || byName(a, b);

/**
 * Groups the list so the apps a person is most likely to pick are on the
 * first screen: the ones already chosen, theirs, the ones on this iPhone, the
 * popular ones. The long tail stays behind "More apps". Each app appears once.
 */
export function pickerSections(
  targets: readonly ShortcutTarget[],
  {
    installed,
    chosenBefore,
  }: {
    installed: ReadonlySet<string>;
    /**
     * Apps already chosen when the screen opened. Sections are drawn from this
     * instead of the live choice, so a chip never jumps away when tapped.
     */
    chosenBefore: ReadonlySet<string>;
  },
): PickerSections {
  const listed = new Set<string>();
  const take = (list: ShortcutTarget[]) => {
    const fresh = list.filter((target) => !listed.has(target.id));
    for (const target of fresh) listed.add(target.id);
    return fresh;
  };
  const chosen = take(
    targets.filter((target) => chosenBefore.has(target.id)).sort(byPopularity),
  );
  const mine = take(
    targets.filter(
      (target) => target.origin !== "catalog" && target.state !== "available",
    ),
  );
  const catalog = targets.filter((target) => target.origin === "catalog");
  // Apple's apps are on every iPhone: finding them says nothing about this person.
  const system = new Set(
    IOS_APP_CATALOG.filter((app) => app.system).map((app) => app.id),
  );
  const onDevice = take(
    catalog
      .filter((target) => installed.has(target.id) && !system.has(target.id))
      .sort(byPopularity),
  );
  const popular = take(
    POPULAR_APP_IDS.flatMap((id) => catalog.filter((target) => target.id === id)),
  );
  const more = take([...catalog].sort(byName));
  return { chosen, mine, onDevice, popular, more };
}

export type PickerSearch = {
  matches: ShortcutTarget[];
  /** The typed name, offered as a new app when nothing listed is exactly it. */
  addable: string | null;
};

/**
 * Filters by name or alias ("twitter" finds X) with the same folding the App
 * Intent uses, so accents and capitals never hide an app.
 */
export function searchTargets(
  targets: readonly ShortcutTarget[],
  query: string,
): PickerSearch {
  const typed = query.trim().replace(/\s+/g, " ");
  const key = normalizeAppName(typed);
  if (!typed || !key) return { matches: [], addable: null };
  const keysOf = (target: ShortcutTarget) =>
    [target.name, ...target.aliases].map(normalizeAppName);
  const matches = targets
    .filter((target) => target.origin === "catalog" || target.state !== "available")
    .filter((target) => keysOf(target).some((candidate) => candidate.includes(key)))
    .sort((a, b) => {
      // Names that start with what was typed come before the ones containing it.
      const aStarts = keysOf(a).some((candidate) => candidate.startsWith(key));
      const bStarts = keysOf(b).some((candidate) => candidate.startsWith(key));
      return aStarts === bStarts ? byName(a, b) : aStarts ? -1 : 1;
    });
  const exact = matches.some((target) => keysOf(target).includes(key));
  return {
    matches,
    addable: exact || isReservedAppName(typed) ? null : typed,
  };
}

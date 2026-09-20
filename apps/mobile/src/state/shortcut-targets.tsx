import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, Platform } from "react-native";

import {
  type AddCustomTargetError,
  type ShortcutTarget,
  addCustomTarget,
  disableTargetScheme,
  hydrateTargets,
  mergeNativeTargets,
  setTargetSelected,
  toNativeTargets,
} from "@/lib/shortcut-targets";
import { getJson, setJson } from "@/lib/storage";
import {
  restrictionEngine,
  type ShortcutTargetHealth,
} from "@/native/restriction-engine";
import { useAppState } from "@/state/app-state";

const STORAGE_KEY = "iosShortcutTargets";

type ShortcutTargetsValue = {
  ready: boolean;
  targets: ShortcutTarget[];
  /** Keyed by target id. Missing until the automation fires for that app. */
  health: Record<string, ShortcutTargetHealth>;
  setSelected(id: string, selected: boolean): Promise<void>;
  addCustom(
    name: string,
  ): Promise<{ id?: string; error?: AddCustomTargetError }>;
  disableScheme(id: string): Promise<void>;
  refresh(): Promise<void>;
};

const ShortcutTargetsContext = createContext<ShortcutTargetsValue | null>(null);

export function ShortcutTargetsProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [targets, setTargets] = useState<ShortcutTarget[]>([]);
  const [health, setHealth] = useState<Record<string, ShortcutTargetHealth>>(
    {},
  );
  const current = useRef<ShortcutTarget[]>([]);
  const { onboarded } = useAppState();
  const wasOnboarded = useRef(onboarded);

  const persist = useCallback(async (next: ShortcutTarget[]) => {
    current.current = next;
    setTargets(next);
    await setJson(STORAGE_KEY, next);
    await restrictionEngine
      .setShortcutTargets(toNativeTargets(next))
      .catch(() => undefined);
  }, []);

  const refresh = useCallback(async () => {
    if (Platform.OS !== "ios") return;
    const native = await restrictionEngine
      .getShortcutTargetsHealth()
      .catch(() => [] as ShortcutTargetHealth[]);
    const base = current.current.length
      ? current.current
      : hydrateTargets(await getJson<ShortcutTarget[]>(STORAGE_KEY, []));
    const merged = mergeNativeTargets(base, native);
    setHealth(
      Object.fromEntries(
        merged.flatMap((target) => {
          const entry = native.find(
            (candidate) =>
              candidate.id === target.id || candidate.name === target.name,
          );
          return entry ? [[target.id, entry] as const] : [];
        }),
      ),
    );
    // Always mirror: the catalog shipped in this build may be newer than the
    // copy the App Intent is holding.
    await persist(merged);
  }, [persist]);

  useEffect(() => {
    if (Platform.OS !== "ios") {
      setReady(true);
      return;
    }
    void refresh().finally(() => setReady(true));
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  useEffect(() => {
    // "Delete local data" wipes storage and the App Group; drop the in-memory
    // selection with it instead of writing it straight back.
    if (wasOnboarded.current && !onboarded) {
      current.current = [];
      void refresh();
    }
    wasOnboarded.current = onboarded;
  }, [onboarded, refresh]);

  const setSelected = useCallback(
    async (id: string, selected: boolean) => {
      await persist(setTargetSelected(current.current, id, selected));
    },
    [persist],
  );

  const addCustom = useCallback(
    async (name: string) => {
      const result = addCustomTarget(current.current, name);
      if (!result.error) await persist(result.targets);
      return { id: result.id, error: result.error };
    },
    [persist],
  );

  const disableScheme = useCallback(
    async (id: string) => {
      await persist(disableTargetScheme(current.current, id));
    },
    [persist],
  );

  const value = useMemo(
    () => ({
      ready,
      targets,
      health,
      setSelected,
      addCustom,
      disableScheme,
      refresh,
    }),
    [addCustom, disableScheme, health, ready, refresh, setSelected, targets],
  );

  return (
    <ShortcutTargetsContext.Provider value={value}>
      {children}
    </ShortcutTargetsContext.Provider>
  );
}

export function useShortcutTargets() {
  const value = useContext(ShortcutTargetsContext);
  if (!value)
    throw new Error(
      "useShortcutTargets must be used inside ShortcutTargetsProvider",
    );
  return value;
}

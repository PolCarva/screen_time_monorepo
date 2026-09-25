import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";

import {
  BASELINE_DAYS,
  baselineFromStats,
  measuredMinutesByApp,
  parseBaseline,
  parseRecent,
  recentFromStats,
  recentIsFresh,
  shiftLocalDate,
  type RecentUsage,
  type UsageBaseline,
} from "@/lib/saved-time";
import { getJson, localStorage, setJson } from "@/lib/storage";
import { localDateString } from "@/lib/today-summary";
import { restrictionEngine, type SelectedAppState } from "@/native/restriction-engine";

/**
 * Where the time each skipped pause gives back comes from, kept on the phone
 * only (docs/real-savings-estimate-plan.md §3.2, D8): the week before Still,
 * the last days' usage and when the onboarding ended. Nothing here is sent.
 */
const KEYS = {
  baseline: "usageBaseline",
  recent: "recentUsage",
  onboardedAt: "onboardedAt",
} as const;

export type SavedTimeData = {
  baseline: UsageBaseline | null;
  recent: RecentUsage | null;
  onboardedAt: string | null;
  /** Android usage access is on right now. */
  usageAccess: boolean;
  /** Android: the chosen apps with today's counters; empty on iOS. */
  apps: SelectedAppState[];
};

const emptyData: SavedTimeData = {
  baseline: null,
  recent: null,
  onboardedAt: null,
  usageAccess: false,
  apps: [],
};

function readsUsage() {
  return Platform.OS === "android" && Boolean(restrictionEngine.getUsageStats);
}

async function loadOnboardedAt(): Promise<string | null> {
  const stored = await getJson<unknown>(KEYS.onboardedAt, null);
  return typeof stored === "string" && Number.isFinite(Date.parse(stored)) ? stored : null;
}

/** The onboarding ended: the day "before Still" is measured against (D7). */
export async function rememberOnboardedAt(now = new Date()) {
  if (await loadOnboardedAt()) return;
  await setJson(KEYS.onboardedAt, now.toISOString());
}

/**
 * The week before the onboarding day, read once: the first time usage can be
 * read after the onboarding, whatever it finds (D7). Never read again.
 */
export async function captureBaselineIfNeeded(
  now = new Date(),
): Promise<UsageBaseline | null> {
  const stored = parseBaseline(await getJson<unknown>(KEYS.baseline, null));
  if (stored || !readsUsage()) return stored;
  const onboardedAt = await loadOnboardedAt();
  if (!onboardedAt) return null;
  if (!(await restrictionEngine.hasUsageAccess?.().catch(() => false))) return null;
  const onboardedDay = localDateString(new Date(onboardedAt));
  const stats = await restrictionEngine.getUsageStats!(
    shiftLocalDate(onboardedDay, -BASELINE_DAYS),
    onboardedDay,
  );
  const baseline = baselineFromStats(stats, onboardedDay, now);
  await setJson(KEYS.baseline, baseline);
  return baseline;
}

/**
 * Reads what is stored, the last seven days again when stale (D11), and
 * hands the pause screen each chosen app's measured minutes.
 */
export async function refreshSavedTime(
  configMinutes: number,
  options: { force?: boolean } = {},
): Promise<SavedTimeData> {
  const now = new Date();
  const apps = (await restrictionEngine.getSelectedAppsState?.().catch(() => [])) ?? [];
  let baseline = parseBaseline(await getJson<unknown>(KEYS.baseline, null));
  let recent = parseRecent(await getJson<unknown>(KEYS.recent, null));
  const onboardedAt = await loadOnboardedAt();
  const usageAccess =
    readsUsage() && Boolean(await restrictionEngine.hasUsageAccess?.().catch(() => false));

  if (usageAccess) {
    baseline = (await captureBaselineIfNeeded(now).catch(() => null)) ?? baseline;
    const today = localDateString(now);
    const fresh = recentIsFresh(recent, now, today, (iso) => localDateString(new Date(iso)));
    if (options.force || !fresh) {
      try {
        const stats = await restrictionEngine.getUsageStats!(shiftLocalDate(today, -7), null);
        recent = recentFromStats(stats, now);
        await setJson(KEYS.recent, recent);
      } catch {
        // Keep what was read last; the next focus tries again.
      }
    }
  } else if (recent) {
    // Without access the last days are not a source (§2.2): don't keep them.
    recent = null;
    await localStorage.removeItem(KEYS.recent);
  }

  if (readsUsage()) {
    await restrictionEngine
      .syncSessionMinutes?.(
        measuredMinutesByApp(
          apps.map((app) => app.packageName),
          { baseline, recent, configMinutes },
        ),
      )
      .catch(() => undefined);
  }
  return { baseline, recent, onboardedAt, usageAccess, apps };
}

/** Today's source of truth for the time back: refreshed on focus and on return. */
export function useSavedTime(configMinutes: number) {
  const [data, setData] = useState<SavedTimeData>(emptyData);
  const minutesRef = useRef(configMinutes);
  minutesRef.current = configMinutes;
  const refresh = useCallback(async (options?: { force?: boolean }) => {
    const next = await refreshSavedTime(minutesRef.current, options).catch(() => null);
    if (next) setData(next);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);
  // A new config value changes what the pause screen falls back to.
  useEffect(() => {
    void refresh();
  }, [configMinutes, refresh]);

  return { ...data, refresh };
}

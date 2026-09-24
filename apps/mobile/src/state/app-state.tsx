import {
  DEFAULT_ACCESS_DURATION_SECONDS,
  canRequestReward,
  defaultRemoteConfig,
  nearestAccessDurationStep,
  resolveAccessDurationSeconds,
  remoteConfigSchema,
  rewardIntentSchema,
  unlockDurationSecondsSchema,
  userPreferencesSchema,
  type RemoteConfig,
  type UserPreferences,
} from "@screen-time/contracts";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import * as Application from "expo-application";
import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import { AppState, Platform } from "react-native";
import { registerDeviceResponseSchema } from "@screen-time/contracts";
import { z } from "zod";

import { adValueFromMicros } from "@/lib/ad-value";
import { apiFetch, apiRequest, ApiError } from "@/lib/api";
import { applyDevConfigOverrides } from "@/lib/dev-config";
import { PAUSE_ALLOWANCE_SECONDS } from "@/lib/intervention-flow";
import {
  intentsNeeded,
  mergeIntents,
  pruneExpiredIntents,
  removeIntent,
  type SignedRewardIntent,
} from "@/lib/reward-intent-buffer";
import { androidRewardedAdUnitId } from "@/native/reward-provider";
import { isPauseFeatureEnabled } from "@/lib/restriction-mode";
import { clearLocalStorage, getJson, setJson } from "@/lib/storage";
import { localDateString, type DayMetrics } from "@/lib/today-summary";
import {
  isDefinitiveUnlockRefusal,
  mergePendingUnlockEvents,
  splitReportableUnlocks,
  unlockReportBody,
} from "@/state/offline-policy";
import {
  restrictionEngine,
  type PendingUnlockEvent,
  type RestrictionHealth,
  type ShortcutUnlockSession,
} from "@/native/restriction-engine";

type LocalStats = {
  openAttempts: number;
  avoidedOpens: number;
  unlocks: number;
  /** The last seven local days, oldest first (see lib/today-summary). */
  history: DayMetrics[];
};
type SyncStatus = "syncing" | "online" | "offline";
type AppStateValue = {
  ready: boolean;
  /** The first sync finished (or failed and fell back to the cache). */
  hydrated: boolean;
  onboarded: boolean;
  deviceId: string | null;
  setOnboarded(value: boolean): Promise<void>;
  config: RemoteConfig;
  preferences: UserPreferences;
  stats: LocalStats;
  health: RestrictionHealth;
  refresh(): Promise<void>;
  /**
   * Opens the app after the ad just watched. The ad is the only way to pay:
   * there are no saved passes (docs/ads-only-pause-plan.md, D2).
   */
  unlockShortcut(
    contextId: string,
    options: {
      /** The window the user dragged the slider to, before it is resolved. */
      durationSeconds: number;
      /** The ad that paid for this visit, so the server charges it to that ad. */
      rewardIntentId: string;
    },
  ): Promise<ShortcutUnlockSession>;
  /**
   * Activates a short allowance after the timed pause. It spends nothing and
   * reports nothing: the pause is the friction of last resort, not a purchase.
   */
  unlockShortcutWithPause(contextId: string): Promise<ShortcutUnlockSession>;
  cancelShortcut(contextId: string): Promise<void>;
  /** Where the duration slider starts: the last window chosen on this device. */
  lastAccessDurationSeconds: number;
  rememberAccessDuration(seconds: number): Promise<void>;
  clearLocalData(): Promise<void>;
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
};

function withDevOverrides(config: RemoteConfig): RemoteConfig {
  return applyDevConfigOverrides(config, {
    dev: __DEV__,
    forceIosPauses: process.env.EXPO_PUBLIC_DEV_IOS_PAUSES,
    forceIosHomeOnCancel: process.env.EXPO_PUBLIC_DEV_IOS_HOME_ON_CANCEL,
  });
}

/** When the native day counters roll over: the next UTC midnight. */
function nextUtcMidnight(now = new Date()): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  ).toISOString();
}
function preferencesFromConfig(config: RemoteConfig): UserPreferences {
  const parsedDuration = unlockDurationSecondsSchema.safeParse(
    config.unlockDurationSeconds,
  );
  return {
    dailyPassLimit: Math.max(1, Math.min(config.maxRewardTokenBalance, 20)),
    unlockDurationSeconds: parsedDuration.success ? parsedDuration.data : 600,
    maxRewardedAdsPerUtcDay: config.maxRewardedAdsPerUtcDay,
    updatedAt: null,
  };
}
const defaultStats: LocalStats = {
  openAttempts: 0,
  avoidedOpens: 0,
  unlocks: 0,
  history: [],
};
const defaultHealth: RestrictionHealth = {
  authorization: "notDetermined",
  engineActive: false,
  selectedCount: 0,
};
const unlockResponseSchema = z.object({
  id: z.string().uuid(),
  endsAt: z.string(),
  source: z.literal("rewarded"),
});
const AppStateContext = createContext<AppStateValue | null>(null);

async function reportUnlock(event: PendingUnlockEvent, deviceId: string) {
  return apiFetch("/api/v1/unlock-sessions", unlockResponseSchema, {
    method: "POST",
    body: JSON.stringify(unlockReportBody(event, deviceId)),
    headers: { "idempotency-key": event.clientSessionId },
  });
}

/** Reports a visit now, or keeps it for the next sync unless the server refused it for good. */
async function reportOrQueueUnlock(event: PendingUnlockEvent, deviceId: string) {
  try {
    await reportUnlock(event, deviceId);
  } catch (error) {
    if (error instanceof ApiError && isDefinitiveUnlockRefusal(error.code)) return;
    const pending = await getJson<PendingUnlockEvent[]>("pendingUnlockReports", []);
    await setJson(
      "pendingUnlockReports",
      mergePendingUnlockEvents(pending, [event]),
    );
  }
}

/**
 * Still's own counters for every day the phone still remembers, so a day the
 * user never opened Still is recorded the next time they do. The server
 * computes the minutes returned (docs/real-impact-stats-plan.md, D8).
 */
function wellbeingDays(local: {
  openAttempts: number;
  avoidedOpens: number;
  unlocks: number;
  history: DayMetrics[];
}) {
  const today = localDateString(new Date());
  const byDate = new Map(
    local.history.map((day) => [
      day.date,
      {
        date: day.date,
        openAttempts: day.openAttempts,
        unlocks: day.unlocks,
        avoidedOpens: day.avoidedOpens,
      },
    ]),
  );
  byDate.set(today, {
    date: today,
    openAttempts: local.openAttempts,
    unlocks: local.unlocks,
    avoidedOpens: local.avoidedOpens,
  });
  return [...byDate.values()]
    .filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day.date))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);
}

const adClaimResponseSchema = z.object({
  intentId: z.string().uuid(),
  status: z.enum(["provisional", "verified"]),
});

// Claim failures that will never succeed on retry, so the queued result is
// dropped. The visit it paid for is still reported: the server charges it to
// the ad only if AdMob's callback already confirmed it.
const DEFINITIVE_CLAIM_FAILURES = new Set([
  "reward_intent_expired",
  "reward_intent_not_found",
]);

const PRESIGNED_INTENTS_KEY = "presignedRewardIntents";
/** Only seeds the slider. The window itself is always the one just chosen. */
const ACCESS_DURATION_KEY = "lastAccessDurationSeconds";

/**
 * Claims rewards the Android shield earned while React Native was not running.
 * The shield already granted the access window and queued the unlock report, so
 * claiming here is what records the earned ad on the server (the queued visit
 * then spends it, netting to zero; declining after the ad keeps nothing).
 * Idempotent by clientEventId; runs before unlock reports so the ad is claimed
 * before the visit is charged to it.
 * Returns the intents whose claim is still pending, so their visits wait.
 */
async function claimPendingAdResults(): Promise<Set<string>> {
  const unclaimed = new Set<string>();
  if (Platform.OS !== "android") return unclaimed;
  const results = (await restrictionEngine.getPendingAdResults?.()) ?? [];
  for (const result of results) {
    let drop = true;
    const adValue =
      result.adValueMicros === undefined
        ? undefined
        : adValueFromMicros(
            result.adValueMicros,
            result.adValueCurrency,
            result.adValuePrecision ?? 0,
          );
    try {
      await apiFetch(
        `/api/v1/rewards/intents/${result.intentId}/claim`,
        adClaimResponseSchema,
        {
          method: "POST",
          body: JSON.stringify({
            clientEventId: result.clientEventId,
            earnedAt: result.earnedAt,
            ...(adValue ? { adValue } : {}),
          }),
          headers: { "idempotency-key": result.clientEventId },
        },
      );
    } catch (error) {
      // Keep transient failures queued; drop only definitive ones.
      drop =
        error instanceof ApiError && DEFINITIVE_CLAIM_FAILURES.has(error.code);
    }
    if (!drop) {
      unclaimed.add(result.intentId);
      continue;
    }
    await restrictionEngine.acknowledgeAdResult?.(result.clientEventId).catch(
      () => undefined,
    );
    const buffer = await getJson<SignedRewardIntent[]>(
      PRESIGNED_INTENTS_KEY,
      [],
    );
    await setJson(PRESIGNED_INTENTS_KEY, removeIntent(buffer, result.intentId));
  }
  return unclaimed;
}

/**
 * Tops the shield's pre-signed intent buffer back up to capacity while React
 * Native is in the foreground, so the ad flow never reaches the network during
 * an intervention. Server caps (5 waiting, 24-hour expiry) are respected:
 * reaching them or being offline just stops early and reuses what remains.
 */
async function syncRewardIntentBuffer(deviceId: string): Promise<void> {
  if (Platform.OS !== "android") return;
  const stored = await getJson<SignedRewardIntent[]>(PRESIGNED_INTENTS_KEY, []);
  let valid = pruneExpiredIntents(stored, Date.now());
  const created: SignedRewardIntent[] = [];
  for (let index = 0; index < intentsNeeded(valid.length); index += 1) {
    try {
      const intent = await apiFetch("/api/v1/rewards/intents", rewardIntentSchema, {
        method: "POST",
        body: JSON.stringify({ deviceId, provider: "admob" }),
        headers: { "idempotency-key": Crypto.randomUUID() },
      });
      created.push({
        id: intent.id,
        customData: intent.customData,
        userId: "anonymous",
        expiresAt: intent.expiresAt,
      });
    } catch {
      break;
    }
  }
  valid = mergeIntents(valid, created);
  await setJson(PRESIGNED_INTENTS_KEY, valid);
  await restrictionEngine.setPresignedRewardIntents?.(valid).catch(
    () => undefined,
  );
}

export function AppStateProvider({ children }: PropsWithChildren) {
  const [onboarded, setOnboardedState] = useState(false);
  const [ready, setReady] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [config, setConfig] = useState(defaultRemoteConfig);
  const [preferences, setPreferences] = useState<UserPreferences>(() =>
    preferencesFromConfig(defaultRemoteConfig),
  );
  const [hydrated, setHydrated] = useState(false);
  const [stats, setStats] = useState(defaultStats);
  const [health, setHealth] = useState(defaultHealth);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("syncing");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [lastAccessDurationSeconds, setLastAccessDurationSeconds] = useState(
    DEFAULT_ACCESS_DURATION_SECONDS,
  );

  useEffect(() => {
    void getJson("onboarded", false)
      .then(setOnboardedState)
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    void getJson(ACCESS_DURATION_KEY, DEFAULT_ACCESS_DURATION_SECONDS).then(
      (stored) =>
        setLastAccessDurationSeconds(
          nearestAccessDurationStep(
            typeof stored === "number" ? stored : DEFAULT_ACCESS_DURATION_SECONDS,
          ),
        ),
    );
  }, []);
  const rememberAccessDuration = useCallback(async (seconds: number) => {
    const step = nearestAccessDurationStep(seconds);
    setLastAccessDurationSeconds(step);
    await setJson(ACCESS_DURATION_KEY, step);
  }, []);
  const setOnboarded = useCallback(async (value: boolean) => {
    setOnboardedState(value);
    await setJson("onboarded", value);
  }, []);
  const refresh = useCallback(async () => {
    setSyncStatus("syncing");
    let registrationSynced = false;
    let configSynced = false;
    let preferencesSynced = false;
    setHealth(await restrictionEngine.getHealth().catch(() => defaultHealth));
    let pendingUnlocksAwaitingReport: PendingUnlockEvent[] = [];
    let installationId = await getJson<string | null>("installationId", null);
    if (!installationId) {
      installationId = Crypto.randomUUID();
      await setJson("installationId", installationId);
    }
    let activeDeviceId: string | null = null;
    try {
      const registered = await apiFetch(
        "/api/v1/devices/register",
        registerDeviceResponseSchema,
        {
          method: "POST",
          body: JSON.stringify({
            installationId,
            platform: Platform.OS === "ios" ? "ios" : "android",
            appVersion: Application.nativeApplicationVersion ?? "0.1.0",
            osVersion: String(Device.osVersion ?? "unknown"),
            locale: Intl.DateTimeFormat().resolvedOptions().locale,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        },
      );
      activeDeviceId = registered.deviceId;
      registrationSynced = true;
      setDeviceId(registered.deviceId);
      await setJson("deviceId", registered.deviceId);
    } catch {
      activeDeviceId = await getJson<string | null>("deviceId", null);
      setDeviceId(activeDeviceId);
    }
    let activeConfig = await getJson("remoteConfig", defaultRemoteConfig);
    try {
      const nextConfig = await apiFetch("/api/v1/config", remoteConfigSchema);
      configSynced = true;
      activeConfig = nextConfig;
      setConfig(withDevOverrides(nextConfig));
      // The cache keeps the server's answer; overrides are applied on read.
      await setJson("remoteConfig", nextConfig);
    } catch {
      setConfig(withDevOverrides(activeConfig));
    }
    let activePreferences = await getJson(
      "userPreferences",
      preferencesFromConfig(activeConfig),
    );
    try {
      const nextPreferences = await apiFetch(
        "/api/v1/preferences",
        userPreferencesSchema,
        { cache: "no-store" },
      );
      preferencesSynced = true;
      activePreferences = nextPreferences;
      setPreferences(nextPreferences);
      await setJson("userPreferences", nextPreferences);
    } catch {
      setPreferences(activePreferences);
    }

    // Android A2: claim rewards the shield earned before reporting the unlocks
    // it performed, so each visit is charged to an ad the server has. Then
    // refill the shield's pre-signed intent buffer for next time.
    let unclaimedIntentIds = new Set<string>();
    if (Platform.OS === "android" && activeDeviceId) {
      unclaimedIntentIds = await claimPendingAdResults().catch(
        () => new Set<string>(),
      );
      if (
        isPauseFeatureEnabled("android", activeConfig) &&
        activeConfig.rewardProvider !== "disabled"
      ) {
        await syncRewardIntentBuffer(activeDeviceId).catch(() => undefined);
      }
    }

    const nativePending = await restrictionEngine
      .getPendingUnlockEvents()
      .catch(() => []);
    const localPending = await getJson<PendingUnlockEvent[]>(
      "pendingUnlockReports",
      [],
    );
    const pending = mergePendingUnlockEvents(nativePending, localPending);
    // A visit paid by an ad the shield showed waits until that ad is claimed.
    const { now: reportable, later: waitingForClaim } = splitReportableUnlocks(
      pending,
      unclaimedIntentIds,
    );
    const remaining: PendingUnlockEvent[] = [...waitingForClaim];
    if (activeDeviceId) {
      for (const event of reportable) {
        try {
          await reportUnlock(event, activeDeviceId);
          await restrictionEngine
            .acknowledgeUnlockEvent(event.clientSessionId)
            .catch(() => undefined);
        } catch (error) {
          // Includes the emergency and saved-pass visits older builds queued:
          // the server no longer accepts them and they have nothing to spend.
          if (error instanceof ApiError && isDefinitiveUnlockRefusal(error.code)) {
            await restrictionEngine
              .acknowledgeUnlockEvent(event.clientSessionId)
              .catch(() => undefined);
            continue;
          }
          remaining.push(event);
        }
      }
    } else {
      remaining.push(...reportable);
    }
    pendingUnlocksAwaitingReport = remaining;
    await setJson("pendingUnlockReports", remaining);

    try {
      const local = await restrictionEngine.getLocalWellbeing();
      const nextStats: LocalStats = {
        openAttempts: local.openAttempts,
        avoidedOpens: local.avoidedOpens,
        unlocks: local.unlocks,
        history: Array.isArray(local.history) ? local.history : [],
      };
      setStats(nextStats);
      await setJson("localStats", nextStats);
      if (activeDeviceId) {
        // Every day the phone remembers, in its own calendar, so a day without
        // opening Still still counts once it is opened again.
        await apiRequest("/api/v1/wellbeing/daily", {
          method: "POST",
          body: JSON.stringify({
            deviceId: activeDeviceId,
            platform: Platform.OS === "ios" ? "ios" : "android",
            days: wellbeingDays(nextStats),
          }),
        }).catch(() => undefined);
      }
    } catch {
      // A cache written by an older build has no history: start it empty.
      const cached = await getJson<Partial<LocalStats>>("localStats", defaultStats);
      setStats({
        ...defaultStats,
        ...cached,
        history: Array.isArray(cached.history) ? cached.history : [],
      });
    }
    setHydrated(true);
    const fullySynced =
      registrationSynced &&
      configSynced &&
      preferencesSynced &&
      pendingUnlocksAwaitingReport.length === 0;
    setSyncStatus(fullySynced ? "online" : "offline");
    if (fullySynced) {
      const syncedAt = new Date().toISOString();
      setLastSyncedAt(syncedAt);
      await setJson("lastSyncedAt", syncedAt);
    } else {
      setLastSyncedAt(await getJson<string | null>("lastSyncedAt", null));
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);
  useEffect(() => {
    if (!hydrated) return;
    const restrictionsEnabled = isPauseFeatureEnabled(Platform.OS, config);
    void (async () => {
      if (Platform.OS === "ios") {
        await restrictionEngine.enableShortcutMode();
      }
      // The native bridges keep their signature, but there is no saved pass
      // for the shield to offer (docs/ads-only-pause-plan.md, D9).
      await restrictionEngine.syncWallet(
        0,
        nextUtcMidnight(),
        config.estimatedMinutesPerAvoidedOpen,
        preferences.unlockDurationSeconds,
        restrictionsEnabled,
      );
      if (Platform.OS === "android") {
        // Let the native shield preload a rewarded ad using the same
        // eligibility the pause uses (getInterventionOptions): no limit on ads,
        // only the switches.
        await restrictionEngine.syncRewardConfig?.(
          restrictionsEnabled && canRequestReward(config),
          androidRewardedAdUnitId,
          config.rewardProvider,
        );
      }
      setHealth(await restrictionEngine.getHealth());
    })().catch(() => undefined);
  }, [
    config.androidRestrictionEnabled,
    config.estimatedMinutesPerAvoidedOpen,
    config.iosRestrictionEnabled,
    config.rewardProvider,
    hydrated,
    preferences.unlockDurationSeconds,
  ]);
  const clearLocalData = useCallback(async () => {
    const cleanup = await Promise.allSettled([
      restrictionEngine.resetLocalData(),
      clearLocalStorage(),
    ]);
    setOnboardedState(false);
    setDeviceId(null);
    setConfig(defaultRemoteConfig);
    setPreferences(preferencesFromConfig(defaultRemoteConfig));
    setHydrated(false);
    setStats(defaultStats);
    setHealth(defaultHealth);
    setSyncStatus("offline");
    setLastSyncedAt(null);
    setLastAccessDurationSeconds(DEFAULT_ACCESS_DURATION_SECONDS);
    if (cleanup.some((result) => result.status === "rejected"))
      throw new Error("local_cleanup_incomplete");
  }, []);
  const unlockShortcut = useCallback(
    async (
      contextId: string,
      options: { durationSeconds: number; rewardIntentId: string },
    ) => {
      if (Platform.OS !== "ios") throw new Error("shortcut_unlock_ios_only");
      const durationSeconds = resolveAccessDurationSeconds(
        options.durationSeconds,
      );
      if (!deviceId) throw new Error("backend_required");
      // Only the ad just watched pays for a visit; there is nothing saved.
      if (!options.rewardIntentId) throw new Error("no_unlocks");

      const event: PendingUnlockEvent = {
        clientSessionId: Crypto.randomUUID(),
        source: "rewarded",
        durationSeconds,
        startedAt: new Date().toISOString(),
        rewardIntentId: options.rewardIntentId,
      };
      const session = await restrictionEngine.completeShortcutIntervention(
        contextId,
        durationSeconds,
      );
      await reportOrQueueUnlock(event, deviceId);
      return session;
    },
    [deviceId],
  );
  const unlockShortcutWithPause = useCallback(async (contextId: string) => {
    if (Platform.OS !== "ios") throw new Error("shortcut_unlock_ios_only");
    return restrictionEngine.completeShortcutIntervention(
      contextId,
      PAUSE_ALLOWANCE_SECONDS,
    );
  }, []);
  const cancelShortcut = useCallback(async (contextId: string) => {
    await restrictionEngine.cancelShortcutIntervention(contextId);
  }, []);
  const value = useMemo(
    () => ({
      ready,
      hydrated,
      onboarded,
      deviceId,
      setOnboarded,
      config,
      preferences,
      stats,
      health,
      refresh,
      unlockShortcut,
      unlockShortcutWithPause,
      cancelShortcut,
      lastAccessDurationSeconds,
      rememberAccessDuration,
      clearLocalData,
      syncStatus,
      lastSyncedAt,
    }),
    [
      ready,
      hydrated,
      onboarded,
      deviceId,
      setOnboarded,
      config,
      preferences,
      stats,
      health,
      refresh,
      unlockShortcut,
      unlockShortcutWithPause,
      cancelShortcut,
      lastAccessDurationSeconds,
      rememberAccessDuration,
      clearLocalData,
      syncStatus,
      lastSyncedAt,
    ],
  );
  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const value = useContext(AppStateContext);
  if (!value)
    throw new Error("useAppState must be used inside AppStateProvider");
  return value;
}

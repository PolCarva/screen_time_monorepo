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
  type UpdateUserPreferencesRequest,
  type UserPreferences,
  type Wallet,
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
import {
  dayOutcome,
  localDateString,
  minutesReturned,
  type DayMetrics,
} from "@/lib/today-summary";
import {
  addProvisionalReward,
  mergePendingUnlockEvents,
  projectPendingUnlocks,
  spendLocalWallet,
} from "@/state/offline-policy";
import {
  restrictionEngine,
  type PendingUnlockEvent,
  type RestrictionHealth,
  type ShortcutUnlockSession,
  type UnlockSession,
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
  walletHydrated: boolean;
  onboarded: boolean;
  deviceId: string | null;
  setOnboarded(value: boolean): Promise<void>;
  config: RemoteConfig;
  preferences: UserPreferences;
  wallet: Wallet;
  stats: LocalStats;
  health: RestrictionHealth;
  refresh(): Promise<void>;
  savePreferences(
    preferences: UpdateUserPreferencesRequest,
  ): Promise<UserPreferences>;
  spendEmergency(): Promise<boolean>;
  addProvisionalToken(): Promise<void>;
  unlockCurrent(options: {
    freshReward?: boolean;
    /** The window the user dragged the slider to, before it is resolved. */
    durationSeconds: number;
  }): Promise<UnlockSession>;
  unlockShortcut(
    contextId: string,
    options: { freshReward?: boolean; durationSeconds: number },
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

const defaultWallet: Wallet = {
  rewardedBalance: 0,
  rewardedPassesRemainingToday: 0,
  emergencyRemaining: 0,
  unresolvedRewardClaims: 0,
  rewardAdsRemainingToday: 0,
  resetAt: "1970-01-01T00:00:00.000Z",
};
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
  source: z.enum(["rewarded", "emergency"]),
});
const AppStateContext = createContext<AppStateValue | null>(null);

async function reportUnlock(event: PendingUnlockEvent, deviceId: string) {
  return apiFetch("/api/v1/unlock-sessions", unlockResponseSchema, {
    method: "POST",
    body: JSON.stringify({
      ...event,
      deviceId,
      appCategory: "other",
    }),
    headers: { "idempotency-key": event.clientSessionId },
  });
}

const adClaimResponseSchema = z.object({
  intentId: z.string().uuid(),
  status: z.enum(["provisional", "verified"]),
});

// Claim failures that will never succeed on retry, so the queued result is dropped.
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
 * claiming here is what actually turns the earned ad into a server-side pass
 * (which the queued rewarded unlock then spends, netting to zero — or, when the
 * user declined after the ad, stays as a saved pass, D4). Idempotent by
 * clientEventId; runs before unlock reports so the pass exists before it is spent.
 */
async function claimPendingAdResults(): Promise<void> {
  if (Platform.OS !== "android") return;
  const results = (await restrictionEngine.getPendingAdResults?.()) ?? [];
  for (const result of results) {
    let drop = true;
    try {
      await apiFetch(
        `/api/v1/rewards/intents/${result.intentId}/claim`,
        adClaimResponseSchema,
        {
          method: "POST",
          body: JSON.stringify({
            clientEventId: result.clientEventId,
            earnedAt: result.earnedAt,
          }),
          headers: { "idempotency-key": result.clientEventId },
        },
      );
    } catch (error) {
      // Keep transient failures queued; drop only definitive ones.
      drop =
        error instanceof ApiError && DEFINITIVE_CLAIM_FAILURES.has(error.code);
    }
    if (!drop) continue;
    await restrictionEngine.acknowledgeAdResult?.(result.clientEventId).catch(
      () => undefined,
    );
    const buffer = await getJson<SignedRewardIntent[]>(
      PRESIGNED_INTENTS_KEY,
      [],
    );
    await setJson(PRESIGNED_INTENTS_KEY, removeIntent(buffer, result.intentId));
  }
}

/**
 * Tops the shield's pre-signed intent buffer back up to capacity while React
 * Native is in the foreground, so the ad flow never reaches the network during
 * an intervention. Server caps (3 active, 15-min expiry) are respected: a full
 * wallet or offline state just stops early and reuses what remains.
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
  const [wallet, setWallet] = useState(defaultWallet);
  const [walletHydrated, setWalletHydrated] = useState(false);
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
    let walletSynced = false;
    setHealth(await restrictionEngine.getHealth().catch(() => defaultHealth));
    let pendingUnlocksAwaitingReport: PendingUnlockEvent[] = [];
    const reportedUnlocksThisRefresh: PendingUnlockEvent[] = [];
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
    // it performed, so a rewarded pass exists before the unlock spends it. Then
    // refill the shield's pre-signed intent buffer for next time.
    if (Platform.OS === "android" && activeDeviceId) {
      await claimPendingAdResults().catch(() => undefined);
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
    const remaining: PendingUnlockEvent[] = [];
    if (activeDeviceId) {
      for (const event of pending) {
        try {
          await reportUnlock(event, activeDeviceId);
          reportedUnlocksThisRefresh.push(event);
          await restrictionEngine
            .acknowledgeUnlockEvent(event.clientSessionId)
            .catch(() => undefined);
        } catch {
          remaining.push(event);
        }
      }
    } else {
      remaining.push(...pending);
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
        // The counters belong to the phone's own day, so the record does too.
        const today = localDateString(new Date());
        await apiRequest("/api/v1/wellbeing/daily", {
          method: "POST",
          body: JSON.stringify({
            deviceId: activeDeviceId,
            date: today,
            platform: Platform.OS === "ios" ? "ios" : "android",
            // Screen time is no longer read on either platform (D4).
            controlledScreenTimeSeconds: 0,
            openAttempts: local.openAttempts,
            unlocks: local.unlocks,
            avoidedOpens: local.avoidedOpens,
            estimatedMinutesAvoided: minutesReturned(
              dayOutcome(local),
              activeConfig.estimatedMinutesPerAvoidedOpen,
            ),
            rewardedAdsCompleted: 0,
          }),
          headers: {
            "idempotency-key": `wellbeing:${activeDeviceId}:${today}`,
          },
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
    try {
      const { walletSchema } = await import("@screen-time/contracts");
      const serverWallet = await apiFetch(
        `/api/v1/wallet?refresh=${Date.now()}`,
        walletSchema,
        { cache: "no-store" },
      );
      walletSynced = true;
      const projectedWallet = projectPendingUnlocks(
        serverWallet,
        pendingUnlocksAwaitingReport,
      );
      setWallet(projectedWallet);
      await setJson("wallet", projectedWallet);
    } catch {
      const cachedWallet = await getJson("wallet", defaultWallet);
      const projectedWallet = projectPendingUnlocks(
        cachedWallet,
        mergePendingUnlockEvents(
          pendingUnlocksAwaitingReport,
          reportedUnlocksThisRefresh,
        ),
      );
      setWallet(projectedWallet);
      await setJson("wallet", projectedWallet);
    }
    setWalletHydrated(true);
    const fullySynced =
      registrationSynced &&
      configSynced &&
      preferencesSynced &&
      walletSynced &&
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
  const savePreferences = useCallback(
    async (input: UpdateUserPreferencesRequest) => {
      const saved = await apiFetch(
        "/api/v1/preferences",
        userPreferencesSchema,
        {
          method: "PUT",
          body: JSON.stringify(input),
        },
      );
      setPreferences(saved);
      await setJson("userPreferences", saved);
      await refresh();
      return saved;
    },
    [refresh],
  );
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
    if (!walletHydrated) return;
    const restrictionsEnabled = isPauseFeatureEnabled(Platform.OS, config);
    void (async () => {
      if (Platform.OS === "ios") {
        await restrictionEngine.enableShortcutMode();
      }
      await restrictionEngine.syncWallet(
        Math.min(wallet.rewardedBalance, wallet.rewardedPassesRemainingToday),
        wallet.emergencyRemaining,
        wallet.resetAt,
        config.estimatedMinutesPerAvoidedOpen,
        preferences.unlockDurationSeconds,
        restrictionsEnabled,
      );
      if (Platform.OS === "android") {
        // Let the native shield preload a rewarded ad using the same
        // eligibility React Native already computes.
        await restrictionEngine.syncRewardConfig?.(
          restrictionsEnabled && canRequestReward(wallet, config),
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
    preferences.unlockDurationSeconds,
    wallet.emergencyRemaining,
    wallet.resetAt,
    wallet.rewardedBalance,
    wallet.rewardedPassesRemainingToday,
    walletHydrated,
  ]);
  const spendEmergency = useCallback(async () => {
    if (wallet.emergencyRemaining <= 0) return false;
    const next = spendLocalWallet(wallet, "emergency");
    setWallet(next);
    await setJson("wallet", next);
    return true;
  }, [wallet]);
  const addProvisionalToken = useCallback(async () => {
    const next = addProvisionalReward(wallet, config.maxRewardTokenBalance);
    setWallet(next);
    await setJson("wallet", next);
  }, [config.maxRewardTokenBalance, wallet]);
  const clearLocalData = useCallback(async () => {
    const cleanup = await Promise.allSettled([
      restrictionEngine.resetLocalData(),
      clearLocalStorage(),
    ]);
    setOnboardedState(false);
    setDeviceId(null);
    setConfig(defaultRemoteConfig);
    setPreferences(preferencesFromConfig(defaultRemoteConfig));
    setWallet(defaultWallet);
    setWalletHydrated(false);
    setStats(defaultStats);
    setHealth(defaultHealth);
    setSyncStatus("offline");
    setLastSyncedAt(null);
    setLastAccessDurationSeconds(DEFAULT_ACCESS_DURATION_SECONDS);
    if (cleanup.some((result) => result.status === "rejected"))
      throw new Error("local_cleanup_incomplete");
  }, []);
  const unlockCurrent = useCallback(async (options: {
    freshReward?: boolean;
    durationSeconds: number;
  }) => {
    const durationSeconds = resolveAccessDurationSeconds(
      options.durationSeconds,
    );
    const restrictionsEnabled =
      Platform.OS === "ios"
        ? config.iosRestrictionEnabled
        : config.androidRestrictionEnabled;
    if (!restrictionsEnabled) throw new Error("restrictions_disabled");
    const source = options.freshReward
      ? "rewarded"
      : wallet.rewardedBalance > 0 && wallet.rewardedPassesRemainingToday > 0
        ? "rewarded"
        : "emergency";
    if (source === "rewarded" && !deviceId) throw new Error("backend_required");
    if (
      !options.freshReward &&
      source === "emergency" &&
      wallet.emergencyRemaining <= 0
    )
      throw new Error("no_unlocks");

    const event: PendingUnlockEvent = {
      clientSessionId: Crypto.randomUUID(),
      source,
      durationSeconds,
      startedAt: new Date().toISOString(),
    };

    // Start the native unlock first. If Screen Time cannot create the session,
    // the reward must remain untouched so the user can retry safely.
    const nativeSession = await restrictionEngine.startUnlock(
      {
        opaqueId: "current",
        platform: Platform.OS === "ios" ? "ios" : "android",
      },
      durationSeconds,
    );

    if (source === "rewarded") {
      const spendableWallet = options.freshReward
        ? addProvisionalReward(wallet, config.maxRewardTokenBalance)
        : wallet;
      const next = spendLocalWallet(spendableWallet, "rewarded");
      setWallet(next);
      await setJson("wallet", next);
      try {
        await reportUnlock(event, deviceId!);
      } catch {
        const pending = await getJson<PendingUnlockEvent[]>(
          "pendingUnlockReports",
          [],
        );
        await setJson(
          "pendingUnlockReports",
          mergePendingUnlockEvents(pending, [event]),
        );
      }
    } else {
      const next = spendLocalWallet(wallet, "emergency");
      setWallet(next);
      await setJson("wallet", next);
      if (deviceId) {
        try {
          await reportUnlock(event, deviceId);
        } catch {
          const pending = await getJson<PendingUnlockEvent[]>(
            "pendingUnlockReports",
            [],
          );
          await setJson("pendingUnlockReports", [...pending, event]);
        }
      } else {
        const pending = await getJson<PendingUnlockEvent[]>(
          "pendingUnlockReports",
          [],
        );
        await setJson("pendingUnlockReports", [...pending, event]);
      }
    }

    return nativeSession;
  }, [
    config.androidRestrictionEnabled,
    config.iosRestrictionEnabled,
    config.maxRewardTokenBalance,
    deviceId,
    wallet,
  ]);
  const unlockShortcut = useCallback(
    async (
      contextId: string,
      options: { freshReward?: boolean; durationSeconds: number },
    ) => {
      if (Platform.OS !== "ios") throw new Error("shortcut_unlock_ios_only");
      const durationSeconds = resolveAccessDurationSeconds(
        options.durationSeconds,
      );
      const source = options.freshReward
        ? "rewarded"
        : wallet.rewardedBalance > 0 && wallet.rewardedPassesRemainingToday > 0
          ? "rewarded"
          : "emergency";
      if (source === "rewarded" && !deviceId)
        throw new Error("backend_required");
      if (
        !options.freshReward &&
        source === "emergency" &&
        wallet.emergencyRemaining <= 0
      )
        throw new Error("no_unlocks");

      const event: PendingUnlockEvent = {
        clientSessionId: Crypto.randomUUID(),
        source,
        durationSeconds,
        startedAt: new Date().toISOString(),
      };
      const session = await restrictionEngine.completeShortcutIntervention(
        contextId,
        durationSeconds,
      );
      const spendableWallet = options.freshReward
        ? addProvisionalReward(wallet, config.maxRewardTokenBalance)
        : wallet;
      const next = spendLocalWallet(spendableWallet, source);
      setWallet(next);
      await setJson("wallet", next);

      if (deviceId) {
        try {
          await reportUnlock(event, deviceId);
        } catch {
          const pending = await getJson<PendingUnlockEvent[]>(
            "pendingUnlockReports",
            [],
          );
          await setJson(
            "pendingUnlockReports",
            mergePendingUnlockEvents(pending, [event]),
          );
        }
      } else {
        const pending = await getJson<PendingUnlockEvent[]>(
          "pendingUnlockReports",
          [],
        );
        await setJson(
          "pendingUnlockReports",
          mergePendingUnlockEvents(pending, [event]),
        );
      }
      return session;
    },
    [config.maxRewardTokenBalance, deviceId, wallet],
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
      walletHydrated,
      onboarded,
      deviceId,
      setOnboarded,
      config,
      preferences,
      wallet,
      stats,
      health,
      refresh,
      savePreferences,
      spendEmergency,
      addProvisionalToken,
      unlockCurrent,
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
      walletHydrated,
      onboarded,
      deviceId,
      setOnboarded,
      config,
      preferences,
      wallet,
      stats,
      health,
      refresh,
      savePreferences,
      spendEmergency,
      addProvisionalToken,
      unlockCurrent,
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

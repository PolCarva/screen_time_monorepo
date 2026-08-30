import {
  defaultRemoteConfig,
  remoteConfigSchema,
  type RemoteConfig,
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

import { apiFetch, apiRequest } from "@/lib/api";
import { clearLocalStorage, getJson, setJson } from "@/lib/storage";
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
  type UnlockSession,
} from "@/native/restriction-engine";

type LocalStats = {
  screenTimeMinutes: number;
  openAttempts: number;
  avoidedOpens: number;
  unlocks: number;
  weeklyScreenTimeMinutes: number[];
};
type SyncStatus = "syncing" | "online" | "offline";
type AppStateValue = {
  ready: boolean;
  walletHydrated: boolean;
  onboarded: boolean;
  deviceId: string | null;
  setOnboarded(value: boolean): Promise<void>;
  config: RemoteConfig;
  wallet: Wallet;
  stats: LocalStats;
  health: RestrictionHealth;
  refresh(): Promise<void>;
  spendEmergency(): Promise<boolean>;
  addProvisionalToken(): Promise<void>;
  unlockCurrent(): Promise<UnlockSession>;
  clearLocalData(): Promise<void>;
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
};

const defaultWallet: Wallet = {
  rewardedBalance: 0,
  emergencyRemaining: 3,
  unresolvedRewardClaims: 0,
  rewardAdsRemainingToday: 10,
  resetAt: new Date(Date.now() + 86_400_000).toISOString(),
};
const defaultStats: LocalStats = {
  screenTimeMinutes: 0,
  openAttempts: 0,
  avoidedOpens: 0,
  unlocks: 0,
  weeklyScreenTimeMinutes: [],
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

export function AppStateProvider({ children }: PropsWithChildren) {
  const [onboarded, setOnboardedState] = useState(false);
  const [ready, setReady] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [config, setConfig] = useState(defaultRemoteConfig);
  const [wallet, setWallet] = useState(defaultWallet);
  const [walletHydrated, setWalletHydrated] = useState(false);
  const [stats, setStats] = useState(defaultStats);
  const [health, setHealth] = useState(defaultHealth);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("syncing");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  useEffect(() => {
    void getJson("onboarded", false)
      .then(setOnboardedState)
      .finally(() => setReady(true));
  }, []);
  const setOnboarded = useCallback(async (value: boolean) => {
    setOnboardedState(value);
    await setJson("onboarded", value);
  }, []);
  const refresh = useCallback(async () => {
    setSyncStatus("syncing");
    let registrationSynced = false;
    let configSynced = false;
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
      setConfig(nextConfig);
      await setJson("remoteConfig", nextConfig);
    } catch {
      setConfig(activeConfig);
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
      const nextStats = {
        screenTimeMinutes: Math.round(local.controlledScreenTimeSeconds / 60),
        openAttempts: local.openAttempts,
        avoidedOpens: local.avoidedOpens,
        unlocks: local.unlocks,
        weeklyScreenTimeMinutes: local.weeklyScreenTimeSeconds.map((seconds) =>
          Math.round(seconds / 60),
        ),
      };
      setStats(nextStats);
      await setJson("localStats", nextStats);
      if (activeDeviceId) {
        const today = new Date().toISOString().slice(0, 10);
        await apiRequest("/api/v1/wellbeing/daily", {
          method: "POST",
          body: JSON.stringify({
            deviceId: activeDeviceId,
            date: today,
            platform: Platform.OS === "ios" ? "ios" : "android",
            controlledScreenTimeSeconds: Math.round(
              local.controlledScreenTimeSeconds,
            ),
            openAttempts: local.openAttempts,
            unlocks: local.unlocks,
            avoidedOpens: local.avoidedOpens,
            estimatedMinutesAvoided:
              local.avoidedOpens * activeConfig.estimatedMinutesPerAvoidedOpen,
            rewardedAdsCompleted: 0,
          }),
          headers: {
            "idempotency-key": `wellbeing:${activeDeviceId}:${today}`,
          },
        }).catch(() => undefined);
      }
    } catch {
      setStats(await getJson("localStats", defaultStats));
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
    const restrictionsEnabled =
      Platform.OS === "ios"
        ? config.iosRestrictionEnabled
        : config.androidRestrictionEnabled;
    void (async () => {
      await restrictionEngine.syncWallet(
        wallet.rewardedBalance,
        wallet.emergencyRemaining,
        wallet.resetAt,
        config.estimatedMinutesPerAvoidedOpen,
        config.unlockDurationSeconds,
        restrictionsEnabled,
      );
      setHealth(await restrictionEngine.getHealth());
    })().catch(() => undefined);
  }, [
    config.androidRestrictionEnabled,
    config.estimatedMinutesPerAvoidedOpen,
    config.iosRestrictionEnabled,
    config.unlockDurationSeconds,
    wallet.emergencyRemaining,
    wallet.resetAt,
    wallet.rewardedBalance,
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
    setWallet(defaultWallet);
    setWalletHydrated(false);
    setStats(defaultStats);
    setHealth(defaultHealth);
    setSyncStatus("offline");
    setLastSyncedAt(null);
    if (cleanup.some((result) => result.status === "rejected"))
      throw new Error("local_cleanup_incomplete");
  }, []);
  const unlockCurrent = useCallback(async () => {
    const restrictionsEnabled =
      Platform.OS === "ios"
        ? config.iosRestrictionEnabled
        : config.androidRestrictionEnabled;
    if (!restrictionsEnabled) throw new Error("restrictions_disabled");
    const source = wallet.rewardedBalance > 0 ? "rewarded" : "emergency";
    if (source === "rewarded" && !deviceId) throw new Error("backend_required");
    if (source === "emergency" && wallet.emergencyRemaining <= 0)
      throw new Error("no_unlocks");

    const event: PendingUnlockEvent = {
      clientSessionId: Crypto.randomUUID(),
      source,
      durationSeconds: config.unlockDurationSeconds,
      startedAt: new Date().toISOString(),
    };

    // Start the native unlock first. If Screen Time cannot create the session,
    // the reward must remain untouched so the user can retry safely.
    const nativeSession = await restrictionEngine.startUnlock(
      {
        opaqueId: "current",
        platform: Platform.OS === "ios" ? "ios" : "android",
      },
      config.unlockDurationSeconds,
    );

    if (source === "rewarded") {
      const next = spendLocalWallet(wallet, "rewarded");
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
    config.unlockDurationSeconds,
    deviceId,
    wallet,
  ]);
  const value = useMemo(
    () => ({
      ready,
      walletHydrated,
      onboarded,
      deviceId,
      setOnboarded,
      config,
      wallet,
      stats,
      health,
      refresh,
      spendEmergency,
      addProvisionalToken,
      unlockCurrent,
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
      wallet,
      stats,
      health,
      refresh,
      spendEmergency,
      addProvisionalToken,
      unlockCurrent,
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

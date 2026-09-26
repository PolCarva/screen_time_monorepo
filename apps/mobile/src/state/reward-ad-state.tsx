import { canRequestReward, rewardIntentSchema } from "@screen-time/contracts";
import * as Crypto from "expo-crypto";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { AppState, Platform } from "react-native";

import { apiFetch } from "@/lib/api";
import { isPauseFeatureEnabled } from "@/lib/restriction-mode";
import { getJson, setJson } from "@/lib/storage";
import {
  createIntentStash,
  RewardAdPool,
  type RewardAdPoolStatus,
  type StoredIntents,
} from "@/native/reward-ad-pool";
import {
  admobRewardProvider,
  onConsentWithdrawn,
  type LoadedRewardAd,
  type RewardIntent,
  type RewardResult,
} from "@/native/reward-provider";
import { useAppState } from "@/state/app-state";

type RewardAdStateValue = {
  status: RewardAdPoolStatus;
  showPrepared(): Promise<{
    intent: RewardIntent;
    result: RewardResult;
  } | null>;
  /** Asks the pool for an ad now; returns its status right after. */
  retry(): RewardAdPoolStatus;
};

/** Where the intents the pool loads ads with are kept between launches (P6). */
const INTENT_STASH_KEY = "rewardIntentStash";

const RewardAdStateContext = createContext<RewardAdStateValue | null>(null);

/**
 * Keeps two ads ready for the iOS Shortcuts pause (docs/ad-preload-plan.md):
 * the pool loads them while the app is in the foreground, each with an intent
 * saved on the phone, so a cold start does not wait for the server.
 */
export function RewardAdProvider({ children }: PropsWithChildren) {
  const { onboarded, deviceId, config } = useAppState();
  const [status, setStatus] = useState<RewardAdPoolStatus>("idle");
  const pool = useRef<RewardAdPool<LoadedRewardAd> | null>(null);
  // Only the iOS Shortcuts pause shows its ad from React Native; the Android
  // shield loads its own natively. No limit on ads (docs/ads-only-pause-plan.md).
  const eligible =
    Platform.OS === "ios" &&
    onboarded &&
    Boolean(deviceId) &&
    isPauseFeatureEnabled(Platform.OS, config) &&
    canRequestReward(config);

  useEffect(() => {
    if (!eligible || !deviceId) {
      setStatus("idle");
      return;
    }
    const current = new RewardAdPool<LoadedRewardAd>({
      prepare: () => admobRewardProvider.prepare(),
      load: (intent) => admobRewardProvider.load(intent),
      intents: createIntentStash({
        deviceId,
        read: () => getJson<StoredIntents | null>(INTENT_STASH_KEY, null),
        write: (value) => setJson(INTENT_STASH_KEY, value),
        create: async () => {
          const intent = await apiFetch(
            "/api/v1/rewards/intents",
            rewardIntentSchema,
            {
              method: "POST",
              body: JSON.stringify({ deviceId, provider: "admob" }),
              headers: { "idempotency-key": Crypto.randomUUID() },
            },
          );
          return { ...intent, userId: "anonymous" };
        },
      }),
    });
    pool.current = current;
    const unsubscribe = current.subscribe(setStatus);
    // Suspended in the background (P8): "inactive" is still on screen.
    current.setActive(AppState.currentState !== "background");
    const appState = AppState.addEventListener("change", (state) =>
      current.setActive(state !== "background"),
    );
    // Consent withdrawn by the refresh (P7): drop the ads and start over,
    // which asks for consent again before loading anything.
    const stopOnWithdrawal = onConsentWithdrawn(() => {
      current.stop();
      current.start();
    });
    current.start();
    setStatus(current.status);
    return () => {
      stopOnWithdrawal();
      appState.remove();
      unsubscribe();
      current.stop();
      if (pool.current === current) pool.current = null;
    };
  }, [deviceId, eligible]);

  const showPrepared = useCallback(async () => {
    const current = pool.current;
    const loaded = current ? await current.take() : null;
    if (!current || !loaded) return null;
    const result = await admobRewardProvider.show(loaded.ad);
    if (result.status !== "earned") await current.giveBack(loaded.intent);
    return { intent: loaded.intent, result };
  }, []);
  const retry = useCallback(
    () => pool.current?.trigger() ?? ("idle" as const),
    [],
  );
  const value = useMemo(
    () => ({ status, showPrepared, retry }),
    [retry, showPrepared, status],
  );
  return (
    <RewardAdStateContext.Provider value={value}>
      {children}
    </RewardAdStateContext.Provider>
  );
}

export function useRewardAd() {
  const value = useContext(RewardAdStateContext);
  if (!value)
    throw new Error("useRewardAd must be used inside RewardAdProvider");
  return value;
}

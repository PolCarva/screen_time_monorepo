import { rewardIntentSchema } from "@screen-time/contracts";
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

import { apiFetch } from "@/lib/api";
import {
  admobRewardProvider,
  type RewardIntent,
  type RewardResult,
} from "@/native/reward-provider";
import { useAppState } from "@/state/app-state";

type PreparationStatus = "idle" | "preparing" | "ready" | "unavailable";
type RewardAdStateValue = {
  status: PreparationStatus;
  showPrepared(): Promise<{
    intent: RewardIntent;
    result: RewardResult;
  } | null>;
  retry(): void;
};

const RewardAdStateContext = createContext<RewardAdStateValue | null>(null);

export function RewardAdProvider({ children }: PropsWithChildren) {
  const { onboarded, deviceId, wallet, config } = useAppState();
  const [status, setStatus] = useState<PreparationStatus>("idle");
  const [retryKey, setRetryKey] = useState(0);
  const prepared = useRef<RewardIntent | null>(null);
  const generation = useRef(0);
  const eligible =
    onboarded &&
    Boolean(deviceId) &&
    wallet.rewardedBalance < config.maxRewardTokenBalance &&
    wallet.unresolvedRewardClaims < 3 &&
    wallet.rewardAdsRemainingToday > 0;

  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    if (!eligible || !deviceId) {
      prepared.current = null;
      setStatus("idle");
      generation.current += 1;
      return;
    }
    if (prepared.current) {
      setStatus("ready");
      return;
    }

    const currentGeneration = ++generation.current;
    setStatus("preparing");
    void (async () => {
      try {
        const intent = await apiFetch(
          "/api/v1/rewards/intents",
          rewardIntentSchema,
          {
            method: "POST",
            body: JSON.stringify({ deviceId, provider: "admob" }),
            headers: { "idempotency-key": Crypto.randomUUID() },
          },
        );
        const nativeIntent = { ...intent, userId: "anonymous" };
        const result = await admobRewardProvider.preload(nativeIntent);
        if (generation.current !== currentGeneration) return;
        if (result !== "ready") throw new Error("unavailable");
        prepared.current = nativeIntent;
        setStatus("ready");
        const refreshIn = Math.max(
          0,
          new Date(nativeIntent.expiresAt).getTime() - Date.now() - 60_000,
        );
        refreshTimer = setTimeout(() => {
          if (prepared.current?.id !== nativeIntent.id) return;
          prepared.current = null;
          setRetryKey((value) => value + 1);
        }, refreshIn);
      } catch {
        if (generation.current === currentGeneration) {
          setStatus("unavailable");
          refreshTimer = setTimeout(
            () => setRetryKey((value) => value + 1),
            30_000,
          );
        }
      }
    })();
    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [deviceId, eligible, retryKey]);

  const showPrepared = useCallback(async () => {
    const intent = prepared.current;
    if (!intent) return null;
    prepared.current = null;
    setStatus("idle");
    const result = await admobRewardProvider.show(intent);
    return { intent, result };
  }, []);
  const retry = useCallback(() => {
    if (!prepared.current) setRetryKey((value) => value + 1);
  }, []);
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

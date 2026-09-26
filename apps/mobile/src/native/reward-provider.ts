import mobileAds, {
  AdsConsent,
  AdEventType,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from "react-native-google-mobile-ads";
import type { AdValue } from "@screen-time/contracts";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

// Relative, so the provider stays loadable in Vitest without the app alias.
import { adValueFromPaidEvent } from "../lib/ad-value";

export type RewardIntent = {
  id: string;
  customData: string;
  userId: string;
  expiresAt: string;
};
export type RewardResult =
  | {
      status: "earned";
      clientEventId: string;
      /** What the SDK said this impression paid, when it said anything. */
      adValue?: AdValue;
    }
  | { status: "dismissed" | "unavailable" | "failed"; code?: string };
/** A rewarded ad loaded with its intent's server-side verification. */
export type LoadedRewardAd = {
  intent: RewardIntent;
  ad: ReturnType<typeof createAd>;
};
export interface RewardProvider {
  prepare(): Promise<"ready" | "unavailable">;
  /** Loads one ad for `intent`; null when none arrived in time. */
  load(intent: RewardIntent): Promise<LoadedRewardAd | null>;
  show(loaded: LoadedRewardAd): Promise<RewardResult>;
}

const configuredAdUnit = Platform.select({
  ios: process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS,
  android: process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID,
});

/**
 * The Android rewarded unit the native shield preloads. In development it must
 * match the test unit the JS provider uses, so a debug build shows the same ads.
 */
export const androidRewardedAdUnitId = __DEV__
  ? TestIds.REWARDED
  : (process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID ?? "");
let initialization: Promise<"ready" | "unavailable"> | null = null;
/**
 * How long a load may take before it counts as failed. The pause waits far
 * less (AD_GATE_WAIT_MS); this only frees a load that never calls back, so a
 * slow one still fills the pool for the next pause (docs/ad-preload-plan.md, P5).
 */
export const REWARD_AD_LOAD_TIMEOUT_MS = 30_000;

const consentWithdrawnListeners = new Set<() => void>();
/** Called when a consent refresh says ads may no longer be requested (P7). */
export function onConsentWithdrawn(listener: () => void): () => void {
  consentWithdrawnListeners.add(listener);
  return () => {
    consentWithdrawnListeners.delete(listener);
  };
}

function createAd(intent?: RewardIntent) {
  return RewardedAd.createForAdRequest(
    __DEV__ ? TestIds.REWARDED : configuredAdUnit!,
    {
      requestNonPersonalizedAdsOnly: true,
      ...(intent
        ? {
            serverSideVerificationOptions: {
              customData: intent.customData,
              userId: intent.userId,
            },
          }
        : {}),
    },
  );
}

function loadAd(intent: RewardIntent): Promise<LoadedRewardAd | null> {
  const ad = createAd(intent);
  return new Promise((resolve) => {
    let settled = false;
    const cleanups: Array<() => void> = [];
    const timeout = setTimeout(() => finish(false), REWARD_AD_LOAD_TIMEOUT_MS);
    const finish = (loaded: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      cleanups.splice(0).forEach((unsubscribe) => unsubscribe());
      resolve(loaded ? { intent, ad } : null);
    };
    cleanups.push(
      ad.addAdEventListener(RewardedAdEventType.LOADED, () => finish(true)),
    );
    cleanups.push(
      ad.addAdEventListener(AdEventType.ERROR, () => finish(false)),
    );
    ad.load();
  });
}

/**
 * Whether ads may be requested now. Consent from an earlier session is enough
 * to start at once, and the refresh runs alongside (P7, Google's recommended
 * pattern); without it, the refresh (and its form, if one is required) comes
 * first, as before.
 */
async function consentAllowsAds(): Promise<boolean> {
  const options = { tagForUnderAgeOfConsent: false };
  const previous = await AdsConsent.getConsentInfo().catch(() => null);
  if (previous?.canRequestAds) {
    void AdsConsent.gatherConsent(options)
      .then((consent) => {
        if (consent.canRequestAds) return;
        initialization = null;
        consentWithdrawnListeners.forEach((listener) => listener());
      })
      .catch(() => undefined);
    return true;
  }
  const consent = await AdsConsent.gatherConsent(options);
  return consent.canRequestAds;
}

export const admobRewardProvider: RewardProvider = {
  async prepare() {
    if (!configuredAdUnit && !__DEV__) return "unavailable";
    initialization ??= (async () => {
      try {
        if (!__DEV__ && !(await consentAllowsAds())) return "unavailable";
        if (__DEV__) {
          await mobileAds().setRequestConfiguration({
            testDeviceIdentifiers: ["EMULATOR"],
          });
        }
        await mobileAds().initialize();
        return "ready";
      } catch {
        return "unavailable";
      }
    })();
    const result = await initialization;
    if (result !== "ready") initialization = null;
    return result;
  },
  async load(intent) {
    if ((await this.prepare()) !== "ready") return null;
    return loadAd(intent);
  },
  async show({ ad }) {
    return new Promise((resolve) => {
      let earned = false;
      let closed = false;
      let settled = false;
      let adValue: AdValue | undefined;
      let closeGraceTimer: ReturnType<typeof setTimeout> | undefined;
      const cleanups: Array<() => void> = [];
      const cleanup = () => {
        if (closeGraceTimer) clearTimeout(closeGraceTimer);
        cleanups.splice(0).forEach((unsubscribe) => unsubscribe());
      };
      const finish = (result: RewardResult) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(result);
      };
      const finishEarned = () =>
        finish({
          status: "earned",
          clientEventId: Crypto.randomUUID(),
          ...(adValue ? { adValue } : {}),
        });
      // Fired on the impression, before the reward: what this ad paid
      // (impression-level ad revenue, turned on in the AdMob account).
      cleanups.push(
        ad.addAdEventListener(AdEventType.PAID, (event) => {
          adValue = adValueFromPaidEvent(event) ?? adValue;
        }),
      );
      cleanups.push(
        ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
          earned = true;
          if (closed) finishEarned();
        }),
      );
      cleanups.push(
        ad.addAdEventListener(AdEventType.CLOSED, () => {
          closed = true;
          if (earned) {
            finishEarned();
            return;
          }

          // On iOS the rewarded callback can arrive just after CLOSED. Keep a
          // short grace period so a completed ad is not misclassified as a
          // dismissal, while still granting nothing when no reward event comes.
          closeGraceTimer = setTimeout(
            () => finish({ status: "dismissed" }),
            1_500,
          );
        }),
      );
      cleanups.push(
        ad.addAdEventListener(AdEventType.ERROR, (error) =>
          finish({ status: "failed", code: error.message }),
        ),
      );
      ad.show().catch((error: unknown) =>
        finish({
          status: "failed",
          code: error instanceof Error ? error.message : "show_failed",
        }),
      );
    });
  },
};

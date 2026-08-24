import mobileAds, {
  AdsConsent,
  AdEventType,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from "react-native-google-mobile-ads";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

export type RewardIntent = {
  id: string;
  customData: string;
  userId: string;
  expiresAt: string;
};
export type RewardResult =
  | { status: "earned"; clientEventId: string }
  | { status: "dismissed" | "unavailable" | "failed"; code?: string };
export interface RewardProvider {
  prepare(): Promise<"ready" | "unavailable">;
  preload(intent: RewardIntent): Promise<"ready" | "unavailable">;
  show(intent: RewardIntent): Promise<RewardResult>;
}

const configuredAdUnit = Platform.select({
  ios: process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS,
  android: process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID,
});
let initialization: Promise<"ready" | "unavailable"> | null = null;
let loadedAd: { intentId: string; ad: ReturnType<typeof createAd> } | null =
  null;
let loadingAd: {
  intentId: string;
  promise: Promise<"ready" | "unavailable">;
} | null = null;
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

function loadAd(intent: RewardIntent): Promise<"ready" | "unavailable"> {
  if (loadedAd?.intentId === intent.id) return Promise.resolve("ready");
  if (loadingAd?.intentId === intent.id) return loadingAd.promise;

  const ad = createAd(intent);
  const promise = new Promise<"ready" | "unavailable">((resolve) => {
    const unsubscribeLoaded = ad.addAdEventListener(
      RewardedAdEventType.LOADED,
      () => {
        unsubscribeLoaded();
        unsubscribeError();
        loadedAd = { intentId: intent.id, ad };
        resolve("ready");
      },
    );
    const unsubscribeError = ad.addAdEventListener(AdEventType.ERROR, () => {
      unsubscribeLoaded();
      unsubscribeError();
      resolve("unavailable");
    });
    ad.load();
  }).finally(() => {
    if (loadingAd?.intentId === intent.id) loadingAd = null;
  });
  loadingAd = { intentId: intent.id, promise };
  return promise;
}

export const admobRewardProvider: RewardProvider = {
  async prepare() {
    if (!configuredAdUnit && !__DEV__) return "unavailable";
    initialization ??= (async () => {
      try {
        if (!__DEV__) {
          const consent = await AdsConsent.gatherConsent({
            tagForUnderAgeOfConsent: false,
          });
          if (!consent.canRequestAds) return "unavailable";
        }
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
    return initialization;
  },
  async preload(intent) {
    if ((await this.prepare()) !== "ready") return "unavailable";
    return loadAd(intent);
  },
  async show(intent) {
    if (
      loadedAd?.intentId !== intent.id &&
      (await this.preload(intent)) !== "ready"
    ) {
      return { status: "unavailable" };
    }
    const ad = loadedAd!.ad;
    loadedAd = null;
    return new Promise((resolve) => {
      let earned = false;
      let settled = false;
      const cleanups: Array<() => void> = [];
      const cleanup = () =>
        cleanups.splice(0).forEach((unsubscribe) => unsubscribe());
      const finish = (result: RewardResult) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(result);
      };
      cleanups.push(
        ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
          earned = true;
        }),
      );
      cleanups.push(
        ad.addAdEventListener(AdEventType.CLOSED, () => {
          finish(
            earned
              ? { status: "earned", clientEventId: Crypto.randomUUID() }
              : { status: "dismissed" },
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

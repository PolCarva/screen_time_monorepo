import mobileAds, { AdsConsent, AdEventType, RewardedAd, RewardedAdEventType, TestIds } from "react-native-google-mobile-ads";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

export type RewardIntent = { id: string; customData: string; userId: string };
export type RewardResult = { status: "earned"; clientEventId: string } | { status: "dismissed" | "unavailable" | "failed"; code?: string };
export interface RewardProvider { prepare(): Promise<"ready" | "unavailable">; show(intent: RewardIntent): Promise<RewardResult>; }

const configuredAdUnit = Platform.select({
  ios: process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS,
  android: process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID,
});
let initialization: Promise<"ready" | "unavailable"> | null = null;
function createAd(intent?: RewardIntent) {
  return RewardedAd.createForAdRequest(__DEV__ ? TestIds.REWARDED : configuredAdUnit!, {
    requestNonPersonalizedAdsOnly: true,
    ...(intent ? { serverSideVerificationOptions: { customData: intent.customData, userId: intent.userId } } : {}),
  });
}

export const admobRewardProvider: RewardProvider = {
  async prepare() {
    if (!configuredAdUnit && !__DEV__) return "unavailable";
    initialization ??= (async () => {
      try {
        const consent = await AdsConsent.gatherConsent({ tagForUnderAgeOfConsent: false });
        if (!consent.canRequestAds) return "unavailable";
        await mobileAds().initialize();
        return "ready";
      } catch {
        return "unavailable";
      }
    })();
    return initialization;
  },
  async show(intent) {
    const ad = createAd(intent);
    return new Promise((resolve) => {
      let earned = false;
      const cleanups: Array<() => void> = [];
      const cleanup = () => cleanups.splice(0).forEach((unsubscribe) => unsubscribe());
      cleanups.push(ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => { earned = true; }));
      cleanups.push(ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        ad.show().catch((error: unknown) => { cleanup(); resolve({ status: "failed", code: error instanceof Error ? error.message : "show_failed" }); });
      }));
      cleanups.push(ad.addAdEventListener(AdEventType.CLOSED, () => {
        cleanup();
        resolve(earned ? { status: "earned", clientEventId: Crypto.randomUUID() } : { status: "dismissed" });
      }));
      cleanups.push(ad.addAdEventListener(AdEventType.ERROR, (error) => { cleanup(); resolve({ status: "failed", code: error.message }); }));
      ad.load();
    });
  },
};

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createForAdRequest: vi.fn(),
  gatherConsent: vi.fn(),
  initialize: vi.fn(),
  mobileAds: vi.fn(),
  setRequestConfiguration: vi.fn(),
}));

vi.mock("react-native-google-mobile-ads", () => ({
  default: mocks.mobileAds.mockImplementation(() => ({
    initialize: mocks.initialize,
    setRequestConfiguration: mocks.setRequestConfiguration,
  })),
  AdsConsent: { gatherConsent: mocks.gatherConsent },
  AdEventType: { CLOSED: "closed", ERROR: "error" },
  RewardedAd: { createForAdRequest: mocks.createForAdRequest },
  RewardedAdEventType: { EARNED_REWARD: "earned", LOADED: "loaded" },
  TestIds: { REWARDED: "test-rewarded" },
}));
vi.mock("expo-crypto", () => ({ randomUUID: () => "event-id" }));
vi.mock("react-native", () => ({
  Platform: { select: (options: { android?: string }) => options.android },
}));

describe("AdMob reward provider initialization", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal("__DEV__", false);
    process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID =
      "ca-app-pub-1234567890123456/1234567890";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID;
  });

  it("retries initialization after a transient consent failure", async () => {
    mocks.gatherConsent
      .mockRejectedValueOnce(new Error("temporary consent failure"))
      .mockResolvedValueOnce({ canRequestAds: true });
    mocks.initialize.mockResolvedValue(undefined);
    const { admobRewardProvider } = await import("./reward-provider");

    await expect(admobRewardProvider.prepare()).resolves.toBe("unavailable");
    await expect(admobRewardProvider.prepare()).resolves.toBe("ready");

    expect(mocks.gatherConsent).toHaveBeenCalledTimes(2);
    expect(mocks.initialize).toHaveBeenCalledOnce();
  });
});

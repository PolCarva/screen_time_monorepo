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
    mocks.gatherConsent.mockResolvedValue({ canRequestAds: true });
    mocks.initialize.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("stops waiting when AdMob never completes the load", async () => {
    vi.useFakeTimers();
    const listeners = new Map<string, () => void>();
    const unsubscribers: Array<ReturnType<typeof vi.fn>> = [];
    mocks.createForAdRequest.mockReturnValue({
      addAdEventListener: vi.fn((event: string, listener: () => void) => {
        listeners.set(event, listener);
        const unsubscribe = vi.fn(() => listeners.delete(event));
        unsubscribers.push(unsubscribe);
        return unsubscribe;
      }),
      load: vi.fn(),
    });
    const {
      admobRewardProvider,
      REWARD_AD_LOAD_TIMEOUT_MS,
    } = await import("./reward-provider");
    await expect(admobRewardProvider.prepare()).resolves.toBe("ready");

    const preload = admobRewardProvider.preload({
      id: "reward-intent",
      customData: "signed-data",
      userId: "anonymous",
      expiresAt: "2026-09-07T00:00:00.000Z",
    });
    await vi.advanceTimersByTimeAsync(REWARD_AD_LOAD_TIMEOUT_MS);

    await expect(preload).resolves.toBe("unavailable");
    expect(unsubscribers).toHaveLength(2);
    expect(
      unsubscribers.every(
        (unsubscribe) => unsubscribe.mock.calls.length === 1,
      ),
    ).toBe(true);
  });

  it("keeps a loaded ad ready and cancels the deadline", async () => {
    vi.useFakeTimers();
    const listeners = new Map<string, () => void>();
    mocks.createForAdRequest.mockReturnValue({
      addAdEventListener: vi.fn((event: string, listener: () => void) => {
        listeners.set(event, listener);
        return vi.fn(() => listeners.delete(event));
      }),
      load: vi.fn(),
    });
    const { admobRewardProvider } = await import("./reward-provider");
    await expect(admobRewardProvider.prepare()).resolves.toBe("ready");

    const preload = admobRewardProvider.preload({
      id: "reward-intent",
      customData: "signed-data",
      userId: "anonymous",
      expiresAt: "2026-09-07T00:00:00.000Z",
    });
    await vi.advanceTimersByTimeAsync(0);
    listeners.get("loaded")?.();

    await expect(preload).resolves.toBe("ready");
    expect(vi.getTimerCount()).toBe(0);
  });
});

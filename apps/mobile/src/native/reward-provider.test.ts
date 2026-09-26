import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createForAdRequest: vi.fn(),
  gatherConsent: vi.fn(),
  getConsentInfo: vi.fn(),
  initialize: vi.fn(),
  mobileAds: vi.fn(),
  setRequestConfiguration: vi.fn(),
}));

vi.mock("react-native-google-mobile-ads", () => ({
  default: mocks.mobileAds.mockImplementation(() => ({
    initialize: mocks.initialize,
    setRequestConfiguration: mocks.setRequestConfiguration,
  })),
  AdsConsent: {
    gatherConsent: mocks.gatherConsent,
    getConsentInfo: mocks.getConsentInfo,
  },
  AdEventType: { CLOSED: "closed", ERROR: "error", PAID: "paid" },
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
    mocks.getConsentInfo.mockResolvedValue({ canRequestAds: false });
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

  it("starts at once on consent from an earlier session and refreshes it alongside", async () => {
    mocks.getConsentInfo.mockResolvedValue({ canRequestAds: true });
    let refresh!: (value: { canRequestAds: boolean }) => void;
    mocks.gatherConsent.mockReturnValue(
      new Promise((resolve) => {
        refresh = resolve;
      }),
    );
    const { admobRewardProvider, onConsentWithdrawn } = await import(
      "./reward-provider"
    );
    const withdrawn = vi.fn();
    onConsentWithdrawn(withdrawn);

    // Ready although the refresh has not answered yet (P7).
    await expect(admobRewardProvider.prepare()).resolves.toBe("ready");
    expect(mocks.gatherConsent).toHaveBeenCalledOnce();
    expect(withdrawn).not.toHaveBeenCalled();

    refresh({ canRequestAds: false });
    await vi.waitFor(() => expect(withdrawn).toHaveBeenCalledOnce());
    // The next preparation asks for consent again.
    mocks.getConsentInfo.mockResolvedValue({ canRequestAds: false });
    mocks.gatherConsent.mockResolvedValue({ canRequestAds: false });
    await expect(admobRewardProvider.prepare()).resolves.toBe("unavailable");
  });

  it("waits for consent when no earlier session allowed ads", async () => {
    mocks.gatherConsent.mockResolvedValue({ canRequestAds: false });
    const { admobRewardProvider } = await import("./reward-provider");

    await expect(admobRewardProvider.prepare()).resolves.toBe("unavailable");
    expect(mocks.initialize).not.toHaveBeenCalled();
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

    const load = admobRewardProvider.load({
      id: "reward-intent",
      customData: "signed-data",
      userId: "anonymous",
      expiresAt: "2026-09-07T00:00:00.000Z",
    });
    await vi.advanceTimersByTimeAsync(REWARD_AD_LOAD_TIMEOUT_MS);

    await expect(load).resolves.toBeNull();
    expect(unsubscribers).toHaveLength(2);
    expect(
      unsubscribers.every(
        (unsubscribe) => unsubscribe.mock.calls.length === 1,
      ),
    ).toBe(true);
  });

  it("hands back the loaded ad and cancels the deadline", async () => {
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

    const intent = {
      id: "reward-intent",
      customData: "signed-data",
      userId: "anonymous",
      expiresAt: "2026-09-07T00:00:00.000Z",
    };
    const load = admobRewardProvider.load(intent);
    await vi.advanceTimersByTimeAsync(0);
    listeners.get("loaded")?.();

    await expect(load).resolves.toMatchObject({ intent });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("returns what the impression paid with an earned reward", async () => {
    const listeners = new Map<string, (payload?: unknown) => void>();
    mocks.createForAdRequest.mockReturnValue({
      addAdEventListener: vi.fn(
        (event: string, listener: (payload?: unknown) => void) => {
          listeners.set(event, listener);
          return vi.fn(() => listeners.delete(event));
        },
      ),
      load: vi.fn(() => queueMicrotask(() => listeners.get("loaded")?.())),
      show: vi.fn(async () => {
        listeners.get("paid")?.({ value: 0.0042, currency: "USD", precision: 3 });
        listeners.get("earned")?.();
        listeners.get("closed")?.();
      }),
    });
    const { admobRewardProvider } = await import("./reward-provider");
    const intent = {
      id: "reward-intent",
      customData: "signed-data",
      userId: "anonymous",
      expiresAt: "2026-09-07T00:00:00.000Z",
    };

    const loaded = await admobRewardProvider.load(intent);
    expect(loaded).not.toBeNull();
    await expect(admobRewardProvider.show(loaded!)).resolves.toEqual({
      status: "earned",
      clientEventId: "event-id",
      adValue: { valueMicros: 4_200, currency: "USD", precision: "precise" },
    });
  });
});

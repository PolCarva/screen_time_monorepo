import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  capture: vi.fn(),
  getJson: vi.fn(),
  optIn: vi.fn(),
  optOut: vi.fn(),
  posthog: vi.fn(),
  sentryInit: vi.fn(),
  setJson: vi.fn(),
}));

vi.mock("@sentry/react-native", () => ({ init: mocks.sentryInit }));
vi.mock("posthog-react-native", () => ({
  default: mocks.posthog.mockImplementation(function PostHogMock() {
    return {
      capture: mocks.capture,
      optIn: mocks.optIn,
      optOut: mocks.optOut,
    };
  }),
}));
vi.mock("./storage", () => ({
  getJson: mocks.getJson,
  setJson: mocks.setJson,
}));

describe("analytics privacy preference", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.EXPO_PUBLIC_POSTHOG_KEY = "ph_test";
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_POSTHOG_KEY;
  });

  it("does not initialize or capture when the persisted preference is disabled", async () => {
    mocks.getJson.mockResolvedValue(false);
    const analytics = await import("./analytics");

    await analytics.initializeObservability();
    analytics.capture("reward_earned", { app: "private", value: 1 });

    expect(mocks.posthog).not.toHaveBeenCalled();
    expect(mocks.capture).not.toHaveBeenCalled();
  });

  it("applies preference changes immediately and filters identifying properties", async () => {
    mocks.getJson.mockResolvedValue(true);
    mocks.setJson.mockResolvedValue(undefined);
    const analytics = await import("./analytics");

    await analytics.initializeObservability();
    analytics.capture("reward_earned", { appName: "private", value: 1 });
    await analytics.setAnalyticsCollectionEnabled(false);
    analytics.capture("unlock_started", { value: 2 });

    expect(mocks.optIn).toHaveBeenCalledOnce();
    expect(mocks.capture).toHaveBeenCalledOnce();
    expect(mocks.capture).toHaveBeenCalledWith("reward_earned", { value: 1 });
    expect(mocks.optOut).toHaveBeenCalledOnce();
    expect(mocks.setJson).toHaveBeenCalledWith("analyticsEnabled", false);
  });

  it("never sends the onboarding's app names or usage figures (onboarding-v2 D14)", async () => {
    mocks.getJson.mockResolvedValue(true);
    const analytics = await import("./analytics");

    await analytics.initializeObservability();
    analytics.capture("onboarding_step_viewed", {
      step: "reveal",
      label: "Instagram",
      appLabel: "Instagram",
      packageName: "com.instagram.android",
      guessMinutes: 180,
      dailyMinutes: 183,
      usageMinutes: 183,
      unlocks: 82,
    });

    expect(mocks.capture).toHaveBeenCalledWith("onboarding_step_viewed", {
      step: "reveal",
    });
  });
});

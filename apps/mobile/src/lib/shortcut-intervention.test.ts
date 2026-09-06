import { describe, expect, it, vi } from "vitest";

import {
  completeShortcutAndReturn,
  getInterventionUnlockAction,
} from "./shortcut-intervention";

const base = {
  supportsDirectAd: true,
  hasDevice: true,
  rewardProvider: "admob" as const,
  rewardStatus: "ready" as const,
  rewardAdsRemainingToday: 3,
  rewardedPassesRemainingToday: 4,
  rewardedBalance: 1,
  maxRewardTokenBalance: 5,
  emergencyRemaining: 1,
};

describe("direct intervention unlock action", () => {
  it("offers the prepared ad directly on iOS Shortcuts or Android", () => {
    expect(getInterventionUnlockAction(base)).toBe("watch_ad");
  });

  it("waits for an eligible ad to finish preparing", () => {
    expect(
      getInterventionUnlockAction({ ...base, rewardStatus: "preparing" }),
    ).toBe("preparing_ad");
  });

  it("falls back to an existing pass when the ad is unavailable", () => {
    expect(
      getInterventionUnlockAction({ ...base, rewardStatus: "unavailable" }),
    ).toBe("use_rewarded_pass");
  });

  it("falls back to Emergency Access when rewards cannot be used", () => {
    expect(
      getInterventionUnlockAction({
        ...base,
        rewardStatus: "unavailable",
        rewardedBalance: 0,
      }),
    ).toBe("use_emergency");
  });

  it("offers retry when neither an ad nor an allowance is available", () => {
    expect(
      getInterventionUnlockAction({
        ...base,
        rewardStatus: "unavailable",
        rewardedBalance: 0,
        emergencyRemaining: 0,
      }),
    ).toBe("retry_ad");
  });

  it("does not enable direct ads on an unsupported intervention", () => {
    expect(
      getInterventionUnlockAction({ ...base, supportsDirectAd: false }),
    ).toBeNull();
  });
});

describe("iOS Shortcut return orchestration", () => {
  it("activates the app-scoped allowance before opening the exact return URL", async () => {
    const order: string[] = [];
    const unlockShortcut = vi.fn(async () => {
      order.push("allowance");
      return {
        returnUrl: "shortcuts://run-shortcut?name=Still%20%C2%B7%20YouTube",
      };
    });
    const onUnlockActivated = vi.fn(() => {
      order.push("record");
    });
    const openUrl = vi.fn(async (url: string) => {
      order.push(`open:${url}`);
    });

    await completeShortcutAndReturn({
      contextId: "youtube-context",
      freshReward: true,
      unlockShortcut,
      onUnlockActivated,
      openUrl,
    });

    expect(unlockShortcut).toHaveBeenCalledWith("youtube-context", {
      freshReward: true,
    });
    expect(order).toEqual([
      "allowance",
      "record",
      "open:shortcuts://run-shortcut?name=Still%20%C2%B7%20YouTube",
    ]);
  });

  it("never opens the target when activating the allowance fails", async () => {
    const openUrl = vi.fn(async () => undefined);

    await expect(
      completeShortcutAndReturn({
        contextId: "youtube-context",
        unlockShortcut: vi.fn(async () => {
          throw new Error("allowance_failed");
        }),
        openUrl,
      }),
    ).rejects.toThrow("allowance_failed");
    expect(openUrl).not.toHaveBeenCalled();
  });

  it("uses an existing pass without claiming a fresh reward", async () => {
    const unlockShortcut = vi.fn(async () => ({
      returnUrl: "shortcuts://run-shortcut?name=Still%20%C2%B7%20YouTube",
    }));

    await completeShortcutAndReturn({
      contextId: "youtube-context",
      unlockShortcut,
      openUrl: vi.fn(async () => undefined),
    });

    expect(unlockShortcut).toHaveBeenCalledWith("youtube-context");
  });
});

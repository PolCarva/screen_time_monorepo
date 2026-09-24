import { describe, expect, it, vi } from "vitest";

import {
  completeShortcutAndReturn,
  getInterventionOptions,
  rewardStatusForGate,
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
};

describe("what the pause can offer", () => {
  it("offers the prepared ad and the saved pass side by side", () => {
    expect(getInterventionOptions(base)).toEqual({ ad: "ready", pass: true });
  });

  it("offers the ad alone to someone without a saved pass", () => {
    expect(getInterventionOptions({ ...base, rewardedBalance: 0 })).toEqual({
      ad: "ready",
      pass: false,
    });
  });

  it("waits for an eligible ad to finish preparing", () => {
    expect(
      getInterventionOptions({ ...base, rewardStatus: "preparing" }),
    ).toEqual({ ad: "preparing", pass: true });
  });

  it("keeps the saved pass when the ad is unavailable", () => {
    expect(
      getInterventionOptions({ ...base, rewardStatus: "unavailable" }),
    ).toEqual({ ad: "none", pass: true });
  });

  it("offers only the pass once the wallet is full, since an ad could not add one", () => {
    expect(
      getInterventionOptions({ ...base, rewardedBalance: 5 }),
    ).toEqual({ ad: "none", pass: true });
  });

  it("offers neither once today's passes are used up", () => {
    expect(
      getInterventionOptions({ ...base, rewardedPassesRemainingToday: 0 }),
    ).toEqual({ ad: "none", pass: false });
  });

  it("leaves nothing but the pause without an ad or a pass", () => {
    expect(
      getInterventionOptions({
        ...base,
        rewardStatus: "unavailable",
        rewardedBalance: 0,
      }),
    ).toEqual({ ad: "none", pass: false });
  });

  it("does not enable direct ads on an unsupported intervention", () => {
    expect(
      getInterventionOptions({ ...base, supportsDirectAd: false }),
    ).toBeNull();
  });
});

describe("the ad status the gate waits on", () => {
  it("waits for a fresh attempt instead of pausing on an earlier failure", () => {
    const status = rewardStatusForGate("unavailable", true);
    expect(status).toBe("preparing");
    expect(
      getInterventionOptions({ ...base, rewardedBalance: 0, rewardStatus: status }),
    ).toEqual({ ad: "preparing", pass: false });
  });

  it("pauses once the fresh attempt has failed too", () => {
    expect(rewardStatusForGate("unavailable", false)).toBe("unavailable");
  });

  it("passes every other status through", () => {
    for (const status of ["idle", "preparing", "ready"] as const)
      expect(rewardStatusForGate(status, true)).toBe(status);
  });
});

describe("iOS Shortcut return orchestration", () => {
  it("activates the app-scoped allowance before opening the exact return URL", async () => {
    const order: string[] = [];
    const unlockShortcut = vi.fn(async () => {
      order.push("allowance");
      return {
        returnUrl: "shortcuts://run-shortcut?name=Still%20-%20YouTube",
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
      durationSeconds: 1_800,
      unlockShortcut,
      onUnlockActivated,
      openUrl,
    });

    expect(unlockShortcut).toHaveBeenCalledWith("youtube-context", {
      freshReward: true,
      durationSeconds: 1_800,
    });
    expect(order).toEqual([
      "allowance",
      "record",
      "open:shortcuts://run-shortcut?name=Still%20-%20YouTube",
    ]);
  });

  it("never opens the target when activating the allowance fails", async () => {
    const openUrl = vi.fn(async () => undefined);

    await expect(
      completeShortcutAndReturn({
        contextId: "youtube-context",
        durationSeconds: 600,
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
      returnUrl: "shortcuts://run-shortcut?name=Still%20-%20YouTube",
    }));

    await completeShortcutAndReturn({
      contextId: "youtube-context",
      durationSeconds: 60,
      unlockShortcut,
      openUrl: vi.fn(async () => undefined),
    });

    expect(unlockShortcut).toHaveBeenCalledWith("youtube-context", {
      freshReward: false,
      durationSeconds: 60,
    });
  });

  it("falls back to the return shortcut when the app's URL scheme does not open", async () => {
    const opened: string[] = [];
    const onPrimaryReturnFailed = vi.fn();
    const openUrl = vi.fn(async (url: string) => {
      opened.push(url);
      if (url === "instagram://") throw new Error("no_handler");
    });

    await completeShortcutAndReturn({
      contextId: "instagram-context",
      durationSeconds: 600,
      unlockShortcut: vi.fn(async () => ({
        returnUrl: "instagram://",
        fallbackReturnUrl:
          "shortcuts://run-shortcut?name=Still%20-%20Instagram",
      })),
      onPrimaryReturnFailed,
      openUrl,
    });

    expect(opened).toEqual([
      "instagram://",
      "shortcuts://run-shortcut?name=Still%20-%20Instagram",
    ]);
    expect(onPrimaryReturnFailed).toHaveBeenCalledTimes(1);
  });

  it("surfaces the failure when there is no fallback to try", async () => {
    const onPrimaryReturnFailed = vi.fn();

    await expect(
      completeShortcutAndReturn({
        contextId: "youtube-context",
        durationSeconds: 600,
        unlockShortcut: vi.fn(async () => ({
          returnUrl: "shortcuts://run-shortcut?name=Still%20-%20YouTube",
        })),
        onPrimaryReturnFailed,
        openUrl: vi.fn(async () => {
          throw new Error("shortcut_missing");
        }),
      }),
    ).rejects.toThrow("shortcut_missing");
    expect(onPrimaryReturnFailed).not.toHaveBeenCalled();
  });
});

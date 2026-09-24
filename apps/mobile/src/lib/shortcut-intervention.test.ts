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
};

describe("what the pause can offer", () => {
  it("offers the prepared ad", () => {
    expect(getInterventionOptions(base)).toEqual({ ad: "ready" });
  });

  it("waits for an eligible ad to finish preparing", () => {
    for (const rewardStatus of ["idle", "preparing"] as const)
      expect(getInterventionOptions({ ...base, rewardStatus })).toEqual({
        ad: "preparing",
      });
  });

  it("leaves nothing but the pause when the ad is unavailable", () => {
    expect(
      getInterventionOptions({ ...base, rewardStatus: "unavailable" }),
    ).toEqual({ ad: "none" });
  });

  it("offers no ad while rewards are switched off or the device is unknown", () => {
    expect(
      getInterventionOptions({ ...base, rewardProvider: "disabled" }),
    ).toEqual({ ad: "none" });
    expect(getInterventionOptions({ ...base, hasDevice: false })).toEqual({
      ad: "none",
    });
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
    expect(getInterventionOptions({ ...base, rewardStatus: status })).toEqual({
      ad: "preparing",
    });
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
      rewardIntentId: "intent-1",
      durationSeconds: 1_800,
      unlockShortcut,
      onUnlockActivated,
      openUrl,
    });

    expect(unlockShortcut).toHaveBeenCalledWith("youtube-context", {
      durationSeconds: 1_800,
      rewardIntentId: "intent-1",
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

  it("hands back after the pause without naming an ad", async () => {
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

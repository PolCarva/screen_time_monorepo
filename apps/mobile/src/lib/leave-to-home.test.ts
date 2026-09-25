import { describe, expect, it, vi } from "vitest";

import {
  HOME_SHORTCUT_NAME,
  type LeaveToHomeDeps,
  homeShortcutUrl,
  leaveToHome,
} from "./leave-to-home";

function deps(overrides: Partial<LeaveToHomeDeps> = {}) {
  const order: string[] = [];
  const value: LeaveToHomeDeps = {
    homeShortcutInstalled: false,
    resetNavigation: vi.fn(() => {
      order.push("reset");
    }),
    openUrl: vi.fn(async (url: string) => {
      order.push(`open:${url}`);
    }),
    showManualExit: vi.fn(() => {
      order.push("manual");
    }),
    ...overrides,
  };
  return { value, order };
}

describe("leaving to the iOS Home Screen", () => {
  it("builds the helper shortcut URL from a name that can be typed on iOS", () => {
    expect(HOME_SHORTCUT_NAME).toBe("Still - Inicio");
    expect(homeShortcutUrl()).toBe(
      "shortcuts://run-shortcut?name=Still%20-%20Inicio",
    );
  });

  it("resets navigation before running the helper shortcut so Still never reopens on the old pause", async () => {
    const { value, order } = deps({ homeShortcutInstalled: true });
    expect(await leaveToHome(value)).toBe("shortcut");
    expect(order).toEqual(["reset", `open:${homeShortcutUrl()}`]);
  });

  it("ends on the manual hint when nothing else is possible", async () => {
    const { value, order } = deps();
    expect(await leaveToHome(value)).toBe("manual");
    expect(order).toEqual(["reset", "manual"]);
  });

  it("ends on the manual hint when the helper shortcut was deleted", async () => {
    const { value } = deps({
      homeShortcutInstalled: true,
      openUrl: vi.fn(async () => {
        throw new Error("shortcut_missing");
      }),
    });
    expect(await leaveToHome(value)).toBe("manual");
    expect(value.showManualExit).toHaveBeenCalledTimes(1);
  });
});

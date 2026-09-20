export const HOME_SHORTCUT_NAME = "Still · Inicio";

export type LeaveToHomeOutcome = "suspended" | "shortcut" | "manual";

export type LeaveToHomeDeps = {
  /** Remote `iosHomeOnCancelEnabled`. Off by default; see docs/store-compliance.md. */
  homeOnCancelEnabled: boolean;
  /** The user confirmed they installed the helper shortcut named `HOME_SHORTCUT_NAME`. */
  homeShortcutInstalled: boolean;
  /**
   * Puts Still back on its resting screen. It runs before anything else so
   * the next launch never reopens on a finished intervention.
   */
  resetNavigation: () => void | Promise<void>;
  suspendToHome: () => Promise<void>;
  openUrl: (url: string) => Promise<unknown>;
  /** Last resort: tell the user how to leave, because Still cannot do it for them. */
  showManualExit: () => void | Promise<void>;
};

export function homeShortcutUrl(name: string = HOME_SHORTCUT_NAME): string {
  return `shortcuts://run-shortcut?name=${encodeURIComponent(name)}`;
}

/**
 * "I don't want to go in anymore" should end on the iOS Home Screen. iOS has
 * no public API for that, so this walks a chain and reports which link worked:
 * the remotely switchable suspend call, then a one-action helper shortcut
 * ("Go to Home Screen"), then a plain hint.
 */
export async function leaveToHome(
  deps: LeaveToHomeDeps,
): Promise<LeaveToHomeOutcome> {
  await deps.resetNavigation();

  if (deps.homeOnCancelEnabled) {
    try {
      await deps.suspendToHome();
      return "suspended";
    } catch {
      // Fall through: an iOS release that drops the call must not strand anyone.
    }
  }

  if (deps.homeShortcutInstalled) {
    try {
      await deps.openUrl(homeShortcutUrl());
      return "shortcut";
    } catch {
      // The shortcut was renamed or deleted since the user confirmed it.
    }
  }

  await deps.showManualExit();
  return "manual";
}

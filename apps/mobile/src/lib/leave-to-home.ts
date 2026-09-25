export const HOME_SHORTCUT_NAME = "Still - Inicio";

export type LeaveToHomeOutcome = "shortcut" | "manual";

export type LeaveToHomeDeps = {
  /** The user confirmed they installed the helper shortcut named `HOME_SHORTCUT_NAME`. */
  homeShortcutInstalled: boolean;
  /**
   * Puts Still back on its resting screen. It runs before anything else so
   * the next launch never reopens on a finished intervention.
   */
  resetNavigation: () => void | Promise<void>;
  openUrl: (url: string) => Promise<unknown>;
  /** Last resort: tell the user how to leave, because Still cannot do it for them. */
  showManualExit: () => void | Promise<void>;
};

export function homeShortcutUrl(name: string = HOME_SHORTCUT_NAME): string {
  return `shortcuts://run-shortcut?name=${encodeURIComponent(name)}`;
}

/**
 * "I don't want to go in anymore" should end on the iOS Home Screen. iOS has
 * no public API for that (App Review 2.5.1 rules out the private one), so
 * this walks a chain and reports which link worked: the user's one-action
 * helper shortcut ("Go to Home Screen"), then a plain hint.
 */
export async function leaveToHome(
  deps: LeaveToHomeDeps,
): Promise<LeaveToHomeOutcome> {
  await deps.resetNavigation();

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

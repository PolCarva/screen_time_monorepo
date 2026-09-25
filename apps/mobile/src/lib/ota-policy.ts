/**
 * When the running app applies an over-the-air update (docs/ota-updates-plan.md).
 * The native side checks at every launch and never waits for the network; on
 * Android the process can live for days next to the accessibility service, so
 * JavaScript also checks on return and applies a downloaded update only where a
 * reload loses nothing. Pure except for the session hold, so tests pin it down.
 */

/** A check on return at most this often; every launch already checks. */
export const OTA_CHECK_INTERVAL_MS = 60 * 60 * 1_000;
/** A downloaded update waits for a return after this long away: a quick switch never reloads. */
export const OTA_MIN_BACKGROUND_MS = 5 * 60 * 1_000;

export function shouldCheckForUpdate(now: number, lastCheckAt: number): boolean {
  return now - lastCheckAt >= OTA_CHECK_INTERVAL_MS;
}

export type ApplyContext = {
  appState: string;
  /** expo-router segments; only the tabs (Today, Impact, Settings) are safe. */
  segments: readonly string[];
  hydrated: boolean;
  onboarded: boolean;
  /** How long the app was away before this return. */
  backgroundMs: number;
  /** iOS: a Shortcut pause is waiting to show. */
  pendingShortcut: boolean;
  /** A browser or sign-in session is open and ends when the user is back. */
  held: boolean;
};

/**
 * True only back on a tab, in the foreground, after five minutes away: never
 * during a pause, the setup or the app picker, with a Shortcut pause waiting,
 * or with a session whose end restores the pause.
 */
export function canApplyUpdate(context: ApplyContext): boolean {
  return (
    context.appState === "active" &&
    context.hydrated &&
    context.onboarded &&
    context.segments[0] === "(tabs)" &&
    context.backgroundMs >= OTA_MIN_BACKGROUND_MS &&
    !context.pendingShortcut &&
    !context.held
  );
}

let holds = 0;

/**
 * Marks work a reload would cut short, like an external browser or sign-in
 * session whose end turns the pause back on. Call the returned release once,
 * when it ends; extra calls do nothing.
 */
export function holdOtaReload(): () => void {
  holds += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds = Math.max(0, holds - 1);
  };
}

export function isOtaReloadHeld(): boolean {
  return holds > 0;
}

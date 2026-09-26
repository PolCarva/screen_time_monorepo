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
/** A reload happens right after the return, never once the user is using the tab. */
export const OTA_APPLY_WINDOW_MS = 3_000;

export function shouldCheckForUpdate(now: number, lastCheckAt: number): boolean {
  return now - lastCheckAt >= OTA_CHECK_INTERVAL_MS;
}

/**
 * Whether this return checks the server: hourly, and always before applying a
 * downloaded update, so a rollback or a newer fix published since replaces it.
 */
export function shouldCheckOnReturn(input: {
  now: number;
  lastCheckAt: number;
  updatePending: boolean;
  awayMs: number;
}): boolean {
  return (
    shouldCheckForUpdate(input.now, input.lastCheckAt) ||
    (input.updatePending && input.awayMs >= OTA_MIN_BACKGROUND_MS)
  );
}

export type ApplyContext = {
  appState: string;
  /** expo-router segments; only the tabs (Today, Impact, Settings) are safe. */
  segments: readonly string[];
  hydrated: boolean;
  onboarded: boolean;
  /** How long the app was in the background before this return. */
  backgroundMs: number;
  /** Time since that return; the check before applying takes some. */
  sinceReturnMs: number;
  /** iOS: a Shortcut pause is waiting to show. */
  pendingShortcut: boolean;
  /** A browser or sign-in session is open and ends when the user is back. */
  held: boolean;
};

/**
 * True only back on a tab, in the foreground, right after five minutes away:
 * never during a pause, the setup or the app picker, with a Shortcut pause
 * waiting, with a session whose end restores the pause, or once the user has
 * been back for a few seconds.
 */
export function canApplyUpdate(context: ApplyContext): boolean {
  return (
    context.appState === "active" &&
    context.hydrated &&
    context.onboarded &&
    context.segments[0] === "(tabs)" &&
    context.backgroundMs >= OTA_MIN_BACKGROUND_MS &&
    context.sinceReturnMs <= OTA_APPLY_WINDOW_MS &&
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

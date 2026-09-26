import * as Updates from "expo-updates";
import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";

import {
  canApplyUpdate,
  isOtaReloadHeld,
  shouldCheckOnReturn,
} from "@/lib/ota-policy";
import { restrictionEngine } from "@/native/restriction-engine";

const otaActive = !__DEV__ && Updates.isEnabled;

type Return = {
  /** Every return gets a number; only the latest may still reload. */
  seq: number;
  awayMs: number;
  at: number;
  /** A session was open when the user came back: it ends on this return. */
  heldAtReturn: boolean;
};

// Module state lives as long as the JavaScript runtime, not the React tree:
// on Android the process outlives Still's screen (the accessibility service
// keeps it), and closing Still from Recents unmounts the tree without a new
// launch check.
/** The runtime starts right after the native launch check. */
let lastCheckAt = Date.now();
let backgroundSince: number | null = null;
let returnSeq = 0;
let busy = false;
/** A return seen while no tree was mounted (Android re-creating the screen). */
let unhandledReturn: Return | null = null;
let onReturn: ((ret: Return) => void) | null = null;

if (otaActive) {
  // Registered before any session's listener, so `heldAtReturn` is read
  // before a browser or sign-in session releases its hold on this return.
  AppState.addEventListener("change", (state) => {
    // Only real time away counts: iOS system sheets, Control Center and Face
    // ID make the app "inactive" without leaving it.
    if (state === "background") {
      backgroundSince ??= Date.now();
      returnSeq += 1;
      return;
    }
    if (state !== "active" || backgroundSince === null) return;
    const at = Date.now();
    returnSeq += 1;
    const ret = {
      seq: returnSeq,
      awayMs: at - backgroundSince,
      at,
      heldAtReturn: isOtaReloadHeld(),
    };
    backgroundSince = null;
    if (onReturn) onReturn(ret);
    else unhandledReturn = ret;
  });
}

/**
 * Over-the-air updates in the running app (docs/ota-updates-plan.md). Every
 * launch already checks and downloads without waiting, and applies on the next
 * cold start. This covers a process that stays alive: on a return it checks
 * again (hourly, and always before applying) and applies a downloaded update
 * only where a reload loses nothing (lib/ota-policy.ts). Off in development
 * and dev-client builds.
 */
export function useOtaUpdates({
  segments,
  hydrated,
  onboarded,
}: {
  segments: readonly string[];
  hydrated: boolean;
  onboarded: boolean;
}) {
  const { isUpdatePending } = Updates.useUpdates();
  const latest = useRef({ segments, hydrated, onboarded, isUpdatePending });
  latest.current = { segments, hydrated, onboarded, isUpdatePending };

  useEffect(() => {
    if (!otaActive) return;

    const handle = async (ret: Return) => {
      let pending = latest.current.isUpdatePending;
      // The server announced something newer that did not download: the
      // pending update is not the one to apply now.
      let superseded = false;
      if (
        shouldCheckOnReturn({
          now: Date.now(),
          lastCheckAt,
          updatePending: pending,
          awayMs: ret.awayMs,
        })
      ) {
        try {
          const result = await Updates.checkForUpdateAsync();
          if (result.isAvailable || result.isRollBackToEmbedded) {
            superseded = true;
            const fetched = await Updates.fetchUpdateAsync();
            superseded = false;
            pending ||= fetched.isNew || fetched.isRollBackToEmbedded;
          }
          // Only a check (and download) that finished counts: after a
          // failure, the next return tries again.
          lastCheckAt = Date.now();
        } catch {
          // Offline or a failed download: keep what is already downloaded.
        }
      }
      if (!pending || superseded) return;

      const pendingShortcut =
        Platform.OS === "ios" &&
        Boolean(
          await restrictionEngine.getPendingShortcutIntervention().catch(() => null),
        );
      // A newer background or return, or a remount, took over meanwhile.
      if (ret.seq !== returnSeq || onReturn !== onReturnHere) return;
      const current = latest.current;
      if (
        canApplyUpdate({
          appState: AppState.currentState,
          segments: current.segments,
          hydrated: current.hydrated,
          onboarded: current.onboarded,
          backgroundMs: ret.awayMs,
          sinceReturnMs: Date.now() - ret.at,
          pendingShortcut,
          held: ret.heldAtReturn || isOtaReloadHeld(),
        })
      ) {
        await Updates.reloadAsync();
      }
      // Otherwise it waits for the next safe return, or the next cold start.
    };

    const onReturnHere = (ret: Return) => {
      if (busy) return;
      busy = true;
      void handle(ret)
        .catch(() => undefined)
        .finally(() => {
          busy = false;
        });
    };
    onReturn = onReturnHere;
    if (unhandledReturn) {
      const ret = unhandledReturn;
      unhandledReturn = null;
      onReturnHere(ret);
    }
    return () => {
      if (onReturn === onReturnHere) onReturn = null;
    };
  }, []);
}

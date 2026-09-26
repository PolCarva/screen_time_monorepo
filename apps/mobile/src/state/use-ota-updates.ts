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

// Module state lives as long as the JavaScript runtime, not the React tree:
// on Android the process outlives Still's screen (the accessibility service
// keeps it), and closing Still from Recents unmounts the tree without a new
// launch check.
/** The runtime starts right after the native launch check. */
let lastCheckAt = Date.now();
let backgroundSince: number | null = null;
/** A return seen while no tree was mounted (Android re-creating the screen). */
let unhandledReturn: { awayMs: number; at: number } | null = null;
let onReturn: ((awayMs: number, at: number) => void) | null = null;

if (otaActive) {
  AppState.addEventListener("change", (state) => {
    // Only real time away counts: iOS system sheets, Control Center and Face
    // ID make the app "inactive" without leaving it.
    if (state === "background") {
      backgroundSince ??= Date.now();
      return;
    }
    if (state !== "active" || backgroundSince === null) return;
    const at = Date.now();
    const awayMs = at - backgroundSince;
    backgroundSince = null;
    if (onReturn) onReturn(awayMs, at);
    else unhandledReturn = { awayMs, at };
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
    let busy = false;

    const handle = async (awayMs: number, returnedAt: number) => {
      let pending = latest.current.isUpdatePending;
      if (
        shouldCheckOnReturn({
          now: Date.now(),
          lastCheckAt,
          updatePending: pending,
          awayMs,
        })
      ) {
        try {
          const result = await Updates.checkForUpdateAsync();
          // Only a check that answered counts: offline, the next return retries.
          lastCheckAt = Date.now();
          if (result.isAvailable || result.isRollBackToEmbedded) {
            const fetched = await Updates.fetchUpdateAsync();
            pending ||= fetched.isNew || fetched.isRollBackToEmbedded;
          }
        } catch {
          // Offline or a failed download: keep what is already downloaded.
        }
      }
      if (!pending) return;

      const pendingShortcut =
        Platform.OS === "ios" &&
        Boolean(
          await restrictionEngine.getPendingShortcutIntervention().catch(() => null),
        );
      const current = latest.current;
      if (
        canApplyUpdate({
          appState: AppState.currentState,
          segments: current.segments,
          hydrated: current.hydrated,
          onboarded: current.onboarded,
          backgroundMs: awayMs,
          sinceReturnMs: Date.now() - returnedAt,
          pendingShortcut,
          held: isOtaReloadHeld(),
        })
      ) {
        await Updates.reloadAsync();
      }
      // Otherwise it waits for the next safe return, or the next cold start.
    };

    const onReturnHere = (awayMs: number, at: number) => {
      if (busy) return;
      busy = true;
      void handle(awayMs, at)
        .catch(() => undefined)
        .finally(() => {
          busy = false;
        });
    };
    onReturn = onReturnHere;
    if (unhandledReturn) {
      const { awayMs, at } = unhandledReturn;
      unhandledReturn = null;
      onReturnHere(awayMs, at);
    }
    return () => {
      if (onReturn === onReturnHere) onReturn = null;
    };
  }, []);
}

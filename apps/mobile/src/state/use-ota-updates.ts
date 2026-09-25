import * as Updates from "expo-updates";
import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";

import {
  canApplyUpdate,
  isOtaReloadHeld,
  shouldCheckForUpdate,
} from "@/lib/ota-policy";
import { restrictionEngine } from "@/native/restriction-engine";

/**
 * Over-the-air updates in the running app (docs/ota-updates-plan.md). Every
 * launch already checks and downloads without waiting, and applies on the next
 * cold start. This covers a process that stays alive: on each return it checks
 * again (at most hourly) and applies a downloaded update only where a reload
 * loses nothing (lib/ota-policy.ts). Off in development and dev-client builds.
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
    if (__DEV__ || !Updates.isEnabled) return;
    // The launch check has just run natively.
    let lastCheckAt = Date.now();
    let awaySince: number | null = null;
    let busy = false;

    const onReturn = async (awayMs: number) => {
      if (latest.current.isUpdatePending) {
        const pendingShortcut =
          Platform.OS === "ios" &&
          Boolean(
            await restrictionEngine.getPendingShortcutIntervention().catch(() => null),
          );
        const { segments, hydrated, onboarded } = latest.current;
        if (
          canApplyUpdate({
            appState: AppState.currentState,
            segments,
            hydrated,
            onboarded,
            backgroundMs: awayMs,
            pendingShortcut,
            held: isOtaReloadHeld(),
          })
        ) {
          await Updates.reloadAsync();
        }
        return;
      }
      const now = Date.now();
      if (!shouldCheckForUpdate(now, lastCheckAt)) return;
      lastCheckAt = now;
      const result = await Updates.checkForUpdateAsync();
      // Downloaded now, applied at the next safe return or cold start.
      if (result.isAvailable || result.isRollBackToEmbedded) {
        await Updates.fetchUpdateAsync();
      }
    };

    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        awaySince ??= Date.now();
        return;
      }
      const awayMs = awaySince === null ? 0 : Date.now() - awaySince;
      awaySince = null;
      if (busy) return;
      busy = true;
      // Offline or a failed download: the next return tries again.
      void onReturn(awayMs)
        .catch(() => undefined)
        .finally(() => {
          busy = false;
        });
    });
    return () => subscription.remove();
  }, []);
}

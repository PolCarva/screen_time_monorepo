import { useCallback } from "react";
import { Linking, Platform } from "react-native";

import { gotItAction, useStillSheet } from "@/components/still-sheet";
import { localize } from "@/i18n";
import type { KeepAliveTarget } from "@/lib/android-oem";
import { restrictionEngine } from "@/native/restriction-engine";

/**
 * Straight to Still's Accessibility switch when it is on but the phone closed
 * Still (docs/android-parity-plan.md §13): off and on again, and the service
 * brings Still back once it runs. No disclosure here: the switch was already
 * turned on after it.
 */
export async function reopenAccessibility(): Promise<boolean> {
  await restrictionEngine.setSetupAwaiting?.("accessibility").catch(() => undefined);
  return (await restrictionEngine.openAccessibilitySettings?.().catch(() => false)) ?? false;
}

/**
 * MIUI / HyperOS Security's Autostart list. HyperOS 3 has no Autostart switch
 * in the app info, only this list (docs/android-parity-plan.md §15), and the
 * Security app is visible to every app, so a plain intent opens it.
 */
const MIUI_AUTOSTART_ACTION = "miui.intent.action.OP_AUTO_START";

async function openKeepAliveTarget(target: KeepAliveTarget): Promise<boolean> {
  if (target === "autostart" && Platform.OS === "android") {
    const opened = await Linking.sendIntent(MIUI_AUTOSTART_ACTION).then(
      () => true,
      () => false,
    );
    if (opened) return true;
  }
  if (restrictionEngine.openKeepAliveSetting) {
    return restrictionEngine.openKeepAliveSetting(target).catch(() => false);
  }
  // Builds before 0.3.5 only open these two screens, and never Recents.
  if (target === "recents") return false;
  const opened =
    target === "battery"
      ? restrictionEngine.openBatterySettings?.()
      : restrictionEngine.openAppInfo?.();
  return (await opened?.catch(() => false)) ?? false;
}

/** The cue on a tip's row: Recents is a place to open, the rest settings. */
export function keepAliveAction(target: KeepAliveTarget): string {
  return target === "recents" ? localize("Open", "Abrir") : localize("Set up", "Configurar");
}

/**
 * Opens where a "keep Still running" tip is done (src/lib/android-oem.ts), and
 * says how to get there when nothing could open: Recents needs the running
 * service.
 */
export function useOpenKeepAlive(): (target: KeepAliveTarget) => Promise<void> {
  const sheet = useStillSheet();
  return useCallback(
    async (target: KeepAliveTarget) => {
      if (await openKeepAliveTarget(target)) return;
      void sheet.show({
        title:
          target === "recents"
            ? localize("Lock Still in Recents", "Fija Still en Recientes")
            : localize("Find Still in Settings", "Busca Still en Ajustes"),
        message:
          target === "recents"
            ? localize(
                "Open Recents, press and hold Still's card and tap the lock.",
                "Abre Recientes, mantén pulsada la tarjeta de Still y toca el candado.",
              )
            : localize(
                "Search for “Still” in Settings' search bar and open its app info.",
                "Busca «Still» en la lupa de Ajustes y abre su información.",
              ),
        actions: [gotItAction()],
      });
    },
    [sheet],
  );
}

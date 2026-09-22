import { Linking } from "react-native";

import { notNowAction, type SheetApi } from "@/components/still-sheet";
import { localize } from "@/i18n";

/** Apple's Shortcuts on the App Store (apps.apple.com/app/id915249334). */
export const SHORTCUTS_APP_STORE_URL =
  "itms-apps://apps.apple.com/app/id915249334";

/**
 * Shortcuts is deletable. When even its bare URL does not open, the only
 * useful next step is getting it back, so the sheet offers exactly that.
 */
export async function offerShortcutsInstall(sheet: SheetApi): Promise<void> {
  await sheet.show({
    title: localize("Shortcuts is missing", "Falta la app Atajos"),
    message: localize(
      "Still uses Apple's Shortcuts to show the pause. It's free.",
      "Still usa Atajos de Apple para mostrar la pausa. Es gratis.",
    ),
    actions: [
      {
        label: localize("Install Shortcuts", "Instalar Atajos"),
        variant: "signal",
        onPress: () =>
          Linking.openURL(SHORTCUTS_APP_STORE_URL).catch(() => undefined),
      },
      notNowAction(),
    ],
  });
}

import type { AndroidScreenId } from "@/components/guide/android-settings-screens";
import { notNowAction, type SheetApi } from "@/components/still-sheet";
import { androidSys, localize } from "@/i18n";

/** Play evidence that the prominent disclosure was accepted, kept past onboarding. */
export const DISCLOSURE_ACCEPTED_KEY = "accessibilityDisclosureAcceptedAt";

/**
 * What every place that turns Still's Accessibility service on shares: the
 * Play prominent disclosure and the drawn guide of Android's own screens
 * (the Android setup screen and the onboarding's verified setup).
 */

/** A Settings label quoted the way each language quotes: “Allow”, «Permitir». */
export function q(label: string) {
  return localize(`“${label}”`, `«${label}»`);
}

// Android's Accessibility screens, drawn in code with the control to tap
// ringed. Tapping one runs the same disclosure-then-open flow as the button.
export const permissionGuide: { id: AndroidScreenId; caption: string; label: string }[] = [
  {
    id: "accessibility-find-still",
    caption: localize("1. Tap Still", "1. Toca Still"),
    label: localize(
      "Accessibility settings with Still marked in Downloaded apps.",
      "Ajustes de Accesibilidad con Still marcada en las apps descargadas.",
    ),
  },
  {
    id: "accessibility-turn-on",
    caption: localize(
      `2. Turn on ${q(androidSys("useService", { app: "Still" }))}`,
      `2. Activa ${q(androidSys("useService", { app: "Still" }))}`,
    ),
    label: localize(
      `Still's page in Accessibility with the ${androidSys("useService", { app: "Still" })} switch marked.`,
      `La página de Still en Accesibilidad con el interruptor ${androidSys("useService", { app: "Still" })} marcado.`,
    ),
  },
  {
    id: "accessibility-allow",
    caption: localize(
      `3. Tap ${q(androidSys("allow"))}`,
      `3. Toca ${q(androidSys("allow"))}`,
    ),
    label: localize(
      `Android's confirmation for Still with ${androidSys("allow")} marked.`,
      `La confirmación de Android para Still con ${androidSys("allow")} marcado.`,
    ),
  },
];

/**
 * Google Play's prominent disclosure: what the permission detects, what it is
 * for, what it never collects and how to turn it off. The content is required;
 * only its presentation is Still's. It cannot be swiped away as consent.
 */
export async function confirmAccessibilityDisclosure(sheet: SheetApi): Promise<boolean> {
  const choice = await sheet.show({
    title: localize("Still uses Accessibility", "Still usa Accesibilidad"),
    message: localize(
      "To show you the pause, Still needs to know which app you open.",
      "Para mostrarte la pausa, Still necesita saber qué app abres.",
    ),
    bullets: [
      localize(
        "It detects when you open one of your chosen apps.",
        "Detecta cuándo abres una de tus apps elegidas.",
      ),
      localize(
        "It shows the pause on top of that app.",
        "Muestra la pausa encima de esa app.",
      ),
      localize(
        "It closes a floating video that would cover the pause.",
        "Cierra el video flotante que taparía la pausa.",
      ),
      localize(
        "It does not type for you or read your messages, and it does not store or share what is on your screen.",
        "No escribe por ti ni lee tus mensajes, y no guarda ni comparte lo que hay en tu pantalla.",
      ),
      localize(
        "Your apps and your counts stay on this phone.",
        "Tus apps y tus conteos se quedan en este teléfono.",
      ),
      localize(
        "You can remove the permission at any time in Settings.",
        "Puedes quitar el permiso cuando quieras en Ajustes.",
      ),
    ],
    actions: [
      {
        label: localize("I agree and continue", "Aceptar y continuar"),
        variant: "signal",
      },
      notNowAction(),
    ],
    dismissible: false,
  });
  return choice === 0;
}


/**
 * The words of the pause's first screen, shared by the real iOS pause
 * (components/shortcut-intervention) and the onboarding's replica of both
 * platforms (docs/onboarding-v2-plan.md §3.7), so the demo never promises a
 * screen the user will not see. The Android shield is Kotlin; pause-copy.test
 * checks InterventionActivity says the same.
 */

export type PausePlatform = "ios" | "android";
export type PauseLocale = "en" | "es";

type Localized = { en: string; es: string };

export const PAUSE_COPY = {
  question: {
    en: "If you go in, you choose for how long.",
    es: "Si entras, eliges por cuánto tiempo.",
  },
  watchAd: { en: "Watch ad", es: "Ver anuncio" },
  /** Android's primary control. */
  goBack: { en: "Go back", es: "Volver" },
  /** iOS's primary control. */
  leave: { en: "I don't want to go in anymore", es: "Ya no quiero entrar" },
} as const satisfies Record<string, Localized>;

/** The primary, "don't go in" control of each platform's pause. */
export function pauseDeclineLabel(
  platform: PausePlatform,
  locale: PauseLocale,
): string {
  return (platform === "android" ? PAUSE_COPY.goBack : PAUSE_COPY.leave)[locale];
}

/**
 * "Instagram opened 4 times today." iOS breaks the line after the app name;
 * Android says "once" / "una vez" for one.
 */
export function openedTodayHeadline(
  appLabel: string,
  attempts: number,
  platform: PausePlatform,
  locale: PauseLocale,
): string {
  if (platform === "ios") {
    return locale === "es"
      ? `${appLabel} se abrió\n${attempts} ${attempts === 1 ? "vez" : "veces"} hoy.`
      : `${appLabel} opened\n${attempts} ${attempts === 1 ? "time" : "times"} today.`;
  }
  if (locale === "es") {
    return `${appLabel} se abrió ${attempts === 1 ? "una vez" : `${attempts} veces`} hoy.`;
  }
  return `${appLabel} opened ${attempts === 1 ? "once" : `${attempts} times`} today.`;
}

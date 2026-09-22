import { getLocales } from "expo-localization";

import {
  androidSettingsString,
  shortcutsString,
  systemVariantFor,
  type AndroidSettingsStringKey,
  type ShortcutsStringKey,
} from "@/lib/system-strings";

const en = {
  today: "Today", tokens: "Passes", impact: "Impact", settings: "Settings",
  greeting: "Today, recorded", screenTime: "Screen time", avoided: "Opens avoided", saved: "Estimated time saved",
  available: "passes available", getToken: "Get 1 pass", emergency: "Emergency passes",
  voteNow: "Vote now", estimated: "Estimated", nowNot: "Don't enter", useToken: "Use 1 pass",
  interventionTitle: "A pause before entering", permissionHealth: "Restriction health",
} as const;
const es: Record<keyof typeof en, string> = {
  today: "Hoy", tokens: "Pases", impact: "Impacto", settings: "Ajustes",
  greeting: "Hoy, registrado", screenTime: "Tiempo en pantalla", avoided: "Entradas evitadas", saved: "Tiempo ahorrado estimado",
  available: "pases disponibles", getToken: "Conseguir 1 pase", emergency: "Pases de emergencia",
  voteNow: "Votar ahora", estimated: "Estimado", nowNot: "No entrar", useToken: "Usar 1 pase",
  interventionTitle: "Una pausa antes de entrar", permissionHealth: "Estado de las restricciones",
};

export type TranslationKey = keyof typeof en;
export const locale = getLocales()[0]?.languageCode === "es" ? "es" : "en";
export function t(key: TranslationKey) { return (locale === "es" ? es : en)[key]; }
export function localize(english: string, spanish: string) {
  return locale === "es" ? spanish : english;
}

// Spanish readers expect a 24-hour clock ("21:00"), not "9:00 p. m.".
const clock = locale === "es" ? { hour12: false } : {};

/** "21:00" in Spanish, "9:00 PM" in English. */
export function formatClockTime(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    ...clock,
  }).format(date);
}

/** "22 sept, 21:00" in Spanish, "Sep 22, 9:00 PM" in English. */
export function formatDayAndTime(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    ...clock,
  }).format(date);
}

/** Which of Apple's/Android's own translations this phone shows (see system-strings). */
export const systemVariant = systemVariantFor(getLocales()[0] ?? {});

/** A Shortcuts label exactly as this phone shows it. */
export function sys(key: ShortcutsStringKey, values?: Record<string, string>) {
  return shortcutsString(systemVariant, key, values);
}

/** An Android Settings label exactly as this phone shows it. */
export function androidSys(
  key: AndroidSettingsStringKey,
  values?: Record<string, string>,
) {
  return androidSettingsString(systemVariant, key, values);
}

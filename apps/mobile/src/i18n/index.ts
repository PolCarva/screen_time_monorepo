import { getLocales } from "expo-localization";

const en = {
  today: "Today", tokens: "Tokens", impact: "Impact", settings: "Settings",
  greeting: "A quieter day", screenTime: "Screen time", avoided: "Opens avoided", saved: "Estimated time saved",
  available: "tokens available", getToken: "Get an Unlock Token", emergency: "Emergency Unlocks",
  voteNow: "Vote now", estimated: "Estimated", nowNot: "Not now", useToken: "Use 1 Unlock Token",
  interventionTitle: "Do you really want to open this app?", permissionHealth: "Restriction health",
} as const;
const es: Record<keyof typeof en, string> = {
  today: "Hoy", tokens: "Tokens", impact: "Impacto", settings: "Ajustes",
  greeting: "Un día más tranquilo", screenTime: "Tiempo en pantalla", avoided: "Aperturas evitadas", saved: "Tiempo ahorrado estimado",
  available: "tokens disponibles", getToken: "Obtener Unlock Token", emergency: "Desbloqueos de emergencia",
  voteNow: "Votar ahora", estimated: "Estimado", nowNot: "Ahora no", useToken: "Usar 1 Unlock Token",
  interventionTitle: "¿Realmente quieres abrir esta app?", permissionHealth: "Estado de las restricciones",
};

export type TranslationKey = keyof typeof en;
export const locale = getLocales()[0]?.languageCode === "es" ? "es" : "en";
export function t(key: TranslationKey) { return (locale === "es" ? es : en)[key]; }
export function localize(english: string, spanish: string) {
  return locale === "es" ? spanish : english;
}

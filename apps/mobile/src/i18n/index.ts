import { getLocales } from "expo-localization";

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

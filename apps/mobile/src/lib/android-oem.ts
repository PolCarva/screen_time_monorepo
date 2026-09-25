/**
 * Per-manufacturer guidance for keeping Still awake in the background. Some
 * Android makers kill background apps and need extra permissions (autostart,
 * battery, "show pop-up windows"). There is no API to read those states, so the
 * best Still can do is tell the user, in product voice, what to allow.
 *
 * Pure and React-Native-free so it can be unit tested (D6). Sources for the
 * per-OEM steps are in docs/android-parity-plan.md §6.4.
 */
export type OemKey =
  | "xiaomi"
  | "samsung"
  | "huawei"
  | "oppo"
  | "vivo"
  | "generic";

export type LocalizedTip = { en: string; es: string };

export type OemGuidance = {
  key: OemKey;
  /** Human name for the maker, or empty for generic. */
  name: string;
  tips: LocalizedTip[];
};

const GENERIC_TIP: LocalizedTip = {
  en: "Let Still keep running in the background and don't optimize its battery.",
  es: "Deja que Still siga en segundo plano y no optimices su batería.",
};

const OEM_TIPS: Record<Exclude<OemKey, "generic">, { name: string; tips: LocalizedTip[] }> = {
  xiaomi: {
    name: "Xiaomi",
    tips: [
      { en: "Turn on Autostart for Still.", es: "Activa el inicio automático de Still." },
      {
        en: "Set its battery saver to No restrictions.",
        es: "Pon su ahorro de batería en Sin restricciones.",
      },
      {
        en: "Allow it to show pop-up windows while running in the background.",
        es: "Permítele mostrar ventanas emergentes mientras está en segundo plano.",
      },
    ],
  },
  samsung: {
    name: "Samsung",
    tips: [
      {
        en: "Remove Still from apps that are put to sleep.",
        es: "Saca a Still de las apps que se ponen en suspensión.",
      },
      { en: "Turn off battery optimization for it.", es: "Desactiva la optimización de batería para ella." },
    ],
  },
  huawei: {
    name: "Huawei",
    tips: [
      {
        en: "Manage Still's launch yourself and keep every switch on.",
        es: "Gestiona el inicio de Still tú mismo y deja todos los interruptores activos.",
      },
    ],
  },
  oppo: {
    name: "Oppo",
    tips: [
      { en: "Allow Autostart and background running for Still.", es: "Permite el inicio automático y la ejecución en segundo plano de Still." },
    ],
  },
  vivo: {
    name: "vivo",
    tips: [
      { en: "Allow Autostart and unrestricted battery for Still.", es: "Permite el inicio automático y la batería sin restricciones de Still." },
    ],
  },
};

/** Maps a `Build.MANUFACTURER` value to product-voice guidance. */
export function oemGuidance(manufacturer: string): OemGuidance {
  const value = manufacturer.trim().toLowerCase();
  const match: [OemKey, RegExp][] = [
    ["xiaomi", /xiaomi|redmi|poco/],
    ["samsung", /samsung/],
    ["huawei", /huawei|honor/],
    ["oppo", /oppo|oneplus|realme/],
    ["vivo", /vivo|iqoo/],
  ];
  for (const [key, pattern] of match) {
    if (pattern.test(value) && key !== "generic") {
      return { key, name: OEM_TIPS[key].name, tips: OEM_TIPS[key].tips };
    }
  }
  return { key: "generic", name: "", tips: [GENERIC_TIP] };
}

/** True when the maker is known to aggressively kill background apps. */
export function isAggressiveOem(manufacturer: string): boolean {
  return oemGuidance(manufacturer).key !== "generic";
}

/**
 * Where a maker's Settings usually keeps Still's Accessibility switch. Worded as
 * "usually": skins move it between versions, so the onboarding shows this next
 * to the way that always works (Settings' search) and moves on only when the
 * switch is really on (docs/onboarding-v2-plan.md §5.2).
 */
const ACCESSIBILITY_PATHS: Record<Exclude<OemKey, "generic">, LocalizedTip> = {
  xiaomi: {
    en: "On Xiaomi it's usually in Additional settings › Accessibility › Downloaded apps.",
    es: "En Xiaomi suele estar en Ajustes adicionales › Accesibilidad › Apps descargadas.",
  },
  samsung: {
    en: "On Samsung it's usually in Accessibility › Installed apps.",
    es: "En Samsung suele estar en Accesibilidad › Aplicaciones instaladas.",
  },
  huawei: {
    en: "On Huawei and Honor it's usually in Accessibility features › Accessibility.",
    es: "En Huawei y Honor suele estar en Funciones de accesibilidad › Accesibilidad.",
  },
  oppo: {
    en: "On OPPO, OnePlus and realme it's usually in Additional settings › Accessibility › Downloaded apps.",
    es: "En OPPO, OnePlus y realme suele estar en Ajustes adicionales › Accesibilidad › Apps descargadas.",
  },
  vivo: {
    en: "On vivo it's usually in Shortcuts & accessibility › Accessibility.",
    es: "En vivo suele estar en Accesos directos y accesibilidad › Accesibilidad.",
  },
};

export function accessibilityPathTip(manufacturer: string): LocalizedTip | null {
  const key = oemGuidance(manufacturer).key;
  return key === "generic" ? null : ACCESSIBILITY_PATHS[key];
}

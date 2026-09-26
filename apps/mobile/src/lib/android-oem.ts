/**
 * Per-manufacturer guidance for keeping Still awake in the background. Some
 * Android makers kill background apps and need extra permissions (autostart,
 * battery, "show pop-up windows"). There is no API to read those states, so the
 * best Still can do is tell the user, in product voice, what to allow, and
 * take them straight to where each tip is done (`opens`).
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

/**
 * The screen a tip is done on, opened natively (StillSetup.openKeepAliveSetting):
 * Still's App info, the battery list, the maker's autostart list, MIUI's other
 * permissions (pop-ups), or Recents. Each falls back to Still's App info.
 */
export type KeepAliveTarget = "appInfo" | "battery" | "autostart" | "popups" | "recents";

export type OemTip = LocalizedTip & {
  opens: KeepAliveTarget;
  /** The phone reports this one itself (Xiaomi's Autostart): shown as a check, not a tip. */
  reported?: "autostart";
};

export type OemGuidance = {
  key: OemKey;
  /** Human name for the maker, or empty for generic. */
  name: string;
  tips: OemTip[];
};

const GENERIC_TIP: OemTip = {
  en: "Let Still keep running in the background and don't optimize its battery.",
  es: "Deja que Still siga en segundo plano y no optimices su batería.",
  opens: "battery",
};

const OEM_TIPS: Record<Exclude<OemKey, "generic">, { name: string; tips: OemTip[] }> = {
  xiaomi: {
    name: "Xiaomi",
    // Autostart is in Security's list (HyperOS 3 dropped it from the app
    // info); the battery saver is in Still's app info. Without Autostart,
    // closing Still from Recents leaves the pause off until its switch goes
    // off and on; with it, Android brings Still back in a second. Locking
    // Still in Recents does not help: HyperOS still closes a locked card that
    // is swiped (docs/android-parity-plan.md §13, §15).
    tips: [
      {
        en: "Turn on «Autostart» for Still: find Still in the list and switch it on.",
        es: "Activa «Inicio automático» para Still: búscalo en la lista y enciende su interruptor.",
        opens: "autostart",
        reported: "autostart",
      },
      {
        en: "Set its battery saver to No restrictions.",
        es: "Pon su ahorro de batería en «Sin restricciones».",
        opens: "appInfo",
      },
      {
        en: "Allow it to show pop-up windows while running in the background.",
        es: "Permítele mostrar ventanas emergentes mientras está en segundo plano.",
        opens: "popups",
      },
    ],
  },
  samsung: {
    name: "Samsung",
    tips: [
      {
        en: "Remove Still from apps that are put to sleep.",
        es: "Saca a Still de las apps que se ponen en suspensión.",
        // App info › Battery › Unrestricted takes it off the sleeping list.
        opens: "appInfo",
      },
      {
        en: "Turn off battery optimization for it.",
        es: "Desactiva la optimización de batería para ella.",
        opens: "battery",
      },
    ],
  },
  huawei: {
    name: "Huawei",
    tips: [
      {
        en: "Manage Still's launch yourself and keep every switch on.",
        es: "Gestiona el inicio de Still tú mismo y deja todos los interruptores activos.",
        opens: "autostart",
      },
    ],
  },
  oppo: {
    name: "Oppo",
    tips: [
      {
        en: "Allow Autostart and background running for Still.",
        es: "Permite el inicio automático y la ejecución en segundo plano de Still.",
        opens: "autostart",
      },
    ],
  },
  vivo: {
    name: "vivo",
    tips: [
      {
        en: "Allow Autostart and unrestricted battery for Still.",
        es: "Permite el inicio automático y la batería sin restricciones de Still.",
        opens: "autostart",
      },
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

/**
 * Xiaomi's Autostart as the phone reports it (StillSetup.autostartState):
 * "unknown" on other makers or when the phone does not say.
 */
export type AutostartState = "allowed" | "denied" | "unknown";

/**
 * What Still says when a Xiaomi has Autostart off: it is required, not a tip.
 * The button opens Security's Autostart list, where Still has its switch.
 */
export const AUTOSTART_NEEDED = {
  title: { en: "Turn on Autostart", es: "Activa el inicio automático" },
  body: {
    en: "Without it, if you close Still from Recents, your Xiaomi won't let it come back and the pause stops showing until you turn Still on again. With it on, Still comes back by itself in a second. Tap the button, find Still in the list and switch it on.",
    es: "Sin él, si cierras Still desde Recientes, tu Xiaomi no lo deja volver y la pausa deja de aparecer hasta que lo vuelvas a encender. Activado, Still vuelve solo en un segundo. Toca el botón, busca Still en la lista y enciende su interruptor.",
  },
  action: { en: "Turn on Autostart", es: "Activar inicio automático" },
  opens: "autostart" as KeepAliveTarget,
} as const;

/** True when the phone says Autostart is off, so Still must ask for it. */
export function needsAutostart(autostart: AutostartState | undefined): boolean {
  return autostart === "denied";
}

/**
 * The keep-alive tips still worth showing: once the phone reports Autostart,
 * its tip gives way to that state (a check, or the notice asking for it).
 */
export function tipsToShow(tips: OemTip[], autostart: AutostartState | undefined): OemTip[] {
  const reported = autostart === "allowed" || autostart === "denied";
  return reported ? tips.filter((tip) => tip.reported !== "autostart") : tips;
}

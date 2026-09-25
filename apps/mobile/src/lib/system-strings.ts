/**
 * The exact words Apple's Shortcuts and Android's Settings show, so Still can
 * quote a button the way the user sees it and draw its guide replicas in the
 * user's language. Sources (docs/ui-clarity-plan.md, appendices A and B):
 * - iOS: the iOS 26.0 runtime's `*.lproj` tables (WorkflowUI, WorkflowKit,
 *   ActionKit, WorkflowEditor, ContentKit, Shortcuts.app);
 * - Android: AOSP `android14-release` (`frameworks/base` core and
 *   `packages/apps/Settings`), `values`, `values-es`, `values-es-rUS`.
 * Spain and Latin America differ ("Ejecutar inmediatamente" vs "Ejecutar de
 * inmediato"), so Spanish comes in both variants.
 */

export type SystemVariant = "en" | "es" | "es-419";

type Entry = Record<SystemVariant, string>;

const same = (value: string): Entry => ({ en: value, es: value, "es-419": value });

/** Apple's Shortcuts (iOS 26.0). `%@` / `${…}` are filled by `systemString`. */
export const SHORTCUTS_STRINGS = {
  personalAutomation: {
    en: "Personal Automation",
    es: "Automatización personal",
    "es-419": "Automatización personal",
  },
  personalAutomationSubtitle: {
    en: "An automation that runs on your iPhone.",
    es: "Una automatización que se ejecuta en tu iPhone.",
    "es-419": "Una automatización que se ejecuta en tu iPhone.",
  },
  app: same("App"),
  appTriggerExample: {
    en: "“When “Weather” is opened or closed”",
    es: "“Al abrir o cerrar la app Tiempo”",
    "es-419": "“Cuando se abra o cierre la app Clima”",
  },
  when: { en: "When", es: "Cuando", "es-419": "Cuándo" },
  choose: { en: "Choose", es: "Seleccionar", "es-419": "Seleccionar" },
  next: { en: "Next", es: "Siguiente", "es-419": "Siguiente" },
  chooseApp: {
    en: "Choose App",
    es: "Seleccionar app",
    "es-419": "Seleccionar app",
  },
  messages: { en: "Messages", es: "Mensajes", "es-419": "Mensajes" },
  runAfterConfirmation: {
    en: "Run After Confirmation",
    es: "Ejecutar tras confirmar",
    "es-419": "Ejecutar después de confirmar",
  },
  runImmediately: {
    en: "Run Immediately",
    es: "Ejecutar inmediatamente",
    "es-419": "Ejecutar de inmediato",
  },
  notifyWhenRun: {
    en: "Notify When Run",
    es: "Notificar cuando se ejecute",
    "es-419": "Notificar al ejecutar",
  },
  isOpened: { en: "Is Opened", es: "Se abre", "es-419": "Se abra" },
  whenOpened: {
    en: "When “%@” is opened",
    es: "Al abrir la app %@",
    "es-419": "Cuando se abra %@",
  },
  getStarted: { en: "Get Started", es: "Empezar", "es-419": "Empezar" },
  createNewShortcut: {
    en: "Create New Shortcut",
    es: "Crear nuevo atajo",
    "es-419": "Crear nuevo atajo",
  },
  unknownAction: {
    en: "Unknown Action",
    es: "Acción desconocida",
    "es-419": "Acción desconocida",
  },
  searchActions: {
    en: "Search Actions",
    es: "Buscar acciones",
    "es-419": "Buscar acciones",
  },
  scripting: { en: "Scripting", es: "Scripts", "es-419": "Scripts" },
  controls: { en: "Controls", es: "Controles", "es-419": "Controles" },
  device: { en: "Device", es: "Dispositivo", "es-419": "Dispositivo" },
  cancel: { en: "Cancel", es: "Cancelar", "es-419": "Cancelar" },
  variables: same("Variables…"),
  currentApp: { en: "Current App", es: "App actual", "es-419": "App actual" },
  // The action's title. es-419 drops the article only in the card's summary
  // ("Obtener app Actual(es)"): the library lists it as "Obtener la app actual"
  // (seen in Shortcuts on the es-419 simulator, docs/ui-clarity-plan.md §10).
  getCurrentAppAction: {
    en: "Get Current App",
    es: "Obtener la app actual",
    "es-419": "Obtener la app actual",
  },
  getScopeApp: {
    en: "Get ${scope} app",
    es: "Obtener la app ${scope}",
    "es-419": "Obtener app ${scope}",
  },
  currentScope: { en: "Current", es: "Actual", "es-419": "Actual(es)" },
  sendMessage: {
    en: "Send Message",
    es: "Enviar mensaje",
    "es-419": "Enviar mensaje",
  },
  openApp: { en: "Open App", es: "Abrir app", "es-419": "Abrir app" },
  openTarget: { en: "Open ${x}", es: "Abrir ${x}", "es-419": "Abrir ${x}" },
  newShortcutN: {
    en: "New Shortcut 6",
    es: "Nuevo atajo 6",
    "es-419": "Nuevo atajo 6",
  },
  rename: { en: "Rename", es: "Renombrar", "es-419": "Renombrar" },
  chooseIcon: {
    en: "Choose Icon",
    es: "Seleccionar icono",
    "es-419": "Seleccionar ícono",
  },
  duplicate: { en: "Duplicate", es: "Duplicar", "es-419": "Duplicar" },
  move: { en: "Move", es: "Trasladar", "es-419": "Transferir" },
  addToHomeScreen: {
    en: "Add to Home Screen",
    es: "Añadir a pantalla de inicio",
    "es-419": "Agregar a pantalla de inicio",
  },
  alwaysAllow: {
    en: "Always Allow",
    es: "Permitir siempre",
    "es-419": "Permitir siempre",
  },
  noActions: { en: "No Actions", es: "Sin acciones", "es-419": "No hay acciones" },
  automation: {
    en: "Automation",
    es: "Automatización",
    "es-419": "Automatización",
  },
  fitness: same("Fitness"),
  /** Still's own action (D12), translated in ios/Still/Localizable.xcstrings. */
  stillAction: {
    en: "Pause Before Opening",
    es: "Pausar antes de abrir",
    "es-419": "Pausar antes de abrir",
  },
  stillSummaryPrefix: {
    en: "Pause before opening",
    es: "Pausar antes de abrir",
    "es-419": "Pausar antes de abrir",
  },
  appNameParam: { en: "App name", es: "Nombre de la app", "es-419": "Nombre de la app" },
} satisfies Record<string, Entry>;

/** Android 14 Settings (Pixel), `values` / `values-es` / `values-es-rUS`. */
export const ANDROID_SETTINGS_STRINGS = {
  downloadedApps: {
    en: "Downloaded apps",
    es: "Aplicaciones descargadas",
    "es-419": "Apps descargadas",
  },
  off: { en: "Off", es: "Desactivado", "es-419": "Desactivado" },
  screenReader: {
    en: "Screen reader",
    es: "Lector de pantalla",
    "es-419": "Lector de pantalla",
  },
  useService: { en: "Use ${app}", es: "Usar ${app}", "es-419": "Usar ${app}" },
  enableServiceTitle: {
    en: "Allow ${app} to have full control of your device?",
    es: "¿Permitir que ${app} pueda controlar totalmente tu dispositivo?",
    "es-419": "¿Deseas permitir que ${app} tenga el control total del dispositivo?",
  },
  warningDescription: {
    en: "Full control is appropriate for apps that help you with accessibility needs, but not for most apps.",
    es: "El control total es adecuado para las aplicaciones de accesibilidad, pero no para la mayoría de las aplicaciones.",
    "es-419":
      "El control total es apropiado para las apps que te ayudan con las necesidades de accesibilidad, pero no para la mayoría de las apps.",
  },
  screenControlTitle: {
    en: "View and control screen",
    es: "Ver y controlar la pantalla",
    "es-419": "Ver y controlar la pantalla",
  },
  screenControlDescription: {
    en: "It can read all content on the screen and display content over other apps.",
    es: "Puede leer todo el contenido de la pantalla y mostrar contenido encima de otras aplicaciones.",
    "es-419":
      "Puede leer todo el contenido en la pantalla y mostrar contenido sobre otras apps.",
  },
  actionPerformTitle: {
    en: "View and perform actions",
    es: "Ver y realizar acciones",
    "es-419": "Ver y realizar acciones",
  },
  actionPerformDescription: {
    en: "It can track your interactions with an app or a hardware sensor, and interact with apps on your behalf.",
    es: "Puede registrar tus interacciones con una aplicación o un sensor de hardware, así como interactuar con las aplicaciones en tu nombre.",
    "es-419":
      "Puede realizar el seguimiento de tus interacciones con una app o un sensor de hardware, así como interactuar con las apps por ti.",
  },
  allow: { en: "Allow", es: "Permitir", "es-419": "Permitir" },
  deny: { en: "Deny", es: "Denegar", "es-419": "Rechazar" },
  // The service page under the confirmation's scrim.
  options: { en: "Options", es: "Opciones", "es-419": "Opciones" },
  shortcutTitle: {
    en: "${app} shortcut",
    es: "Acceso directo a ${app}",
    "es-419": "Combinación de accesibilidad para: ${app}",
  },
  accessibility: {
    en: "Accessibility",
    es: "Accesibilidad",
    "es-419": "Accesibilidad",
  },
  appInfo: {
    en: "App info",
    es: "Información de aplicación",
    "es-419": "Información de apps",
  },
  allowRestrictedSettings: {
    en: "Allow restricted settings",
    es: "Permitir ajustes restringidos",
    "es-419": "Permitir configuración restringida",
  },
  // Special app access → Usage access (onboarding v2, §3.2). The page was
  // renamed between releases, so each release has its own pair (see
  // usageAccessKeys): android14-, android15- and android16-release.
  usageAccess: {
    en: "Usage access",
    es: "Acceso al uso",
    "es-419": "Acceso a datos de uso",
  },
  permitUsageAccess: {
    en: "Permit usage access",
    es: "Permitir acceso al uso",
    "es-419": "Apps con acceso de uso",
  },
  permitUsageAccess15: {
    en: "Permit usage access",
    es: "Permitir acceso al uso",
    "es-419": "Permitir acceso a los datos de uso",
  },
  usageAccess16: {
    en: "App usage data",
    es: "Datos de uso de aplicaciones",
    "es-419": "Datos de uso de apps",
  },
  permitUsageAccess16: {
    en: "Permit access to app usage data",
    es: "Dar acceso a datos de uso de aplicaciones",
    "es-419": "Permitir el acceso a los datos de uso de la app",
  },
} satisfies Record<string, Entry>;

export type ShortcutsStringKey = keyof typeof SHORTCUTS_STRINGS;
export type AndroidSettingsStringKey = keyof typeof ANDROID_SETTINGS_STRINGS;

/** The Usage access page's title and switch as the phone's Android release names them. */
export function usageAccessKeys(sdkInt: number): {
  title: AndroidSettingsStringKey;
  toggle: AndroidSettingsStringKey;
} {
  if (sdkInt >= 36) return { title: "usageAccess16", toggle: "permitUsageAccess16" };
  if (sdkInt === 35) return { title: "usageAccess", toggle: "permitUsageAccess15" };
  return { title: "usageAccess", toggle: "permitUsageAccess" };
}

/**
 * Which table a phone shows. Spanish from Spain uses Apple's `es` and Android's
 * `values-es`; every other Spanish (es-419, es-MX, es-US, es-UY…) uses Apple's
 * `es_419` and Android's `values-es-rUS`. Anything else is English, like Still.
 */
export function systemVariantFor(locale: {
  languageCode?: string | null;
  languageTag?: string | null;
  languageRegionCode?: string | null;
}): SystemVariant {
  const tag = locale.languageTag ?? "";
  const language = (locale.languageCode ?? tag.split(/[-_]/)[0] ?? "").toLowerCase();
  if (language !== "es") return "en";
  const region = (
    locale.languageRegionCode ??
    tag.split(/[-_]/).find((part, index) => index > 0 && /^[A-Za-z]{2}$/.test(part)) ??
    ""
  ).toUpperCase();
  if (region === "ES" || tag.toLowerCase() === "es") return "es";
  return "es-419";
}

/** Fills `%@` and `${name}` placeholders. */
export function fillSystemString(
  template: string,
  values: Record<string, string> = {},
): string {
  return template
    .replace("%@", values.app ?? values.x ?? "")
    .replace(/\$\{(\w+)\}/g, (_, name: string) => values[name] ?? "");
}

export function shortcutsString(
  variant: SystemVariant,
  key: ShortcutsStringKey,
  values?: Record<string, string>,
): string {
  return fillSystemString(SHORTCUTS_STRINGS[key][variant], values);
}

export function androidSettingsString(
  variant: SystemVariant,
  key: AndroidSettingsStringKey,
  values?: Record<string, string>,
): string {
  return fillSystemString(ANDROID_SETTINGS_STRINGS[key][variant], values);
}

/**
 * The system labels the setup guides quote, in Latin American Spanish. Copied
 * from apps/mobile/src/lib/system-strings.ts (the `es-419` column, read from
 * iOS 26's Shortcuts and Android 14's Settings); a test keeps both in sync.
 */
export const SHORTCUTS_LABELS = {
  automation: "Automatización",
  personalAutomation: "Automatización personal",
  app: "App",
  choose: "Seleccionar",
  isOpened: "Se abra",
  runImmediately: "Ejecutar de inmediato",
  notifyWhenRun: "Notificar al ejecutar",
  next: "Siguiente",
  createNewShortcut: "Crear nuevo atajo",
  searchActions: "Buscar acciones",
  stillAction: "Pausar app",
  stillSummaryPrefix: "Pausar",
} as const;

export const ANDROID_LABELS = {
  accessibility: "Accesibilidad",
  downloadedApps: "Apps descargadas",
  useService: "Usar Still",
  allow: "Permitir",
  appInfo: "Información de apps",
  allowRestrictedSettings: "Permitir configuración restringida",
} as const;

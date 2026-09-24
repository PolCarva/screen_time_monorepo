/**
 * The long-form pages and their search copy (docs/landing-seo-plan.md,
 * section 4). One source for metadata, share images, breadcrumbs and the
 * "related" blocks.
 */
export type ContentPage = {
  path: string;
  /** The whole `<title>`, ≤ 60 characters. */
  title: string;
  /** Meta description, ≤ 155 characters. */
  description: string;
  h1: string;
  eyebrow: string;
  /** Short name for breadcrumbs and cards. */
  name: string;
  teaser: string;
  published: string;
  updated?: string;
};

const PAGES = {
  iphone: {
    path: "/configurar/iphone",
    title: "Atajos de iPhone: pausa antes de abrir Instagram | Still",
    description:
      "Crea la automatización «Cuando se abra Instagram → Pausar antes de abrir» en Atajos. Paso a paso, en dos minutos y sin bloquear tus apps.",
    h1: "Cómo poner una pausa antes de abrir Instagram en iPhone con Atajos",
    eyebrow: "Configurar · iPhone",
    name: "Configurar en iPhone",
    teaser: "La automatización de Atajos que muestra la pausa antes de cada app.",
    published: "2026-09-24",
  },
  android: {
    path: "/configurar/android",
    title: "Still en Android: cómo dar el permiso de accesibilidad",
    description:
      "Cómo activar el permiso de accesibilidad, permitir la configuración restringida y evitar que Xiaomi, Samsung o Motorola apaguen Still.",
    h1: "Cómo activar Still en Android: accesibilidad y configuración restringida",
    eyebrow: "Configurar · Android",
    name: "Configurar en Android",
    teaser: "El permiso de Accesibilidad y los ajustes de batería por marca.",
    published: "2026-09-24",
  },
  research: {
    path: "/investigacion",
    title: "Una pausa antes de abrir apps: qué dice la ciencia | Still",
    description:
      "Estudios sobre fricción, scroll infinito y uso automático del celular: por qué un segundo de pausa ayuda a decidir, y qué no sabemos todavía.",
    h1: "Qué dice la investigación sobre hacer una pausa antes de abrir una app",
    eyebrow: "Investigación",
    name: "Investigación",
    teaser: "Cuatro estudios, sus cifras y sus límites.",
    published: "2026-09-24",
  },
} satisfies Record<string, ContentPage>;

export const CONTENT_PAGES: Record<keyof typeof PAGES, ContentPage> = PAGES;

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
      "Crea la automatización «Cuando se abra Instagram → Pausar Instagram» en Atajos. Paso a paso, en dos minutos y sin bloquear tus apps.",
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
  guides: {
    path: "/guias",
    title: "Guías para usar menos el celular | Still",
    description:
      "Guías prácticas y sin culpa para usar menos Instagram, TikTok y el celular en general, con los ajustes de iPhone y Android paso a paso.",
    h1: "Guías para usar menos el celular",
    eyebrow: "Guías",
    name: "Guías",
    teaser: "Guías prácticas para usar menos el celular.",
    published: "2026-09-24",
  },
  instagram: {
    path: "/guias/usar-menos-instagram",
    title: "Cómo bloquear Instagram para no usarlo (sin borrarlo)",
    description:
      "Límite diario, Tiempo en pantalla, Bienestar digital o una pausa antes de abrir: 4 formas de usar menos Instagram en iPhone y Android.",
    h1: "Cómo bloquear Instagram para no usarlo, sin borrar tu cuenta",
    eyebrow: "Guía · Instagram",
    name: "Usar menos Instagram",
    teaser: "Cuatro formas de usar menos Instagram sin borrar tu cuenta.",
    published: "2026-09-24",
  },
  tiktok: {
    path: "/guias/ver-menos-tiktok",
    title: "Cómo dejar de ver tanto TikTok: cambios que sí funcionan",
    description:
      "Del límite de tiempo de TikTok a una pausa antes de abrir la app: ideas concretas para ver menos videos sin eliminar tu cuenta.",
    h1: "Cómo dejar de ver tanto TikTok",
    eyebrow: "Guía · TikTok",
    name: "Ver menos TikTok",
    teaser: "Ajustes de TikTok y del teléfono para ver menos videos.",
    published: "2026-09-24",
  },
  scrolling: {
    path: "/guias/dejar-de-scrollear",
    title: "Cómo dejar de scrollear: guía contra el scroll infinito",
    description:
      "Qué es el doomscrolling, por qué cuesta tanto parar y qué ajustes del celular te ayudan a cortar el scroll infinito sin depender de la fuerza de voluntad.",
    h1: "Cómo dejar de scrollear sin depender de la fuerza de voluntad",
    eyebrow: "Guía · Scroll infinito",
    name: "Dejar de scrollear",
    teaser: "Por qué cuesta parar y qué ajustes ayudan de verdad.",
    published: "2026-09-24",
  },
  lessPhone: {
    path: "/guias/usar-menos-el-celular",
    title: "Cómo dejar de usar tanto el celular: guía práctica",
    description:
      "Hábitos, ajustes de iPhone y Android y apps gratis para usar menos el celular de noche, en el trabajo o antes de dormir. Sin culpa ni rachas.",
    h1: "Cómo dejar de usar tanto el celular: guía práctica",
    eyebrow: "Guía · Hábitos",
    name: "Usar menos el celular",
    teaser: "Hábitos y ajustes para usar menos el celular, sin culpa.",
    published: "2026-09-24",
  },
  screenTime: {
    path: "/guias/reducir-tiempo-de-pantalla",
    title: "Cómo reducir el tiempo de pantalla en iPhone y Android",
    description:
      "Mira tu tiempo en pantalla, entiende qué apps lo disparan y bájalo con límites, Bienestar digital o una pausa antes de abrir. Paso a paso.",
    h1: "Cómo reducir el tiempo de pantalla en iPhone y Android",
    eyebrow: "Guía · Tiempo en pantalla",
    name: "Reducir el tiempo de pantalla",
    teaser: "Ver tu tiempo en pantalla y bajarlo, paso a paso.",
    published: "2026-09-24",
  },
  pausePoint: {
    path: "/pausa-antes-de-abrir-apps",
    title: "Pausa antes de abrir apps en cualquier Android y iPhone",
    description:
      "Android 17 trae Pause Point, pero no llega a todos los teléfonos. Así tienes una pausa antes de Instagram o TikTok en cualquier Android y en iPhone.",
    h1: "Una pausa antes de abrir apps, en cualquier Android y en iPhone",
    eyebrow: "Pausa antes de abrir",
    name: "Pausa antes de abrir apps",
    teaser: "Lo que trae Android 17 y cómo tenerlo en cualquier teléfono.",
    published: "2026-09-24",
  },
  oneSec: {
    path: "/alternativa-one-sec",
    title: "Alternativa gratis a one sec, en español | Still",
    description:
      "¿Buscas algo como one sec, pero gratis y en español? Still agrega una pausa antes de Instagram o TikTok en iPhone y Android, sin suscripción.",
    h1: "Una alternativa gratis a one sec, en español",
    eyebrow: "Comparativa",
    name: "Alternativa a one sec",
    teaser: "En qué se parecen one sec y Still, y en qué no.",
    published: "2026-09-24",
  },
  compare: {
    path: "/apps-para-dejar-el-celular",
    title: "Apps para dejar de usar el celular: comparativa 2026",
    description:
      "Opal, one sec, ScreenZen, Forest, Bienestar digital y Still: precio, si bloquean o pausan, privacidad y si funcionan en iPhone y Android.",
    h1: "Las mejores apps para dejar de usar tanto el celular (2026)",
    eyebrow: "Comparativa 2026",
    name: "Apps para dejar el celular",
    teaser: "Siete apps comparadas: precio, método y privacidad.",
    published: "2026-09-24",
  },
  calculator: {
    path: "/calculadora-tiempo-de-pantalla",
    title: "Calculadora: ¿cuántos años pasarás en el celular? | Still",
    description:
      "Pon tus horas diarias de pantalla y tu edad: te mostramos cuánto suma en días y años, y cuánto recuperas con 30 minutos menos al día.",
    h1: "¿Cuántos años de tu vida pasarás en el celular?",
    eyebrow: "Calculadora",
    name: "Calculadora de tiempo de pantalla",
    teaser: "Tus horas diarias, convertidas en días y años.",
    published: "2026-09-24",
  },
} satisfies Record<string, ContentPage>;

export const CONTENT_PAGES: Record<keyof typeof PAGES, ContentPage> = PAGES;

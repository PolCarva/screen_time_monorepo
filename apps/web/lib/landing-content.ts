/**
 * Copy that the home page shows and also sends as structured data, so both
 * always say the same thing (docs/landing-seo-plan.md, D9 and D17).
 */

export type Study = {
  id: 1 | 2 | 3 | 4;
  source: string;
  title: string;
  claim: string;
  detail: string;
  url: string;
  linkLabel: string;
  /** For the ScholarlyArticle citation. */
  citation: { name: string; author: string; datePublished: string; publisher: string };
};

export const STUDIES: Study[] = [
  {
    id: 1,
    source: "PNAS · 2023 · Max Planck / Heidelberg",
    title:
      "Una pausa con opción de salir redujo 57 % las aperturas en seis semanas.",
    claim: "57 %",
    detail:
      "Experimento de campo con 280 personas y otro controlado con 500. En 36 % de los intentos, la persona cerró la app tras la pausa.",
    url: "https://www.pnas.org/doi/10.1073/pnas.2213114120",
    linkLabel: "Leer el estudio",
    citation: {
      name: "Directing smartphone use through the self-nudge app one sec",
      author: "Grüning, D. J.; Riedel, F.; Lorenz-Spreen, P.",
      datePublished: "2023",
      publisher: "Proceedings of the National Academy of Sciences",
    },
  },
  {
    id: 2,
    source: "Autoridad de Competencia de Dinamarca · 2025",
    title:
      "Una espera de seis segundos bajó más de un tercio el uso diario de redes.",
    claim: "−⅓",
    detail:
      "269 jóvenes de 13 a 17 años durante seis semanas: 31–36 % menos actividad, 40 % menos en horario escolar y hasta 16 minutos más de sueño.",
    url: "https://en.kfst.dk/analyser/kfst/publikationer/engelsk/2025/20250619-disrupting-social-media-habits-a-field-experiment-with-young-danish-consumers",
    linkLabel: "Leer el informe",
    citation: {
      name: "Disrupting social media habits — a field experiment with young Danish consumers",
      author: "Danish Competition and Consumer Authority",
      datePublished: "2025-06-19",
      publisher: "Konkurrence- og Forbrugerstyrelsen",
    },
  },
  {
    id: 3,
    source: "Computers in Human Behavior · 2021 · LSE",
    title: "El 89 % de las interacciones con el teléfono las inicia la persona.",
    claim: "89 %",
    detail:
      "1.130 interacciones de 37 personas grabadas en su vida real: solo 11 % las inició una notificación.",
    url: "https://eprints.lse.ac.uk/107820/",
    linkLabel: "Leer el estudio",
    citation: {
      name: "Why are smartphones disruptive? An empirical study of smartphone use in real-life contexts",
      author: "Heitmayer, M.; Lahlou, S.",
      datePublished: "2021",
      publisher: "Computers in Human Behavior",
    },
  },
  {
    id: 4,
    source: "CHI '24 · LMU Múnich",
    title:
      "Las fricciones cortas vuelven más intencionales las aperturas con el tiempo.",
    claim: "13 sem.",
    detail:
      "Datos de 1.039 personas durante 13,4 semanas en promedio y encuesta a 249 de ellas.",
    url: "https://dl.acm.org/doi/10.1145/3613904.3642370",
    linkLabel: "Leer el estudio",
    citation: {
      name: "A Longitudinal In-the-Wild Investigation of Design Frictions to Prevent Smartphone Overuse",
      author: "Haliburton, L.; Grüning, D. J.; Riedel, F.; Schmidt, A.; Terzimehić, N.",
      datePublished: "2024",
      publisher: "Proceedings of the CHI Conference on Human Factors in Computing Systems",
    },
  },
];

/** Said wherever a study figure appears (D17). */
export const STUDIES_DISCLAIMER =
  "Estudios independientes sobre pausas antes de abrir una app, hechos con otras herramientas (sobre todo one sec) o sobre el uso del teléfono en general. Still aplica el mismo principio y todavía no tiene un estudio propio.";

export type FaqEntry = {
  question: string;
  answer: string;
  link?: { href: string; label: string };
};

export const HOME_FAQ: FaqEntry[] = [
  {
    question: "¿Still bloquea mis apps?",
    answer:
      "No. Still pone una pausa antes de abrirlas. Desde ahí vuelves con un toque, o entras por el tiempo que elijas. Siempre puedes entrar.",
  },
  {
    question: "¿Cómo funciona en iPhone?",
    answer:
      "Con una automatización personal de Atajos: «Cuando se abra [app] → Pausar antes de abrir». Still te guía paso a paso y nunca crea, edita ni lee tus automatizaciones.",
  },
  {
    question: "¿Por qué Still pide Accesibilidad en Android?",
    answer:
      "Solo para saber cuándo se abre una de las apps que elegiste y mostrar la pausa, y para cerrar un video flotante que la tape. No lee lo que escribes ni lo que ves.",
  },
  {
    question: "¿Qué datos salen de mi teléfono?",
    answer:
      "Los nombres de las apps que eliges y tu historial detallado se quedan en el teléfono. Solo compartimos conteos generales necesarios para los pases, el fondo de impacto y el funcionamiento.",
  },
  {
    question: "¿Es gratis?",
    answer:
      "Sí. No hay suscripción. Los anuncios son opcionales: aparecen solo si decides entrar, y el 80 % de su ingreso se dona a un proyecto que elige la comunidad.",
  },
  {
    question: "¿Cómo sé que la donación llega?",
    answer:
      "Cada semana publicamos cuánto se reunió (estimado y luego confirmado por AdMob), qué proyecto ganó la votación y el comprobante de la donación en la página de Impacto.",
    link: { href: "/impacto", label: "Ver el registro de impacto" },
  },
  {
    question: "¿Qué pasa si no hay anuncio disponible?",
    answer:
      "Nunca quedas bloqueado. Si no hay anuncio ni un pase guardado, una pausa breve te deja entrar igual.",
  },
  {
    question: "¿Necesito crear una cuenta?",
    answer:
      "No. Tu cuenta es anónima. Iniciar sesión con Apple o Google solo sirve para votar el proyecto de la semana y recuperar tu cuenta en otro teléfono.",
  },
  {
    question: "¿Cómo dejo de usar Still?",
    answer:
      "En iPhone, borra la automatización en Atajos. En Android, desactiva Still en Accesibilidad o desinstala la app. Puedes borrar tu cuenta y tus datos desde Ajustes → Privacidad.",
    link: { href: "/eliminar-cuenta", label: "Cómo eliminar tu cuenta" },
  },
];

export const HOME_DESCRIPTION =
  "Un segundo de pausa antes de abrir Instagram, TikTok o YouTube. Sin bloqueos ni rachas. Gratis en iPhone y Android, y el 80 % de los anuncios se dona.";

import { STORES } from "@/lib/site";

export type NavLink = { href: string; label: string; external?: boolean };

/** Header links: the home sections and the pages people look for. */
export const HEADER_LINKS: NavLink[] = [
  { href: "/#como-funciona", label: "Cómo funciona" },
  { href: "/guias", label: "Guías" },
  { href: "/impacto", label: "Impacto" },
  { href: "/#preguntas", label: "Preguntas" },
];

export const FOOTER_COLUMNS: { title: string; links: NavLink[] }[] = [
  {
    title: "Empezar",
    links: [
      { href: STORES.ios.url, label: "Still en App Store", external: true },
      { href: STORES.android.url, label: "Still en Google Play", external: true },
      { href: "/#como-funciona", label: "Cómo funciona" },
    ],
  },
  {
    title: "Guías",
    links: [
      { href: "/guias/usar-menos-el-celular", label: "Usar menos el celular" },
      { href: "/guias/reducir-tiempo-de-pantalla", label: "Reducir el tiempo de pantalla" },
      { href: "/guias/dejar-de-scrollear", label: "Dejar de scrollear" },
      { href: "/guias/usar-menos-instagram", label: "Usar menos Instagram" },
      { href: "/guias/ver-menos-tiktok", label: "Ver menos TikTok" },
      { href: "/pausa-antes-de-abrir-apps", label: "Pausa antes de abrir apps" },
      { href: "/apps-para-dejar-el-celular", label: "Apps para dejar el celular" },
      { href: "/alternativa-one-sec", label: "Alternativa a one sec" },
      { href: "/calculadora-tiempo-de-pantalla", label: "Calculadora de tiempo de pantalla" },
    ],
  },
  {
    title: "Ayuda",
    links: [
      { href: "/#preguntas", label: "Preguntas frecuentes" },
      { href: "/configurar/iphone", label: "Configurar en iPhone" },
      { href: "/configurar/android", label: "Configurar en Android" },
      { href: "/soporte", label: "Soporte" },
      { href: "/eliminar-cuenta", label: "Eliminar cuenta" },
    ],
  },
  {
    title: "Still",
    links: [
      { href: "/impacto", label: "Impacto" },
      { href: "/investigacion", label: "Investigación" },
      { href: "/privacy", label: "Privacidad" },
      { href: "/terms", label: "Términos" },
    ],
  },
];

import { STORES } from "@/lib/site";

export type NavLink = { href: string; label: string; external?: boolean };

/** Header links: the home sections and the pages people look for. */
export const HEADER_LINKS: NavLink[] = [
  { href: "/#como-funciona", label: "Cómo funciona" },
  { href: "/#investigacion", label: "Investigación" },
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
    title: "Ayuda",
    links: [
      { href: "/#preguntas", label: "Preguntas frecuentes" },
      { href: "/soporte", label: "Soporte" },
      { href: "/eliminar-cuenta", label: "Eliminar cuenta" },
    ],
  },
  {
    title: "Still",
    links: [
      { href: "/impacto", label: "Impacto" },
      { href: "/#investigacion", label: "Investigación" },
      { href: "/privacy", label: "Privacidad" },
      { href: "/terms", label: "Términos" },
    ],
  },
];

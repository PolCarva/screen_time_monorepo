/**
 * The public pages, for the sitemap. `lastModified` is the day the content
 * last changed in a way worth recrawling; bump it with the edit.
 */
export type PublicRoute = { path: string; lastModified: string };

export const PUBLIC_ROUTES: PublicRoute[] = [
  { path: "/", lastModified: "2026-09-24" },
  { path: "/impacto", lastModified: "2026-09-24" },
  { path: "/configurar/iphone", lastModified: "2026-09-24" },
  { path: "/configurar/android", lastModified: "2026-09-24" },
  { path: "/investigacion", lastModified: "2026-09-24" },
  { path: "/guias", lastModified: "2026-09-24" },
  { path: "/guias/usar-menos-el-celular", lastModified: "2026-09-24" },
  { path: "/guias/reducir-tiempo-de-pantalla", lastModified: "2026-09-24" },
  { path: "/guias/dejar-de-scrollear", lastModified: "2026-09-24" },
  { path: "/guias/usar-menos-instagram", lastModified: "2026-09-24" },
  { path: "/guias/ver-menos-tiktok", lastModified: "2026-09-24" },
  { path: "/pausa-antes-de-abrir-apps", lastModified: "2026-09-24" },
  { path: "/apps-para-dejar-el-celular", lastModified: "2026-09-24" },
  { path: "/alternativa-one-sec", lastModified: "2026-09-24" },
  { path: "/soporte", lastModified: "2026-09-23" },
  { path: "/privacy", lastModified: "2026-09-23" },
  { path: "/terms", lastModified: "2026-09-23" },
  { path: "/eliminar-cuenta", lastModified: "2026-09-23" },
];

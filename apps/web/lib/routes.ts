/**
 * The public pages, for the sitemap. `lastModified` is the day the content
 * last changed in a way worth recrawling; bump it with the edit.
 */
export type PublicRoute = { path: string; lastModified: string };

export const PUBLIC_ROUTES: PublicRoute[] = [
  { path: "/", lastModified: "2026-09-24" },
  { path: "/impacto", lastModified: "2026-09-24" },
  { path: "/soporte", lastModified: "2026-09-23" },
  { path: "/privacy", lastModified: "2026-09-23" },
  { path: "/terms", lastModified: "2026-09-23" },
  { path: "/eliminar-cuenta", lastModified: "2026-09-23" },
];

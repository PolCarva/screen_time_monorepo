import { CONTENT_PAGES } from "@/lib/content-pages";
import { HOME_DESCRIPTION } from "@/lib/landing-content";
import { STORES, storeNote } from "@/lib/site";
import { absoluteUrl } from "@/lib/structured-data";

// A plain summary for AI assistants and search tools (docs/landing-seo-plan.md,
// D22). Google does not use it; it costs nothing to keep.
export const dynamic = "force-static";

export function GET() {
  const pages = Object.values(CONTENT_PAGES)
    .map((page) => `- [${page.h1}](${absoluteUrl(page.path)}): ${page.description}`)
    .join("\n");
  const body = `# Still

> ${HOME_DESCRIPTION}

Still es una app gratis para iPhone y Android que muestra una pausa de un
segundo antes de las apps que la persona elige (Instagram, TikTok, YouTube…).
Desde la pausa se vuelve con un toque o se entra por el tiempo que se elija,
viendo un anuncio opcional. El 80 % del ingreso de esos anuncios va a un fondo
semanal que la comunidad vota y dona, con comprobante público. No bloquea
apps, no usa rachas ni puntajes, y los nombres de las apps se quedan en el
teléfono. En iPhone funciona con una automatización personal de Atajos; en
Android, con el servicio de Accesibilidad.

Estado: ${storeNote()}

## Páginas

- [Inicio](${absoluteUrl("/")}): qué es Still y cómo funciona.
- [Impacto](${absoluteUrl("/impacto")}): el fondo semanal en vivo, votos y comprobantes.
${pages}

## Tiendas

- App Store: ${STORES.ios.url}
- Google Play: ${STORES.android.url}
`;
  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

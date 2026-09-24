# Landing v2 y SEO

Escrito el 2026-09-24. Pedido del usuario: rehacer la landing con el diseño
v2 del canvas, agregar animaciones sutiles y hacer todo el SEO posible para
llegar alto en Google lo antes posible, a partir de una investigación de la
competencia y de las búsquedas en español.

- Diseño aprobado: canvas https://claude.ai/artifact/7eaY7jzcbDieGHTuGyJbKd,
  página **"Versión 2 · impacto"**. Copia del código de los tableros en
  `docs/landing-v2/design/V2-*.dc.html` (HTML de referencia; no se sirve).
- La implementación la hace una sesión aparte con el prompt de la sección 10.
  Esa sesión **no reabre** las decisiones de la sección 3.

## 1. Estado actual (medido el 2026-09-24)

| Hecho | Evidencia |
|---|---|
| La web vive en `screen-time-monorepo-web.vercel.app`, sin dominio propio | robots.txt y sitemap en prod |
| `metadataBase` cae a `https://still.app` (dominio ajeno) si falta `NEXT_PUBLIC_APP_URL`; en prod la variable está puesta | `app/layout.tsx`, `robots.ts`, `sitemap.ts` |
| Sin canonical, sin `og:image`, sin `og:url`; las subpáginas heredan el OG de la home (merge superficial) | `/privacy` en prod muestra el `og:title` de la home |
| Sin JSON-LD, sin `viewport` export, sin `apple-icon`, manifest solo con SVG | código |
| La home es `force-dynamic`: `cache-control: private, no-store`, TTFB 0,7–0,9 s (páginas estáticas 0,2–0,4 s) | 3 muestras en prod |
| 4 TTF estáticos de Recursive (~95 KB brotli c/u) precargados en cada página | `layout.tsx` |
| PNG de 2,1–2,2 MB en la landing actual | `public/images/v3/` |
| Sitemap con 6 URLs y sin `lastModified` | prod |
| `globals.css` de 1.882 líneas mezcla landing vieja, `/impact`, legales y admin | `app/globals.css` |
| El formulario de aviso solo manda `platform: "android"`; la tabla ya acepta `ios`, `android`, `both` | `beta-signup-form.tsx`, migración `202608300001` |
| `lib/impact.ts` ya trae `allTime.donatedMinor`, `people`, `minutesReturned`, `rewardedAds` | `getCurrentImpactWeek()` |
| La app móvil no enlaza a `/impact` de la web: renombrar la ruta no rompe nada | grep en `apps/mobile` |

## 2. Investigación

### 2.1 Competencia (13 sitios auditados con curl el 2026-09-24)

| Sitio | Qué hace bien | Qué hace mal | Español |
|---|---|---|---|
| one sec | Página de investigación (PNAS 2023, CHI 2024, estudio danés 2025); SoftwareApplication con rating; blog; página sobre Pause Point de Android 17 | Blog "/es/" con texto en inglés y canonical al inglés; hreflang solo en el sitemap | Solo la home y ~18 páginas estáticas |
| Opal (opalapp.com) | 650 URLs: blog, 23 páginas `/screentime/*`, comparativas "opal-vs-X", informe anual de datos | Canonical y hreflang apuntan a un dominio que redirige; la descripción omite Android; sin JSON-LD en la home | No (solo francés) |
| ScreenZen | Rankea #1 en "screen time app that works" con "gratis, sin suscripción, financiado por donaciones" y ~30K ratings | Sin H1, SEO on-page débil | No |
| Freedom | 669 URLs: páginas "/how-to/block-X-on-Y", comparativas, quiz, FAQPage, Organization con sameAs | — | No |
| AppBlock | Una guía por app ("how-to-block-instagram…"), 161 FAQs indexables, páginas por keyword | — | No |
| Jomo, Forest, minimalist phone, StayFree | SoftwareApplication/MobileApplication con AggregateRating; Forest deja pasar a los crawlers de IA y publica `llms-full.txt` | Clearspace renderiza en cliente (900 caracteres de HTML); Brick, Jomo y Unpluq con H1 duplicado o incorrecto | No |

Qué rankea hoy en español (buscador de EE. UU.; confirmar en Search Console):

- "app para dejar el celular", "app para reducir tiempo de pantalla": listas
  de medios de 2018–2021 (BioBioChile, PantallasAmigas, Androidphoria) y
  fichas de App Store/Play. **Ninguna landing de app compite en español.**
- "alternativa a one sec": no hay ni una página en español.
- "app pausa antes de abrir instagram": **solo noticias de "Pause Point", la
  función de Android 17** (Xataka Móvil, Hipertextual, Infobae 2026-05-12).
  Ninguna app responde "cómo tenerlo en mi Android o en iPhone".
- "bloquear apps android gratis": la intención es bloquear con PIN o huella.
  Still no debe apuntar ahí.

### 2.2 Keywords (≈2.100 consultas a Google Autocomplete, mx/ar/co/es, y 24 SERP)

Volúmenes relativos (no hay herramienta paga): A = alto, M = medio, B = bajo.

| Búsqueda | Demanda | Dificultad | Nota |
|---|---|---|---|
| tiempo de pantalla / reducir tiempo de pantalla | A | M–A | Medios grandes |
| como dejar de usar tanto el celular (…en la noche, antes de dormir) | A | M–A | Infobae, psicologiaymente, Quora |
| app para dejar de usar el celular / usar menos el celular | M | M | Listas + tiendas |
| como bloquear instagram para no usarlo (por horas, temporalmente) | M | M | |
| como dejar de ver tanto tiktok / limitar tiempo tiktok | M | B–M | |
| como dejar de scrollear / app para dejar de scrollear / doomscrolling | M | M (la versión "app" es B: solo fichas de tiendas) | |
| como bloquear apps con atajos / atajos iphone automatización | M | B–M | **Quick win**: todos muestran "Bloquear", nadie muestra una pausa |
| permiso de accesibilidad android / permitir configuración restringida + marca | M | B por marca | **Quick win**: foros y posts flacos |
| one sec en español / es gratis / para android / es seguro | B | B | **Quick win**: sin reseñas en español |
| opal app español / precio / para android | B–M | B–M | "Opal" choca con el app builder de Google |
| app que dona a caridad (… en uruguay) / apps que donan a caridad | B | B | **Quick win** para `/impacto` |
| pausa antes de abrir redes sociales (estudio) | B | B | Solo rankea one-sec.app/es |
| pause point android / iphone | M (noticia reciente) | B–M | Solo noticias |

Evitar o tratar con cuidado: "adicción al celular tratamiento/síntomas",
"nomofobia", "curar" (temas de salud; Google exige más confianza y sería un
reclamo médico); "apps que donan dinero" (significa apps que pagan);
"dejar el celular" suelto (cargarlo, arroz); "pausa consciente" (mindfulness
escolar); "brain rot" (memes). Palabras: **"celular"** en el texto principal
(14 autocompletados contra 4 de "móvil"), "móvil/teléfono" una vez por
página; "Tiempo en pantalla" (LatAm) y "Tiempo de uso" (España);
"configuración restringida" (LatAm) y "ajustes restringidos" (España);
tuteo, sin voseo ni vosotros.

### 2.3 SEO técnico (Google Search Central y docs de Next 16.3.2 en `node_modules/next/dist/docs`, septiembre 2026)

- **hreflang**: Google no acepta `es-419` y un sitio de un solo idioma no lo
  necesita. `lang="es-419"` en `<html>` sí (accesibilidad).
- **Datos estructurados vigentes**: SoftwareApplication/MobileApplication
  exige `aggregateRating` o `review` para el rich result (sin ratings reales
  no hay rich result; nunca inventarlos). Organization y WebSite en la home
  (nombre del sitio en resultados). **FAQ rich results: retirados el
  2026-05-08. HowTo: retirado.** VideoObject solo con video real y página
  donde se vea. Breadcrumbs: solo escritorio.
- **Core Web Vitals (p75)**: LCP ≤ 2,5 s, INP < 200 ms, CLS < 0,1.
- **ISR**: quitar `force-dynamic` y usar `export const revalidate = 300`
  (literal). Si el loader lanza un error, ISR sigue sirviendo la última
  versión buena; si devuelve un estado "error", lo cachea 5 minutos.
- **CSP**: el JSON-LD no necesita cambios (es un bloque de datos, no se
  ejecuta). Video: servirlo desde `/public` (`media-src 'self'`). No usar
  nonces: forzarían render dinámico.
- **Animaciones**: nunca animar la opacidad del elemento LCP desde 0 (Chrome
  lo ignora como candidato y el LCP se atrasa). `animation-timeline: view()`
  funciona en Chrome/Edge 115+ y Safari 26+; en Firefox el contenido queda
  estático.
- **IA**: Google no usa `llms.txt` (inofensivo para otros). ChatGPT Search
  necesita `OAI-SearchBot` permitido (hoy lo está con `User-Agent: *`).
- **IndexNow**: Bing, Yandex, Naver y otros (no Google). Bing alimenta a
  ChatGPT Search. No hay integración de Vercel: un script basta.
- Smart App Banner: `metadata.itunes.appId`, solo cuando la app esté
  publicada. Twitter pasa a `summary_large_image` solo al haber imagen OG.

## 3. Decisiones

| # | Decisión |
|---|---|
| D1 | **Copy de la v2** del canvas ("Una pausa que suma"), con los ajustes SEO de esta tabla. La v1 queda en el canvas como referencia. |
| D2 | **Solo insignias oficiales** de App Store ("Descárgalo en el App Store") y Google Play ("Disponible en Google Play"). El APK sale de la landing (sigue en GitHub Releases). `components/android-download-link.tsx` se borra si queda sin uso. |
| D3 | Estado de las tiendas en un solo lugar (`lib/site.ts`): iOS `review` → `live`, Android `closed` → `live`. De ahí salen la línea bajo las insignias, el Smart App Banner (solo iOS `live`) y `installUrl`/`sameAs` del JSON-LD (solo tiendas `live`). |
| D4 | **Un solo idioma**: español latinoamericano, `<html lang="es-419">`, sin hreflang, `og:locale` `es_LA`. Inglés queda fuera de este plan. |
| D5 | **URL base única** `SITE_URL` en `lib/site.ts` desde `NEXT_PUBLIC_APP_URL`; se borra el fallback `still.app`. En `VERCEL_ENV=production` sin la variable, el build falla. El dominio propio es un paso del usuario (U1); el código no cambia al conectarlo. |
| D6 | **H1 con keyword**: la etiqueta pequeña del hero pasa a ser el `<h1>` visible "Still · App gratis para usar menos el celular" (mismo estilo mono). "Un segundo antes de entrar." queda como línea display en un `<p>`. Sin texto oculto. "Una pausa que suma" pasa al inicio del párrafo del hero. |
| D7 | Home con **ISR** (`revalidate = 300`). En `lib/impact.ts`, los errores transitorios (consulta fallida) **lanzan** (ISR sirve la última versión buena); `unconfigured` y `empty` siguen devolviendo estado (build de CI sin Supabase, semana sin datos). `/impacto` igual si no depende del usuario. |
| D8 | **Rutas**: `/impact` → `/impacto` (redirección permanente en `next.config.ts`); `/privacy`, `/terms`, `/soporte`, `/eliminar-cuenta` quedan (las fichas de las tiendas las usan). Páginas nuevas en la sección 4. |
| D9 | **JSON-LD** con un helper tipado (`lib/structured-data.ts`, escapa `<`): home = Organization + WebSite + MobileApplication (sin rating, `offers` precio 0, `operatingSystem` "Android 10+, iOS 16.4+") + FAQPage (sin rich result en Google, lo usan Bing y los LLM; mismo texto que la FAQ visible). Guías, configuración y comparativas = Article (`datePublished`, `dateModified`, `author`/`publisher` = Organization Still) + BreadcrumbList. `/investigacion` = Article con `citation` (ScholarlyArticle) de los 4 estudios. Sin HowTo ni VideoObject hasta tener videos reales en una página propia. AggregateRating solo con ratings reales de las tiendas mostrados en la página. |
| D10 | **FAQ con `<details>`/`<summary>` nativos** (sin JS, indexable). La apertura se anima con `::details-content` + `interpolate-size` donde exista; si no, abre sin animación. |
| D11 | "Cómo funciona": los pasos de Android **y** de iPhone van en el HTML del servidor; un componente cliente chico alterna cuál se ve (atributo `hidden`, `aria-pressed`). Todo lo demás son Server Components. |
| D12 | **Fuente**: `next/font/google` Recursive variable, `subsets: ["latin"]`, `axes: ["MONO", "CASL"]`, `display: "swap"`. Se van los 4 TTF y `@expo-google-fonts/recursive` de `apps/web`. |
| D13 | **CSS**: un CSS Module por componente de la landing (`components/landing/*.module.css`); `tokens.css` queda; `globals.css` conserva base, botones, páginas legales, `/impacto` y admin, y pierde todas las clases de la landing vieja (`hero-v3`, `observed-section`, `sequence-*`, `product-*`, `impact-section-v3`, `care-*`, `closing-v3`, `intervention-demo`, etc.). |
| D14 | **Animaciones sutiles, sin loops** (principio de marca: "sin animación en loop"), todas dentro de `@media (prefers-reduced-motion: no-preference)` y solo con `transform`/`opacity`: (1) hero: las barras de la fila central se abren una vez al cargar (520 ms, `--ease-out`) y el teléfono sube 12 px con fundido; el `<h1>` y la línea display **no se animan**; (2) el campo de atención dentro del teléfono usa los keyframes existentes (`field-left`/`field-right`); (3) aparición al hacer scroll: bloques con `translateY(16px)` → 0 y opacidad, con `animation-timeline: view()` dentro de `@supports`, **visibles por defecto**; (4) cambio Android/iPhone: fundido de 200 ms; (5) FAQ: ver D10; (6) insignias y botones: `translateY(-1px)` en hover, 120 ms. Sin contadores animados (los números van en el HTML), sin pulso en el punto "en vivo", sin librerías. |
| D15 | **Videos**: `PhoneVideo` muestra el teléfono en markup como póster; el botón "Video · 0:12" aparece **solo** si el archivo existe en `lib/site.ts` (`videos.pause`, `videos.chooseApps`, `videos.androidSetup`, `videos.iosSetup`, hoy `null`). Al tocarlo, `<video controls playsInline preload="none">` desde `/public/videos` con ancho y alto fijos. Grabarlos es U3. |
| D16 | **Formulario de aviso**: "¿Te avisamos?" con selector iPhone / Android / Los dos → la API acepta `ios`, `android`, `both` (sin migración). Consentimiento y trampa anti-bots como hoy. Tests actualizados. |
| D17 | **Afirmaciones**: toda cifra de estudios lleva su referencia y el aviso de que midieron otra app (one sec) o el uso del teléfono en general, no Still. Nada de "cura", "tratamiento" ni "adicción" como diagnóstico: "uso automático", "hábito", "uso excesivo". Los datos en vivo salen de `allTime` y de la semana actual; sin datos, se muestra un texto neutro ("Se publica al cerrar la primera semana"), nunca un cero engañoso ni un número inventado. |
| D18 | **Comparativas honestas**: precios y funciones de terceros verificados en su web el día que se escribe, con fecha "Actualizado: septiembre de 2026" y fuentes enlazadas. Marcas solo de forma descriptiva: sin logos ni nada que sugiera alianza. Se reconoce en qué gana cada una (p. ej., one sec tiene estudios propios y extensión de navegador). |
| D19 | **Contenido en TSX**, sin MDX: cada guía es una página con el layout compartido `components/content/article.tsx` (migas, fecha, índice, CTA con insignias, relacionadas). Metadatos por página con un helper `pageMetadata()` que arma canonical y un `openGraph` completo. |
| D20 | **Imagen OG** por plantilla (`opengraph-image.tsx` con `ImageResponse`, 1200×630, TTF de Recursive incluido): una para la home y una genérica para guías que recibe el título. Sin números en vivo (quedan congelados en el build). |
| D21 | **Sin analítica nueva** (marca privada): se mide con Search Console, Bing Webmaster y PageSpeed. |
| D22 | **Rastreo**: `robots.ts` permite todo salvo `/admin` y `/api`, incluidos los bots de IA. `public/llms.txt` con qué es Still y las URLs principales. IndexNow con un script `pnpm --filter web indexnow` que manda las URLs del sitemap. |
| D23 | Página 404 propia (`app/not-found.tsx`) con enlaces a la home, las guías y la configuración. |
| D24 | Autor visible "Equipo de Still" (Organization). Una página "Quién hace Still" solo si el usuario da el texto (U8). |

## 4. Mapa de páginas y keywords

Títulos ≤ 60 caracteres y descripciones ≤ 155 (medidos). Cada página tiene
un solo `<h1>`, canonical propio y su `openGraph` completo.

| Ruta | Keyword principal | Secundarias | `<title>` | Meta description | `<h1>` |
|---|---|---|---|---|---|
| `/` | app para dejar de usar el celular | app para usar menos el celular gratis; app para usar menos redes sociales; app para dejar de usar instagram | Still: app gratis para usar menos el celular | Un segundo de pausa antes de abrir Instagram, TikTok o YouTube. Sin bloqueos ni rachas. Gratis en iPhone y Android, y el 80 % de los anuncios se dona. | Still · App gratis para usar menos el celular |
| `/configurar/iphone` | como bloquear apps con atajos | bloquear apps iphone atajos; atajos iphone automatización de aplicaciones; como activar automatización en iphone; automatización iphone no funciona | Atajos de iPhone: pausa antes de abrir Instagram \| Still | Crea la automatización «Cuando se abra Instagram → Pausar antes de abrir» en Atajos. Paso a paso, en dos minutos y sin bloquear tus apps. | Cómo poner una pausa antes de abrir Instagram en iPhone con Atajos |
| `/configurar/android` | permiso de accesibilidad android | permitir configuración restringida (samsung, motorola, xiaomi, oppo); permitir ajustes restringidos xiaomi; accesibilidad android se desactiva; inicio automático xiaomi | Still en Android: cómo dar el permiso de accesibilidad | Cómo activar el permiso de accesibilidad, permitir la configuración restringida y evitar que Xiaomi, Samsung o Motorola apaguen Still. | Cómo activar Still en Android: accesibilidad y configuración restringida |
| `/investigacion` | pausa antes de abrir redes sociales estudio | por qué no puedo dejar de scrollear; scroll infinito psicología; dopamina redes sociales | Una pausa antes de abrir apps: qué dice la ciencia \| Still | Estudios sobre fricción, scroll infinito y uso automático del celular: por qué un segundo de pausa ayuda a decidir, y qué no sabemos todavía. | Qué dice la investigación sobre hacer una pausa antes de abrir una app |
| `/impacto` | app que dona a caridad | apps que donan a caridad; apps solidarias; donar viendo anuncios | Impacto de Still: el fondo que dona el 80 % de los anuncios | Cuánto se reunió, a qué proyectos se donó y cómo vota la comunidad cada semana. Números en vivo de una app gratis que dona lo que generan sus anuncios. | Una app que dona el 80 % de sus anuncios: el registro completo |
| `/pausa-antes-de-abrir-apps` | pausa antes de abrir instagram | pause point android; pause point iphone; android 17 pause point | Pausa antes de abrir apps en cualquier Android y iPhone | Android 17 trae Pause Point, pero no llega a todos los teléfonos. Así tienes una pausa antes de Instagram o TikTok en cualquier Android y en iPhone. | Una pausa antes de abrir apps, en cualquier Android y en iPhone |
| `/alternativa-one-sec` | alternativa gratis a one sec | one sec en español; one sec es gratis; one sec para android; apps como one sec | Alternativa gratis a one sec, en español \| Still | ¿Buscas algo como one sec, pero gratis y en español? Still agrega una pausa antes de Instagram o TikTok en iPhone y Android, sin suscripción. | Una alternativa gratis a one sec, en español |
| `/apps-para-dejar-el-celular` | apps para dejar de usar el celular | aplicaciones para dejar de usar el celular; mejores apps para dejar de scrollear; opal app español; opal para android | Apps para dejar de usar el celular: comparativa 2026 | Opal, one sec, ScreenZen, Forest, Bienestar digital y Still: precio, si bloquean o pausan, privacidad y si funcionan en iPhone y Android. | Las mejores apps para dejar de usar tanto el celular (2026) |
| `/guias` | guías para usar menos el celular | — | Guías para usar menos el celular \| Still | Guías prácticas y sin culpa para usar menos Instagram, TikTok y el celular en general, con los ajustes de iPhone y Android paso a paso. | Guías para usar menos el celular |
| `/guias/usar-menos-instagram` | como bloquear instagram para no usarlo | …por un tiempo; …por horas; limitar tiempo instagram iphone; limitar uso de instagram | Cómo bloquear Instagram para no usarlo (sin borrarlo) | Límite diario, Tiempo en pantalla, Bienestar digital o una pausa antes de abrir: 4 formas de usar menos Instagram en iPhone y Android. | Cómo bloquear Instagram para no usarlo, sin borrar tu cuenta |
| `/guias/ver-menos-tiktok` | como dejar de ver tanto tiktok | limitar tiempo tiktok; como bloquear tiktok en mi celular | Cómo dejar de ver tanto TikTok: cambios que sí funcionan | Del límite de tiempo de TikTok a una pausa antes de abrir la app: ideas concretas para ver menos videos sin eliminar tu cuenta. | Cómo dejar de ver tanto TikTok |
| `/guias/dejar-de-scrollear` | como dejar de scrollear | app para dejar de scrollear; no puedo dejar de scrollear; doomscrolling como evitarlo; scroll infinito consecuencias | Cómo dejar de scrollear: guía contra el scroll infinito | Qué es el doomscrolling, por qué cuesta tanto parar y qué ajustes del celular te ayudan a cortar el scroll infinito sin depender de la fuerza de voluntad. | Cómo dejar de scrollear sin depender de la fuerza de voluntad |
| `/guias/usar-menos-el-celular` | como dejar de usar tanto el celular | …en la noche; …antes de dormir; reducir el uso del celular; tips para usar menos el celular | Cómo dejar de usar tanto el celular: guía práctica | Hábitos, ajustes de iPhone y Android y apps gratis para usar menos el celular de noche, en el trabajo o antes de dormir. Sin culpa ni rachas. | Cómo dejar de usar tanto el celular: guía práctica |
| `/guias/reducir-tiempo-de-pantalla` | reducir tiempo de pantalla | tiempo en pantalla iphone; bienestar digital para qué sirve; como ver tiempo de pantalla en samsung | Cómo reducir el tiempo de pantalla en iPhone y Android | Mira tu tiempo en pantalla, entiende qué apps lo disparan y bájalo con límites, Bienestar digital o una pausa antes de abrir. Paso a paso. | Cómo reducir el tiempo de pantalla en iPhone y Android |
| `/calculadora-tiempo-de-pantalla` | cuántas horas es normal usar el celular | calculadora tiempo de pantalla; cuánto tiempo paso en el celular | Calculadora: ¿cuántos años pasarás en el celular? \| Still | Pon tus horas diarias de pantalla y tu edad: te mostramos cuánto suma en días y años, y cuánto recuperas con 30 minutos menos al día. | ¿Cuántos años de tu vida pasarás en el celular? |

Contenido mínimo por tipo:

- **Guías** (900–1.500 palabras): respuesta directa en el primer párrafo (sirve
  para snippets y AI Overviews), pasos con las etiquetas exactas del sistema,
  sección "Si no funciona", 3–5 preguntas frecuentes con `<details>`, bloque
  de Still al final (no al principio), 3 guías relacionadas. Datos de
  terceros verificados y enlazados.
- **Configuración**: etiquetas exactas en es-419 tomadas de
  `apps/mobile/src/lib/system-strings.ts` (Atajos y Ajustes de Android) y de
  `apps/mobile/src/lib/android-oem.ts` + `docs/android-setup.md` (Xiaomi o
  HyperOS, Samsung, Motorola, Oppo/Realme), con anclas por marca
  (`#xiaomi`, `#samsung`…). iPhone: requisitos (iOS 16.4+), una automatización
  por app, "Ejecutar de inmediato", por qué la app se ve un instante antes de
  la pausa, cómo quitarla.
- **Comparativas**: tabla (precio, pausa o bloqueo, iPhone, Android, en
  español, privacidad, qué pasa con el dinero), a favor y en contra de cada
  una, "cuándo elegir cuál", fecha de actualización.
- **Pause Point**: qué es y en qué teléfonos llega (verificado con fuentes
  enlazadas), cómo tener algo parecido en cualquier Android e iPhone.
- **Investigación**: los 4 estudios con cifra, muestra, duración, enlace y
  límites; qué no se sabe; "Still todavía no tiene un estudio propio".
- **Calculadora**: componente cliente, cálculo local (nada se guarda ni se
  envía), resultado en texto, CTA a la guía y a Still.

**Enlaces internos**: cabecera = Cómo funciona · Guías · Impacto · Preguntas ·
Descargar. Pie = Empezar (App Store, Google Play, Configurar iPhone,
Configurar Android) · Guías (5 guías, comparativa, alternativa a one sec,
pausa antes de abrir apps, calculadora) · Still (Impacto, Investigación,
Privacidad, Términos, Soporte, Eliminar cuenta). La home enlaza desde "Cómo
funciona" a las guías de configuración, desde la banda de investigación a
`/investigacion`, desde el fondo a `/impacto` y desde las respuestas de la FAQ
a las guías. Cada guía enlaza a su configuración y a 3 relacionadas.

## 5. Arquitectura

```
apps/web/
  lib/site.ts                 SITE_URL, STORES (url + estado), VIDEOS, NAV, pie
  lib/seo.ts                  pageMetadata({ path, title, description, image? })
  lib/structured-data.ts      helpers tipados + <JsonLd> (escapa "<")
  lib/routes.ts               registro de páginas públicas (path, lastModified) → sitemap
  app/layout.tsx              next/font/google Recursive, lang es-419, viewport, template de título
  app/page.tsx                home: compone components/landing/*, revalidate = 300
  app/opengraph-image.tsx     OG de la home
  app/not-found.tsx
  app/impacto/page.tsx        (antes app/impact) + opengraph-image
  app/configurar/{iphone,android}/page.tsx
  app/investigacion/page.tsx
  app/pausa-antes-de-abrir-apps/page.tsx
  app/alternativa-one-sec/page.tsx
  app/apps-para-dejar-el-celular/page.tsx
  app/guias/page.tsx, app/guias/<slug>/page.tsx, app/guias/opengraph-image.tsx
  app/calculadora-tiempo-de-pantalla/page.tsx
  components/landing/         site-header, hero, proof-band, why-second, how-it-works
                              (+ platform-toggle.client), usage-gains, impact-fund,
                              why-still, research-summary, faq, download-cta,
                              site-footer, store-badges, phone-video, phone-mocks
                              (+ un .module.css por componente)
  components/content/         article, breadcrumbs, related-guides, cta-block
  public/badges/              SVG oficiales es-419 (App Store negro, Google Play)
  public/llms.txt, public/<indexnow-key>.txt
  scripts/indexnow.mjs
```

- Insignias oficiales: App Store desde Apple Marketing Tools
  (`https://tools.applemarketingtools.com/api/badges/download-on-the-app-store/black/es-mx`,
  SVG) y Google Play desde
  `https://play.google.com/intl/es-419/badges/static/images/badges/es-419_badge_web_generic.png`
  (PNG; si hay SVG oficial, mejor). Alto visual igual para ambas; cada una
  con `alt` ("Descárgalo en el App Store", "Disponible en Google Play").
- `lib/impact.ts`: función nueva o ajuste para exponer `allTime` en la home
  (tiempo devuelto, donado hasta hoy, personas) y lanzar ante errores
  transitorios (D7). Formatos con `formatFund`/`formatReturnedTime`.
- Reutilizar `AttentionField` (modo `intervention`) dentro del teléfono del
  hero y del paso 3; los teléfonos de los pasos son markup.
- `next.config.ts`: `redirects()` de `/impact` a `/impacto`,
  `images.formats: ["image/avif", "image/webp"]`.
- `security-headers.ts`: `media-src 'self'` para los videos y el dominio
  de la insignia solo si no se sirve desde `/public` (preferido: `/public`).
  Actualizar su test.
- Se borran: `public/images/v3/*` (si nada más los usa),
  `components/intervention-demo.tsx`, `components/android-download-link.tsx`,
  y las clases muertas de `globals.css` (D13).

## 6. Fases

Cada fase termina con `pnpm check` y `pnpm --filter web build` en verde y
un commit en español (convención del repo) en `feat/landing-v2-seo`.

| Fase | Contenido | Hecho cuando |
|---|---|---|
| F0 | Rama desde `main`. `lib/site.ts`, `lib/seo.ts`, `lib/structured-data.ts`, `lib/routes.ts`; `SITE_URL` sin fallback (D5); fuente variable (D12); `viewport`; `lang="es-419"`; `apple-icon.png` y PNG 192/512 en el manifest (desde `brand/v3/identity/`); robots y sitemap desde el registro con `lastModified`; redirección `/impact` → `/impacto`; `not-found.tsx` | Tests de `pageMetadata` (canonical y OG completos por ruta), del JSON-LD (JSON válido, `<` escapado, sin rating) y del sitemap; el build pasa sin variables de Supabase |
| F1 | Home v2: componentes y CSS Modules según `docs/landing-v2/design/V2-Desktop-*.dc.html` y `V2-Mobile-*.dc.html` (copia v2 + D6); insignias oficiales; formulario "¿Te avisamos?" con plataforma (D16); FAQ `<details>` (D10); toggle de plataforma (D11); `PhoneVideo` (D15); ISR (D7); JSON-LD de la home (D9); OG de la home; animaciones (D14); limpieza (D13) | Captura en escritorio (1440) y móvil (390) comparada con el canvas; ninguna sección se superpone (mismo chequeo de alturas: cada sección con `scrollHeight` ≤ su alto y sin desborde horizontal salvo las barras del hero); navegación con teclado; con `prefers-reduced-motion` no hay movimiento; la home responde con `x-vercel-cache`/`s-maxage` en `next start` |
| F2 | `/configurar/iphone`, `/configurar/android`, `/investigacion`, `/impacto` (slug nuevo, título, H1, meta y enlaces según la sección 4; el contenido de impacto se mantiene) | Etiquetas del sistema idénticas a `system-strings.ts` (test que compara); cada página con un solo `<h1>`, canonical y OG propios |
| F3 | Layout de contenido (D19); `/guias` + 5 guías; `/pausa-antes-de-abrir-apps`; `/alternativa-one-sec`; `/apps-para-dejar-el-celular`; OG genérica de guías; Article + BreadcrumbList | Cada página cumple el contenido mínimo de la sección 4, con fuentes externas enlazadas y fecha; ninguna afirmación médica ni cifra sin fuente (D17, D18); todas en el sitemap |
| F4 | `/calculadora-tiempo-de-pantalla` | Cálculo con tests; funciona sin enviar nada; accesible con teclado y lector de pantalla |
| F5 | `llms.txt`; IndexNow (clave + script, D22); cabecera y pie con todos los enlaces internos; revisión final de títulos y descripciones (script que verifica ≤ 60 y ≤ 155 caracteres y que no hay títulos ni descripciones repetidos) | Lighthouse (móvil) de la home y de una guía con Performance, SEO, Accesibilidad y Buenas prácticas ≥ 95 en `next start`, o, si no se puede correr Lighthouse, las cifras de LCP/CLS medidas en el navegador y el motivo; sección 9 de este documento actualizada con lo hecho |

## 7. Pasos del usuario

| # | Paso | Cuándo |
|---|---|---|
| U1 | **Dominio propio** conectado en Vercel, con `NEXT_PUBLIC_APP_URL` apuntando a él y el `vercel.app` redirigiendo. Después: actualizar las URL de las fichas (web, soporte, privacidad) y confirmar que `app-ads.txt` responde en el dominio que figura en la ficha (AdMob lo lee de ahí). Cuanto antes: mudar el sitio después de indexarlo cuesta posiciones. | Antes de anunciar la web |
| U2 | Search Console (propiedad de dominio por DNS), enviar el sitemap y pedir la indexación de la home, las dos guías de configuración y `/alternativa-one-sec`. Bing Webmaster Tools: importar desde Search Console. Correr el script de IndexNow tras cada despliegue grande. | Al desplegar |
| U3 | Grabar 4 videos cortos (pausa 0:20, elegir apps 0:12, activar en Android 0:25, atajo en iPhone 0:45), en MP4 H.264 vertical, y pasarlos para `public/videos/`. | Cuando puedas |
| U4 | Cuando Apple apruebe la app: cambiar `STORES.ios.status` a `live` (activa el Smart App Banner y el `installUrl`). Igual con Android al pasar Play a producción. | Al aprobarse |
| U5 | Fichas de las tiendas: sumar "tiempo de pantalla", "dejar de scrollear" y "pausa" donde quepan (`docs/store-listing.md`); las fichas rankean solas en estas búsquedas. | Próxima versión |
| U6 | Enlaces externos: publicar Still en AlternativeTo, Product Hunt y SaaSHub (como alternativa a one sec, Opal y ScreenZen); escribir a PantallasAmigas, Xataka, Hipertextual, Infobae, Androidphoria y BioBioChile con el ángulo "gratis y dona el 80 % de sus anuncios"; pedir a las listas de "automatizaciones útiles de iPhone" 2026 que sumen la pausa. | Tras publicar |
| U7 | Cuando haya ratings reales en las tiendas: mostrarlos en la home y sumar `aggregateRating`. | Con ratings |
| U8 | Opcional: 5 líneas sobre quién hace Still para una página "Quién hace Still" (confianza). | Opcional |

## 8. Medición

- A las 2, 4 y 8 semanas del despliegue en el dominio final: en Search
  Console, impresiones y CTR por página y consulta. Páginas con impresiones y
  CTR < 2 %: reescribir título y descripción. Consultas nuevas con
  impresiones: ampliar la guía o crear una por marca (p. ej., Xiaomi).
- Core Web Vitals de campo en Search Console; PageSpeed Insights tras cada
  cambio grande.
- Consultas de marca ("still app pausa") para saber si la marca ya se
  reconoce.

## 9. Resultado

Se completa al implementar (qué se hizo, verificación, pendientes).

## 10. Prompt para `/goal`

```
/goal Implementa en apps/web la landing v2 de Still y el plan SEO completo de docs/landing-seo-plan.md, en una rama nueva feat/landing-v2-seo creada desde main. Lee primero todo docs/landing-seo-plan.md: las decisiones D1–D24 están tomadas y no se reabren ni se re-investigan; la investigación de la sección 2 tampoco se repite (solo verifica en la web los datos de terceros que cites en guías y comparativas, como pide D18). El diseño aprobado está en docs/landing-v2/design/V2-*.dc.html (escritorio en dos partes y móvil en dos partes; los valores entre corchetes con subrayado punteado son datos en vivo de lib/impact.ts): replica su estructura, copy, colores, tipografía y espaciado con componentes de React y CSS Modules, con los ajustes de D6. Ejecuta las fases F0 a F5 de la sección 6 en orden; al cerrar cada fase, pnpm check y pnpm --filter web build deben pasar y haces un commit en español. Verifica cada fase en el navegador con el servidor de desarrollo (preview): capturas a 1440 y 390 px, ninguna sección superpuesta ni texto cortado, teclado y prefers-reduced-motion. No inventes cifras, ratings ni testimonios; toda cifra de estudios lleva su fuente y el aviso de que no mide a Still (D17). No hagas push, PR ni despliegues, no cambies variables de Vercel ni la base de datos, y no toques apps/mobile. Hecho = F0–F5 cumplidas con sus criterios de "Hecho cuando", la sección 9 de docs/landing-seo-plan.md completada con lo que se hizo, cómo se verificó y qué queda para el usuario (sección 7), y un resumen final con las capturas de la home en escritorio y móvil.
```

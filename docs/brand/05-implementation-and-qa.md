# Still — implementación y QA final

Fecha de cierre: 29 de agosto de 2026.

Este documento relaciona cada requisito del rediseño con evidencia verificable en el repositorio. No sustituye al brandbook: registra qué se implementó y cómo se comprobó.

## Matriz de entrega

| Requisito | Evidencia de diseño | Evidencia implementada |
| --- | --- | --- |
| Investigación competitiva y referencias actuales | `01-market-research.md`: competidores directos, productos adyacentes, fuentes, convenciones, saturación y oportunidad | Las decisiones diferenciadoras se traducen a reglas auditables en estrategia y producto |
| Posicionamiento, promesa y concepto creativo | `02-strategy-and-art-direction.md`: “El intervalo registrado”, “Una pausa que cuenta”, personalidad y principios | Narrativa y copy aplicados en app, web, assets y metadata |
| Logo e identidad gráfica | Brandbook + `brand/assets/logo/`: Interval S, lockup, icono, adaptive icon y splash | Iconos instalados en Expo, iOS, Android, manifest y favicon web |
| Color, tipografía, forma, imagen, iconografía y motion | `02-strategy-and-art-direction.md` y `03-design-system-spec.md` | Tokens equivalentes en `apps/web/app/tokens.css` y `apps/mobile/src/theme/tokens.ts`; Familjen Grotesk + IBM Plex Mono cargadas localmente |
| Voz y tono | `04-voice-and-tone.md`: vocabulario, errores, vacíos, onboarding, push, comercial, social y email | Copy internacional en inglés/español; sin voseo ni lenguaje moralizante; estados técnicos localizados |
| Design system | `03-design-system-spec.md`: tokens, estados y reglas de componentes | Primitivas mobile reutilizables (`Screen`, `Typography`, `PrimaryButton`, `Surface`, `IntervalMark`) y sistema CSS web con foco, estados y Reduce Motion |
| Aplicación rediseñada | Arquitectura visual, navegación, onboarding, intervención, pases, registro, impacto y settings | Expo Router + Native Tabs; extensiones iOS de Shield/Action/Report; Activity/Picker/Intervention Android; funcionalidad y contratos conservados |
| Web rediseñada | Arquitectura narrativa definida en estrategia | Home con demo, mecánica, beneficios, registro, impacto, privacidad, FAQ y CTA; impacto, privacidad, admin y login; metadata, icono, manifest, robots y sitemap; desktop y mobile |
| Brandbook | Fuente reproducible `scripts/generate_brandbook.py` | `output/pdf/still-brandbook.pdf`, 16 páginas, render y extracción verificados |
| Material promocional | Reglas y copy en `brand/campaign/README.md` | Masters SVG + PNG para tienda, feature graphic, social cuadrado, story, Reels, LinkedIn/X, paid social, email, banner y póster |
| Mockups propios | Dirección “evidencia, no atmósfera” | `mockup-phone`, `mockup-desktop` y `mockup-ecosystem` usan capturas reales, no escenas genéricas |
| Recursos reutilizables | Estructura descrita en `brand/README.md` | SVG masters, pattern, exports PNG, product screens Release y assets nativos organizados por uso |
| Implementación real | Migración documentada en este sistema | Cambios aplicados sobre el monorepo existente; APIs, contratos, Supabase y motores de restricción preservados |

## Superficies verificadas

### App iOS Release

- Onboarding: primera etapa y sistema de progreso.
- Today: jerarquía editorial, tab bar y contenedores Device Activity.
- Passes: balance, estados de anuncio y opción offline.
- Impact: estado, porcentaje, participantes, acciones y voto.
- Settings: permisos, identidad, analytics, privacidad y acciones de datos.
- Intervention: salida primaria, acceso secundario y duración explícita.
- Unlock ready: duración, siguiente estado y retorno.

Las capturas finales viven en `brand/product-screens/mobile-*-ios.png`. Las pantallas que dependen de Family Controls muestran datos reales sólo después de la autorización en un dispositivo; el simulador valida el layout y la extensión compilada, pero no fabrica actividad.

### Web

- Home, Impact y Privacy a 1440 px.
- Home, Impact y Privacy a 390 px.
- Capturas completas en `brand/product-screens/web-*.png`.

## Gates ejecutados

| Gate | Resultado |
| --- | --- |
| `pnpm check` | Lint, TypeScript y 19 tests: 8 contracts, 6 web, 5 mobile |
| `pnpm build` | Next.js production build; 23 rutas generadas/validadas |
| `xcodebuild ... Debug ... CODE_SIGNING_ALLOWED=NO build` | Build completa de app + cuatro extensiones: success |
| `xcodebuild ... Release ... ONLY_ACTIVE_ARCH=YES ARCHS=arm64 build` | Bundle Release embebido, instalado y lanzado en iPhone 15 / iOS 26 |
| `./gradlew :app:compileDebugKotlin --no-daemon` | Compilación Android: success |
| Playwright + axe-core | 6 vistas, 0 violaciones WCAG 2.2 AA, 0 overflow, 0 errores de consola |
| Maestro | 6 smoke flows: onboarding, Passes, Impact, Settings, Intervention y Unlock Ready |
| PDF render + `pypdf` | 16 páginas, 5.696 caracteres extraíbles y hoja de contacto sin solapes |
| SVG/PNG campaign render | 16 masters exportados al tamaño declarado e inspeccionados visualmente |
| `git diff --check` | Sin whitespace errors |

Los warnings de Xcode provienen de Pods (Reanimated, Sentry, Expo y Google Mobile Ads). El `GADApplicationIdentifier` final fue comprobado en el `Info.plist` de Release; el aviso del script de RNGoogleMobileAds se debe a que el proyecto usa `app.config.ts` y el config plugin en lugar de `app.json`.

## Accesibilidad y responsive

- Contraste medido y documentado para todos los pares principales.
- Foco visible, skip link, semántica nativa/HTML y estados que no dependen sólo del color.
- Targets móviles de 44 px o más; controles primarios de 52 px.
- Dynamic Type sin alturas fijas para copy crítico; contadores tabulares.
- `prefers-reduced-motion` en web y animaciones no esenciales limitadas en app.
- Pruebas web a 1440 × 1000 y 390 × 844 sin overflow horizontal.
- Maestro localiza las tabs y pantallas por labels accesibles, no por coordenadas.

## Auditoría anti-slop y consistencia

La última búsqueda y revisión visual confirma:

- sin purple/blue atmospheric gradients, blobs, glows, halos ni glassmorphism como lenguaje;
- sin serif wellness, hoja, órbita o score moral;
- sin grids de cards como arquitectura principal;
- sin aliases `sage`, `linen` o `clay` del sistema anterior;
- sin slogans `unlock`, `transform`, `supercharge` o equivalentes en producto;
- Signal, Impact y Record siempre tienen función semántica;
- el Still cut aparece en app, web, brandbook y campaña;
- el copy de impacto distingue estimado, confirmado, conciliado, donado y publicado.

## Criterio de publicación

Los screenshots de tienda enlazan las capturas Release de `brand/product-screens/`. Cuando cambie una build candidata, actualizar esas capturas y volver a exportar los SVG; no editar los PNG a mano. Las cifras de campaña deben conservar fecha, estado y procedencia, y nunca sustituirse por resultados inventados.

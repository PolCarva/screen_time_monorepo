# Still — especificación del sistema visual

Este archivo es el contrato entre marca, web y aplicación. Los nombres de tokens deben mantenerse equivalentes entre CSS y React Native.

## Color

### Brand

| Token | Valor | Uso |
| --- | --- | --- |
| `paper` | `#F3F0E8` | Fondo principal; lectura y pausa. |
| `paperRaised` | `#FFFDF8` | Superficie interactiva o elevada. |
| `ink` | `#171814` | Texto, controles primarios y marca. |
| `inkSoft` | `#3D3E39` | Texto secundario fuerte. |
| `muted` | `#5D5E58` | Metadata; 5.75:1 sobre Paper. |
| `rule` | `#C9C5BA` | Bordes, reglas y ejes. |
| `ruleStrong` | `#8C8B84` | Divisor activo o control. |
| `signal` | `#FF5C35` | Interrupción, foco de marca y momentos de decisión. |
| `impact` | `#C9F36B` | Fondo confirmado, acumulación positiva. |
| `record` | `#9CB8FF` | Estimación, información y estados en proceso. |

### Functional

| Token | Valor | Uso |
| --- | --- | --- |
| `success` | `#21633B` | Confirmación textual; 6.33:1 sobre Paper. |
| `danger` | `#B33126` | Error/destrucción; 5.45:1 sobre Paper. |
| `warningBg` | `#F6D67A` | Aviso con texto Ink. |
| `focus` | `#3157D5` | Outline de teclado de 2 px. |

### Contraste

- Ink/Paper: 15.66:1.
- White/Ink: 17.55:1.
- Ink/Signal: 5.81:1.
- Ink/Impact: 14.03:1.
- Signal no se usa para texto pequeño sobre Paper.
- Los estados siempre incluyen texto, forma o patrón; nunca dependen solo de color.

## Tipografía

### Familias

- `brand/display/body/ui`: Familjen Grotesk 400, 500, 600, 700.
- `data/label/meta`: IBM Plex Mono 400, 500, 600.

### Escala web

| Token | Tamaño / línea | Uso |
| --- | --- | --- |
| `display-xxl` | `clamp(5.25rem, 11vw, 10rem) / .83` | Hero principal. |
| `display-xl` | `clamp(4rem, 8vw, 8rem) / .88` | Hero interior. |
| `display-lg` | `clamp(3rem, 6vw, 6rem) / .92` | Secciones. |
| `heading-lg` | `2.5rem / 1` | Títulos de bloque. |
| `heading-md` | `1.75rem / 1.08` | Subtítulos. |
| `body-lg` | `1.25rem / 1.5` | Lede. |
| `body` | `1rem / 1.6` | Texto. |
| `body-sm` | `.875rem / 1.55` | Soporte. |
| `label` | `.75rem / 1.3` | Mono uppercase, tracking `.08em`. |
| `data-xl` | `clamp(4rem, 9vw, 8.5rem) / .85` | Tiempo/fondo. |

### Escala mobile

- Display 1: 48/46, weight 600, tracking -1.8.
- Display 2: 36/37, weight 600, tracking -1.1.
- Heading: 24/28, weight 600.
- Body large: 18/27, weight 400.
- Body: 16/24, weight 400.
- Body small: 13/19, weight 400.
- Label: 11/15 mono, weight 600, tracking 1.1.
- Data hero: 68/68 mono, tabular nums.
- Data: 30/32 mono, tabular nums.

No texto informativo crítico por debajo de 12 px. Dynamic Type debe poder crecer sin truncar acciones.

## Spacing

Unidad base: 4.

| Token | px |
| --- | --- |
| `2xs` | 4 |
| `xs` | 8 |
| `sm` | 12 |
| `md` | 16 |
| `lg` | 24 |
| `xl` | 32 |
| `2xl` | 48 |
| `3xl` | 64 |
| `4xl` | 96 |
| `5xl` | 144 |

El corte Still usa `md` en UI, `lg` en producto promocional y una columna de grid en composición editorial.

## Radio y forma

- `none`: 0 — reglas, tablas y piezas editoriales.
- `control`: 8 — inputs y botones.
- `surface`: 12 — agrupaciones semánticas.
- `modal`: 20 — sheets/modales de plataforma.
- `capsule`: 999 — solo status compacto o toggle nativo; nunca layout general.
- En React Native, superficies usan `borderCurve: "continuous"` cuando la plataforma lo soporte.

## Bordes y elevación

- Regla estándar: 1 px `rule`.
- Regla activa: 2 px `ink` o `focus` según estado.
- Cards flotantes no son el contenedor por defecto.
- Elevation 1: `0 6px 20px rgba(23,24,20,.08)` para menus/sheets.
- Elevation 2: `0 18px 48px rgba(23,24,20,.14)` para mockup o modal protagonista.
- No hay sombras difusas sobre cada sección.

## Grid y breakpoints web

- Container máximo: 1280 px.
- Desktop: 12 columnas, gutter 24 px, margen mínimo 40 px.
- Tablet: 8 columnas, gutter 20 px, margen 28 px.
- Mobile: 4 columnas, gutter 12 px, margen 18 px.
- Breakpoints: 480, 768, 1024, 1280 px.
- Texto de lectura: máximo 68 caracteres por línea.

## Motion

| Token | Valor |
| --- | --- |
| `fast` | 120 ms |
| `standard` | 200 ms |
| `deliberate` | 520 ms |
| `easeOut` | `cubic-bezier(.16,1,.3,1)` |
| `easeInOut` | `cubic-bezier(.65,0,.35,1)` |

Estados hover/press no deben mover layout. Reduce Motion elimina transformaciones y deja cambios de opacidad instantáneos o de 80 ms.

## Componentes fundamentales

### Button

- Altura web 48–52; mobile mínimo 52.
- Radio `control`, no pill.
- Primary: Ink/White.
- Signal: Signal/Ink, reservado para el momento de interrupción o lanzamiento.
- Secondary: transparente, borde Ink.
- Quiet: sin fondo, underline o flecha de dirección.
- Focus: outline Focus de 2 px con offset 3 px.
- Disabled: 45% opacity, sin transform.
- Loading: conserva ancho; label específico (“Preparando el anuncio…”) antes que spinner sin contexto.

### Input

- Label siempre visible.
- 48 px mínimo, borde Rule, fondo PaperRaised.
- Focus de 2 px; error con texto Danger y `aria-describedby`.

### Selector

- Checkbox, radio o fila seleccionable con label completo como target.
- Selected combina borde Ink de 2 px, indicador interno y `aria-checked` / `accessibilityState`.
- Nunca esconder la opción nativa sin recrear foco, teclado y lector de pantalla.

### Status

- Mono 11–12, uppercase.
- Puede usar cápsula solo si funciona como metadata compacta.
- Estimado: Record + texto “ESTIMADO”.
- Confirmado: Impact + texto “CONFIRMADO”.
- Error/bloqueado: icono/forma + texto, no solo rojo.

### Surface

Solo cuando agrupa una interacción o cambia el nivel semántico. Una sección editorial usa reglas, columnas y whitespace sin fondo elevado.

### List

- Filas con reglas compartidas, no una card por elemento.
- Target completo mínimo 44 px mobile / 40 px web.
- Leading icon solo cuando comunica categoría o acción.

### Charts

- Números tabulares y label del periodo.
- Ejes o días explícitos.
- Signal marca la intervención/elección; Ink muestra tiempo; Rule muestra baseline.
- Patrón o forma acompaña cualquier diferenciación cromática.
- Cada chart tiene resumen accesible.

### Navigation

- Web: header editorial con regla inferior; CTA rectangular.
- Mobile: tabs de plataforma o barra simple de ancho completo; no isla flotante redondeada.
- Íconos estándar solo para función; nunca como decoración.

### Tabs

- Tabs nativas en app; label siempre visible y símbolo de plataforma.
- Selected combina Signal, icono relleno y estado accesible; no depende sólo del color.
- El contenido conserva inset inferior suficiente para no ocultar acciones al desplazarse.

### Progress

- Secuencia lineal, de 3 px, sin anillo motivacional.
- Segmento completo Signal; pendiente Rule; texto equivalente `paso / total`.
- En tareas indeterminadas, usar un label específico y mantener el ancho del control.

### Dialog / Modal / Sheet

- Componente nativo de plataforma cuando sea posible.
- Título concreto, resultado de acción y salida clara.
- Acciones destructivas separadas y confirmadas.

### Empty state

- Nombra qué falta y qué acción real lo cambia.
- No ilustración genérica, confetti ni “Something awesome is coming”.

### Notification / toast

- Una frase de resultado y, si aplica, una acción reversible.
- Success usa texto Success; warning usa Warning + Ink; error usa Danger y nunca desaparece antes de poder leerse.
- Push y banners declaran el estado real: `Voto registrado`, `Donación publicada`, `Pase activo hasta 14:20`.

### Tooltip

- Sólo para aclarar un control compacto; nunca para esconder información esencial.
- Se abre por hover y foco, se cierra con Escape, tiene relación `aria-describedby` y máximo 48 caracteres.
- Fondo Ink, texto PaperRaised, radio Control, elevación Menu.

### Settings row

- Label y estado visibles en la misma jerarquía; descripción debajo cuando cambia privacidad o permisos.
- Switch nativo para booleanos; botón secundario para navegar; acción destructiva aislada al final.
- Estados del sistema se traducen a lenguaje humano (`Sin configurar`), no se muestran enums internos.

## Estados requeridos

Todo control interactivo debe cubrir default, hover (web), pressed, focus-visible, selected, disabled, loading, success y error cuando apliquen. El estado no puede cambiar solo por color.

## Accesibilidad

- WCAG 2.2 AA como mínimo en web.
- Target mínimo 24×24 CSS px con separación; objetivo de producto 44×44.
- Focus siempre visible y no oculto por headers sticky.
- Orden DOM coincide con orden visual.
- Dynamic Type y lectores de pantalla en mobile.
- `fontVariant: ["tabular-nums"]` para contadores.
- Reduce Motion / `prefers-reduced-motion`.
- Charts y progress incluyen equivalente textual.

Referencias:

- https://www.w3.org/TR/WCAG22/
- https://developer.apple.com/design/human-interface-guidelines/accessibility/

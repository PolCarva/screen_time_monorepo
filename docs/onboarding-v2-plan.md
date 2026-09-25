# Still · Onboarding v2: historia con tus datos + configuración verificada — investigación y plan

Fecha: 2026-09-24 · Rama: `feat/onboarding-story` (base `main` `c69400b`) ·
Estado: **implementado (F1–F8, 2026-09-24/25)**, sin pushear ni mergear. Resultados en §14;
lo que falta hacer fuera del código, en §15.

Pedido del usuario (2026-09-24), con capturas de AppBlock como referencia:

1. **Historia con tus datos, fácil de configurar.** Primero pregunta cuánto crees que usas
   el teléfono; después pide acceso al tiempo de uso y, al darlo, muestra el uso real;
   luego cuánto suma eso en tu vida; después te guía de forma visual; por último explica
   cómo funciona.
2. **Que todo termine configurado.** "Más allá de las referencias": el onboarding guía paso
   a paso, ilustrado, hasta que la pausa funciona. **Los textos del sistema cambian entre
   iPhones y Androids**, así que las ilustraciones orientan, pero **cada paso se verifica**
   con una señal real antes de avanzar.

> **Cómo se obtuvo la evidencia.** [código] = leído en el repo. [web] = fuente citada en
> §13. [hipótesis] = plausible pero sin comprobar; se valida en la fase indicada y tiene
> una salida definida si falla.

---

## 0. Decisiones firmes (no reabrir)

| # | Decisión | Origen |
|---|---|---|
| **D1** | **iOS detrás de flag.** El tiempo real en iOS usa Family Controls + una extensión `DeviceActivityReport`. Se construye, pero la extensión y el entitlement viven en una rama apilada (`feat/onboarding-ios-screen-time`) que **no se mergea hasta que Apple apruebe Family Controls (Distribution)** para los dos bundle IDs. Hasta entonces iOS hace la misma historia **con la estimación** de la persona (sin pantalla de permiso ni revelación). Además hay flag remoto `iosScreenTimeInsightsEnabled` (por defecto `false`) como interruptor. | Usuario, 2026-09-24 |
| **D2** | **Identidad Still**, no la estética oscura de las referencias: tiza, Recursive, mineral/durazno, tokens de `src/theme/tokens.ts`. Se copia la **estructura**: una idea por pantalla, números grandes que cuentan, barras que crecen, teléfono simulado, barra de progreso continua arriba. | Usuario |
| **D3** | **Nada de promesas inventadas** ("Con AppBlock 45 m", "32 %*"). La pantalla de potencial muestra **solo datos reales de la persona** (apps que más usa, desbloqueos) **y un estudio externo atribuido**: Grüning, Riedel y Lorenz-Spreen, *PNAS* 2023 — con one sec, una pausa antes de abrir, las aperturas bajaron **57 %** tras 6 semanas y **36 %** de los intentos terminaron cerrando la app [web]. Se nombra el estudio y la app del estudio; nunca se presenta como resultado de Still. | Usuario |
| **D4** | **Android lee el uso con Acceso de uso** (`PACKAGE_USAGE_STATS`). *(Ampliada el 2026-09-25 por [real-savings-estimate-plan.md](real-savings-estimate-plan.md) D8: el acceso también estima el tiempo devuelto después del onboarding y el teléfono guarda totales por app, sin enviarlos.)* Esto revierte en parte D4 de `ui-clarity-plan.md`: el permiso vuelve **solo para el onboarding**. Hoy sigue contando pausas (no se reabre D4/D5 de ese plan). El cálculo ocurre en el teléfono; ningún dato de uso ni nombre de app sale del dispositivo ni va a analítica. | Este plan (consecuencia del pedido) |
| **D5** | **El permiso de uso es opcional.** "Seguir sin mi dato" siempre existe; la historia continúa con la estimación. La configuración de la pausa (§4) **no** es opcional en el mismo sentido: cada paso requerido se verifica. | Este plan |
| **D6** | **Voz de marca** (`docs/brand/04-voice-and-tone.md`): sin juicio. Nada de "desperdiciados", "adicto", "tóxico", "desbloquea tu potencial". La vida en años se dice como dato: "En 30 años son 3,8 años frente a la pantalla." | Este plan |
| **D7** | **La configuración se verifica con señales reales, no con el texto de la pantalla del sistema.** Las ilustraciones (réplicas en código ya existentes, en el idioma del teléfono) orientan; la app avanza solo cuando lee la señal del paso (§5). Cuando el sistema no expone señal (pasos dentro de Atajos, autoarranque de MIUI), la verificación es la **prueba real de la pausa** al final. | Usuario |
| **D8** | **La prueba real es obligatoria para terminar.** Android: abrir una app elegida muestra la pausa en modo prueba y vuelve a Still. iOS: cada app elegida pasa su prueba (la automatización disparó). Hay una salida discreta "Terminar después" que deja una tarjeta persistente en Hoy hasta completar lo pendiente. | Este plan |
| **D9** | **`onboarded = true` solo al final** (o con "Terminar después"). El progreso se guarda por paso (`onboardingProgress`), así que si el sistema mata Still mientras la persona está en Ajustes/Atajos, al volver retoma en el paso pendiente y lo re-verifica. | Este plan |
| **D10** | **Guía visual con la app real en Android.** Si hay datos de uso, la demo usa la app más usada (nombre + ícono reales vía `PackageManager`, solo en memoria). Sin datos, y siempre en iOS, usa Instagram (`EXAMPLE_APP` de `src/components/guide/app-icons.tsx`). El resto de la pantalla de inicio simulada son íconos neutros (sin logos de terceros). | Este plan |
| **D11** | **El selector de Android sugiere, no preselecciona.** `AppPickerActivity` recibe las 5 apps más usadas y las muestra arriba bajo "Las que más usas" con su tiempo diario; ninguna viene marcada. | Este plan |
| **D12** | **Consentimiento de anuncios dentro del onboarding.** Hoy el formulario UMP aparece en el primer `prepare()` de anuncios (iOS, justo después del onboarding) y **el escudo nativo de Android nunca lo pide** [código]. El paso "Anuncios y privacidad" corre `AdsConsent.gatherConsent` solo cuando UMP dice que hace falta (EEE/UK/CH); si no hace falta, se salta solo. | Este plan |
| **D13** | **Pantalla por pantalla, no un carrusel.** Un solo componente de onboarding con una máquina de estados pura (`src/lib/onboarding-flow.ts`, testeada) decide qué pasos aplican según plataforma, capacidades nativas, flags y datos. Los pasos de configuración son componentes reutilizables que también usan Ajustes y la tarjeta de Hoy. | Este plan |
| **D14** | **Sin analítica de contenido.** Eventos de embudo sin nombres de apps ni minutos: `onboarding_step_viewed {step}`, `onboarding_usage_access {result}`, `onboarding_step_verified {step}`, `onboarding_completed {complete, seconds}`. | Este plan |

---

## 1. Qué hay hoy [código]

- `app/(onboarding)/index.tsx`: 4 pantallas de texto (El momento · La elección · En tu
  teléfono · Configuración con checkbox de 18+). Al tocar "Elegir apps" hace
  `setOnboarded(true)` **antes** de configurar nada y salta a `/ios-apps` (iOS) o
  `/android-setup` (Android). Si la persona abandona ahí, Still queda "onboarded" sin pausa.
- iOS configura en `/ios-apps` → `/shortcut-setup` (niveles de Atajos, réplicas en código,
  prueba real con `beginShortcutSetupProbe`) → `/shortcut-repair`.
- Android configura en `/android-setup` (divulgación de Accesibilidad → Ajustes → selector
  nativo) → `/android-repair`.
- No se lee tiempo de pantalla en ninguna plataforma (quitado el 2026-09-22, commit
  `0361a36`; `native-config.test.ts` afirma que el manifiesto **no** tiene
  `PACKAGE_USAGE_STATS` y que el módulo **no** usa `UsageStatsManager`).
- iOS no tiene Family Controls: `ios/Still/Still.entitlements` solo trae App Group, Sign in
  with Apple y push. `ios/StillDeviceActivityReport/` y `StillNative/StillActivityReportView.swift`
  existen como código del spike, **fuera del proyecto de Xcode**. La ficha de App Store y
  las notas de revisión dicen que Still no usa Tiempo en pantalla.

§4.0 amplía el inventario de la configuración actual y sus huecos de verificación.

---

## 2. El flujo nuevo de un vistazo

```
HISTORIA (≈ 1 min)                                   CONFIGURACIÓN VERIFICADA
 1 Estimación ─► 2 Permiso de uso ─► 3 Tu tiempo real   9 18+ ─► 10 Anuncios y privacidad*
                   │ (seguir sin dato)                    │
                   ▼                                      ▼
 4 Lo que suma ─► 5 Dónde se va + estudio               Android: 11A Accesibilidad ✓ ─► 12A Apps ✓
                                                                 ─► 13A Batería/OEM* ─► 14A Prueba real ✓
 6 El gesto automático (demo interactiva)               iOS:     11I Apps ✓ ─► 12I Conectar Atajos
 7 La pausa (demo interactiva)                                   ─► 13I Prueba por app ✓ ─► 14I Avisos ✓
 8 Cómo funciona ──────────────────────────────────────► 15 Listo (resumen con todo ✓) ─► Hoy
```

`*` = solo cuando aplica. `✓` = el paso no avanza sin su señal (§5). "Saltar" (arriba a la
derecha, pasos 1–8) lleva al paso 9. En iOS sin Family Controls (D1) no existen 2 y 3, y 4–5
usan la estimación.

---

## 3. La historia, pantalla por pantalla

Layout común (`StoryScreen`): arriba, marca de Still + barra de progreso continua + "Saltar";
en el centro, una idea; abajo, botón primario y, si aplica, un botón de texto secundario.
Densidad por alto disponible como el onboarding actual (`densityFor`). Todo en `localize(en, es)`.
Con "Reducir movimiento", los números aparecen sin contar y nada se desliza.

### 3.1 Estimación — `guess`

- Título: **"¿Cuánto crees que usas el teléfono al día?"** / "How much do you think you use
  your phone a day?"
- Cuerpo: "Sin mirar. Lo que creas." / "No peeking. Your best guess."
- Control: número grande en el centro ("3 h 30 min") y un deslizador por pasos de 30 min,
  de 30 min a "12 h o más". Empieza en 3 h. Háptica en cada paso (como `DurationSlider`).
- CTA: "Continuar". Guarda `guessMinutes` en storage (y, en iOS con Family Controls, en el
  App Group para la extensión).
- Implementación: extraer la mecánica de `DurationSlider` a `SteppedSlider` (pasos
  genéricos) y que `DurationSlider` la use; el deslizador de acceso no cambia de aspecto.

### 3.2 Permiso de uso — `usage-permission` (Android; iOS solo con D1 habilitado)

- Título: **"Ahora, tu tiempo real."** / "Now, your real time."
- Cuerpo Android: "Con el acceso de uso, Still cuenta cuánto usas cada app. Se calcula en
  este teléfono y no sale de aquí." — es la divulgación destacada de Google Play (User Data).
- Visual: siete barras vacías con una línea punteada y un "?" (como la referencia, en fog y
  mineral).
- CTA: **"Ver mi tiempo real"** → abre Ajustes (§6.2). Secundario: **"Seguir sin mi dato"**.
- Al volver a Still (AppState `active`): si `hasUsageAccess()` → pasa a 3.3; si no, la
  pantalla dice "No se activó el acceso de uso." y muestra una mini-guía ilustrada de 2
  pasos (fila de Still → interruptor) con el aviso **"En tu teléfono puede verse distinto:
  busca Still y activa el permiso."** + reintentar.
- iOS (D1 habilitado): mismo texto adaptado ("Con tu permiso, Tiempo en pantalla…"); CTA →
  `requestAuthorization()` (diálogo del sistema; verificado por el resultado).

### 3.3 Tu tiempo real — `reveal`

- Mientras calcula (≤ 1–2 s): el número cuenta desde 0 con `AnimatedNumber`.
- Número grande: **"3 h 3 min"**, debajo "al día · promedio de los últimos 7 días" (o "hoy,
  hasta ahora" si hay < 1 día completo de datos).
- Comparación con la estimación (`compareToGuess`, pura y testeada):
  - `|real − guess| / guess < 10 %` → "Muy cerca de lo que creías." (mineral)
  - mayor → "**53 % más** de lo que creías." (durazno, flecha ↗)
  - menor → "**22 % menos** de lo que creías." (mineral, flecha ↘)
- Segunda línea: "Desbloqueas el teléfono **82 veces** al día." (si hay dato de desbloqueos).
- Sin datos (0 minutos en todo el período, p. ej. teléfono nuevo): "Todavía no hay datos
  de uso en este teléfono." y se sigue con la estimación.
- iOS (D1): el bloque de número + comparación se dibuja **dentro de la extensión** (§7);
  el botón "Continuar" es RN.

### 3.4 Lo que suma — `life`

- Eyebrow: "3 h 3 min al día" (dato real o estimación, con "según lo que creías" si es
  estimación).
- Título: **"En 30 años, eso suma:"**
- Número héroe: **"3,8"** + "**años** frente a la pantalla". Debajo: "Son 46 días al año."
- Fórmula (`lifeTotals`, pura): `años = horasDiarias × 30 / 24`; `díasPorAño =
  horasDiarias × 365 / 24`, redondeo a 1 decimal / entero; formato con `Intl.NumberFormat`
  del idioma (coma decimal en español).
- iOS (D1): se dibuja en la extensión (necesita el dato real).

### 3.5 Dónde se va + estudio — `where`

- Con datos (Android): título **"Casi la mitad es de 3 apps."** (texto según el porcentaje
  real: "La mitad…", "Un tercio…", o "Tus 3 apps más usadas:" si < 25 %). Tres barras con
  ícono, nombre y "1 h 12 min al día", creciendo con `GrowFill`.
- Siempre: tarjeta del estudio (D3): **"Una pausa corta cambia el hábito."** — "En un
  estudio publicado en PNAS (2023), una pausa antes de abrir redujo 57 % las aperturas en
  6 semanas. 1 de cada 3 veces, la gente decidió no entrar." Pie: "Grüning, Riedel y
  Lorenz-Spreen · Max Planck y U. de Heidelberg · con la app one sec". Tocar el pie abre
  `https://www.pnas.org/doi/10.1073/pnas.2213114120` con `external-browser`.
- Sin datos: solo la tarjeta del estudio, con el título como encabezado.
- iOS (D1): la lista de top apps se dibuja en la extensión (`Label(token)`).

### 3.6 El gesto automático — `habit` (interactivo)

- Título: **"Los viejos hábitos se activan solos: tocas sin pensar."**
- Visual: `PhoneFrame` (teléfono genérico, sin marca) con una pantalla de inicio 4×5 de
  íconos neutros atenuados; la app objetivo (D10) resaltada, con su nombre, y una flecha
  mineral animada que la señala.
- Pista: "Toca la app o pulsa Continuar." Tocar el ícono (o Continuar) pasa a 3.7 con la
  animación de apertura.

### 3.7 La pausa — `pause-demo` (interactivo)

- Título: **"Still aparece antes. Tú eliges."**
- Dentro del `PhoneFrame`, `PauseReplica` de la plataforma, con **los mismos textos que la
  pausa real** (importados de un módulo compartido `src/lib/pause-copy.ts` que también usa
  `shortcut-intervention.tsx`; los strings de Kotlin se comparan en `native-config.test.ts`).
- Interacción: tocar "Volver" / "Ya no quiero entrar" → el teléfono vuelve a inicio y la
  leyenda dice "Volver es un toque."; tocar "Ver anuncio" → leyenda "Un anuncio te deja
  entrar el tiempo que elijas. Si no hay anuncio, una espera breve." Continuar habilitado
  desde el principio.

### 3.8 Cómo funciona — `how`

Tres filas numeradas (ícono + frase) y un pie de privacidad:

1. "Eliges las apps que abres sin pensar."
2. "Antes de abrirlas aparece la pausa: volver o entrar."
3. "Entrar cuesta un anuncio. Los anuncios financian Still y un fondo semanal que la
   comunidad decide en Impacto." (Texto de fondo alineado con el de la pestaña Impacto;
   nunca "mira un anuncio y dona" — voz de marca, principio 4.)

Pie: "Tus apps y tu uso no salen de este teléfono." CTA: **"Configurar Still"**.

---

## 4. La configuración verificada

### 4.0 Inventario actual y huecos [código]

| Hoy | Hueco que este plan cierra |
|---|---|
| `setOnboarded(true)` antes de configurar (`app/(onboarding)/index.tsx:214-221`); `onboarded` es lo único que da paso a Hoy (`app/index.tsx:5-9`). | D9: `onboarded` al final; progreso persistido por paso. |
| iOS: la prueba real existe (`shortcut-setup.tsx:442-494`, `beginShortcutSetupProbe`, intent `consumeSetupProbe` en `StillShortcutIntent.swift:154-165`). | Ver 4.4: la prueba pasa a ser el criterio de avance y se arreglan sus fallas. |
| iOS: "Conectada" = `verifiedAt`, que se fija en el primer disparo **y nunca caduca** (`StillShortcutIntent.swift:128-138`). | En el onboarding, "verificada" = disparo **durante esta configuración** (`lastTriggeredAt ≥ inicio de la sonda`), no un `verifiedAt` viejo. |
| iOS nivel "una automatización": si «App actual» entrega un nombre que no coincide con el guardado, el intent adopta un `detected:` nuevo, la sonda no coincide y la persona ve una pausa **real** (contada) en vez de la de prueba. | 4.4: con sonda activa, un nombre desconocido que no es otra app elegida se aprende como **alias** de la app sondeada. |
| iOS: tras la prueba se pierde el parámetro `onboarding` y el estado local de la sonda (el `replace('/intervention')` desmonta la pantalla); ventana JS de 6 s vs 120 s nativos; `setNow` corre antes de `refresh()` y puede mostrar un "no se detectó" falso. | La sonda vive en `onboardingProgress`; al terminar la prueba se vuelve al paso; se refresca antes de evaluar; un solo criterio de tiempo (4.4). |
| iOS: el atajo de retorno `Still - <App>` (apps sin scheme) nunca se comprueba; el aviso "Permitir siempre" aparece recién al desbloquear. | 4.4: prueba de retorno opcional y verificada. |
| iOS: los avisos se piden en Hoy (`_layout.tsx:59-102`); no hay entitlement de avisos urgentes aunque el aviso usa `.timeSensitive`. | Paso 14I + entitlement (hipótesis HI3). |
| iOS: `restrictionsEnabled` nativo es `false` hasta el primer `syncWallet` (`SharedRestrictionState.swift:31-34`), que espera a `hydrated`: sin ese sync, el intent calla y la prueba falla. | Los pasos de prueba esperan `nativeSynced` (nuevo en `app-state`) y, sin conexión, lo dicen. |
| Android: "autorizado" = Still figura en `ENABLED_ACCESSIBILITY_SERVICES`, no que el servicio esté corriendo; `StillAccessibilityService.active` existe pero no se expone. | `getHealth().serviceRunning`; el paso exige habilitado **y** corriendo. |
| Android: el consentimiento de la divulgación no se guarda. | Se guarda `accessibilityDisclosureAcceptedAt` (evidencia para Play). |
| Android: **no hay prueba de la pausa**; `lastPauseAt` prueba detección, no que la pausa se vio (`StillAccessibilityService.kt:97-130`); una prueba hoy contaría como apertura. | 6.4: modo prueba en `InterventionActivity`, que registra que **se mostró**. |
| Android: batería/autoarranque/ventanas emergentes nunca se leen; `isAggressiveOem` no se usa; los consejos OEM solo están en reparar. | Paso 13A: batería verificada con `isIgnoringBatteryOptimizations`; lo que no tiene API lo prueba 14A. |
| Android: "Listo" siempre va a Ajustes, también en el onboarding. | El flujo decide el destino. |
| No hay flujos Maestro; los scripts de aceptación saltean la UI de configuración. | Fase 8 documenta capturas de cada paso; `acceptance:shield` sigue como gate. |

### 4.1 Paso 9 — 18+

El checkbox actual ("Confirmo que tengo 18 años o más."), en su propia pantalla con una
línea de por qué: "Still se financia con anuncios." Se guarda `adultConfirmedAt`.
Verificación: autodeclaración (no hay otra).

### 4.2 Paso 10 — Anuncios y privacidad (solo si UMP lo exige, D12)

`AdsConsent.requestInfoUpdate()`; si `status === REQUIRED` → pantalla "Tus anuncios, tu
elección" con una frase y CTA "Elegir" → `AdsConsent.gatherConsent()`. Verificación: UMP
queda en `OBTAINED` (o `NOT_REQUIRED`). Si `canRequestAds` sale `false`, se sigue igual y el
resumen final dice: "Sin anuncios, la pausa te deja entrar tras una espera breve." No
bloquea. `reward-provider.ts` deja de ser el primer lugar donde aparece el formulario.

### 4.3 Android

**11A · Activar Still (Accesibilidad)**
1. Hoja de divulgación actual (`confirmAccessibilityDisclosure`), sin cambios de texto; al
   aceptar se guarda la fecha.
2. Tarjeta con las 3 réplicas existentes (`ANDROID_SCREENS`: fila de Still → interruptor
   "Usar Still" → "Permitir"), rótulos en el idioma del teléfono (`androidSys`).
3. Bloque **"¿Se ve distinto?"** (§5.2) con el camino del fabricante desde `android-oem.ts`
   (nuevo campo `accessibilityPath` por OEM; texto genérico: "Busca «Still» con la lupa de
   Ajustes").
4. CTA "Abrir Accesibilidad" → 6.2 (resaltado/detalle + vuelta automática).
5. Verificado cuando `authorization === "authorized"` **y** `serviceRunning`. Si está
   habilitado pero no corre (MIUI tras forzar detención): "Still está activado pero no
   arrancó" + apagar y encender, con la misma guía.
6. Si no se activó y `likelyRestricted`: sub-paso "Permitir ajustes restringidos" con su
   réplica (Información de la app → ⋮ → "Permitir ajustes restringidos") y reintento.

**12A · Elegir apps** — `presentAppPicker({suggested})` (6.3). Verificado: `selectedCount ≥ 1`
(`getHealth`). Muestra los íconos elegidos y "Cambiar".

**13A · Mantener Still activo** (solo si `isAggressiveOem(manufacturer)`; Xiaomi/Redmi/POCO,
Huawei/Honor, Oppo/OnePlus/Realme, vivo/iQOO, Samsung)
- Batería "Sin restricciones": `isIgnoringBatteryOptimizations()` (nuevo, `PowerManager`);
  CTA abre `ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS` (sin el permiso
  `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`, que Play restringe) o Información de la app.
  **Verificado** por la API.
- Autoarranque / ventanas emergentes (Xiaomi) y equivalentes: no hay API pública → casilla
  "Listo" de la persona + los consejos existentes de `oemGuidance`. Lo que falte lo
  delata 14A.

**14A · Prueba real (obligatoria, D8)**
- "Ahora pruébalo: abre {app}." (primera app elegida; si hay datos, la más usada de las
  elegidas). CTA "Abrir {app}" → `beginSetupProbe(package)` + intent de lanzamiento.
- La pausa aparece en modo prueba (6.4) → "Volver a Still" → pantalla ✓ "Funciona."
- Verificado: `setupProbeVerifiedAt ≥ inicio de la sonda` (lo escribe `InterventionActivity`
  al mostrarse). Si a los 20 s de volver a Still no hay verificación: "La pausa no
  apareció." + diagnóstico en orden: servicio corriendo → app en la selección → consejos
  del fabricante (ventanas emergentes en Xiaomi) → "Probar otra vez".

### 4.4 iOS

**11I · Elegir apps** — `ios-apps` embebido como paso (misma lista, catálogo + propias).
Verificado: ≥ 1 app elegida en Still. En el nivel "una automatización" se mantiene la
tarjeta "Elegirla desde tu iPhone".

**12I · Conectar Atajos** — los pasos y réplicas de `shortcut-setup.tsx` (niveles A/B/C,
`stepCopy`, `SHORTCUTS_SCREENS`), una tarjeta por paso, cada una con:
- la meta del paso en palabras propias además del rótulo literal (p. ej. "Que se ejecute
  sola, sin pedirte confirmación" junto a «Ejecutar inmediatamente»);
- el bloque "¿Se ve distinto?" (§5.2);
- en iOS < 26, aviso: "Cuando pruebes, iOS va a preguntar «¿Continuar en Still?»: toca
  Continuar." (hoy solo está en la documentación).
Este paso no tiene señal propia (iOS no deja leer automatizaciones) → su verificación es 13I.

**13I · Probar cada app (obligatorio, D8)**
- Una fila por app elegida: ○ sin probar · ⏳ esperando · ✓ funciona · ✕ no apareció.
  Tras un ✓, "Probar {siguiente}".
- La sonda (`targetId`, `startedAt`) se guarda en `onboardingProgress`, no en estado local.
- Criterio único: ✓ si `lastTriggeredAt ≥ startedAt − 1 s` (tras `refresh()`); ✕ si Still
  volvió al frente, pasaron ≥ 8 s desde `startedAt` (≥ 20 s en iOS < 26, por el diálogo) y
  no hubo disparo; la sonda nativa sigue durando 120 s, así que un disparo tardío todavía
  vale. ✕ lleva a la reparación actual (`/shortcut-repair`) y vuelve al paso.
- Pantalla "SETUP TEST · {App} está conectada." → "Continuar" vuelve **al onboarding**
  cuando hay uno en curso (hoy vuelve a `/shortcut-setup`).
- Alias con sonda (`StillShortcutIntent.swift`): con una sonda activa, si llega un nombre
  desconocido que **no** es otra app elegida, se guarda como alias de la app sondeada y la
  corrida se trata como prueba (no cuenta como apertura). Test de la lógica en
  `shortcut-targets.test.ts` (reflejo en TS) + `acceptance:ios-shortcuts`.
- **Retorno directo (opcional, verificado)** para apps sin scheme: tras crear
  `Still - {App}` (pasos `return_*` existentes), "Probar volver" arma una sonda de tipo
  `return` y ejecuta `shortcuts://run-shortcut?name=Still - {App}`; el atajo abre la app,
  la automatización dispara con la sonda de retorno y Still vuelve con ✓. Así el
  "Permitir siempre" de iOS aparece aquí y no al desbloquear [hipótesis HI4].

**14I · Avisos** — se mueve aquí la hoja de `_layout.tsx` ("Te avisamos cuando termina tu
tiempo") y se pide el permiso. Verificado: `granted`. Si `denied`: "Activar en Ajustes"
(`Linking.openSettings()`) y se re-verifica al volver. Recomendado, no bloquea. Se agrega
`com.apple.developer.usernotifications.time-sensitive` a `Still.entitlements` para que el
aviso atraviese Concentración [hipótesis HI3]. La hoja de Hoy queda para quien ya estaba
onboarded.

### 4.5 Paso 15 — Listo

Resumen con cada ítem y su estado (✓ verificado · "recomendado" pendiente). Ejemplo Android:
"✓ Still activado · ✓ 3 apps · ✓ Batería sin restricciones · ✓ Probado con Instagram".
CTA **"Ir a Hoy"** → `onboarded = true`. "Terminar después" (texto chico, disponible desde el
paso 11) → `onboarded = true` y Hoy muestra la tarjeta **"Termina de configurar Still"**
mientras falte algo requerido; la tarjeta lleva al primer paso sin verificar.

### 4.6 Fuera del onboarding

Una ruta `/setup` renderiza solo la parte de configuración de la misma máquina, empezando
en el primer paso sin verificar. Ajustes ("Configuración de la pausa") y la tarjeta de Hoy
llevan ahí. `android-setup.tsx` y `shortcut-setup.tsx` pasan a usar los mismos componentes
de paso (o se reducen a redirigir a `/setup`); las pantallas de reparación se mantienen.

---

## 5. Verificación

### 5.1 Señal por paso

| Paso | Señal | Dónde se lee | Cuándo | Si falla |
|---|---|---|---|---|
| 2 Acceso de uso (A) | `hasUsageAccess()` | nativo nuevo | al volver (AppState `active`) | mini-guía + reintentar / seguir sin dato |
| 2 Tiempo en pantalla (iOS, D1) | resultado de `requestAuthorization()` | nativo existente | al cerrar el diálogo | seguir sin dato |
| 9 18+ | casilla | RN | al tocar | no avanza |
| 10 Anuncios | UMP `OBTAINED`/`NOT_REQUIRED` | `AdsConsent` | al cerrar el formulario | sigue; resumen lo dice |
| 11A Accesibilidad | habilitado **y** `serviceRunning` | `getHealth` | deep link de vuelta o `active` | guía + ajustes restringidos |
| 12A Apps | `selectedCount ≥ 1` | `getHealth` | al cerrar el selector | vuelve a abrir el selector |
| 13A Batería | `isIgnoringBatteryOptimizations()` | nativo nuevo | `active` | recomendado; sigue |
| 13A Autoarranque/popups | casilla + 14A | — | — | lo delata 14A |
| 14A Prueba | `setupProbeVerifiedAt ≥ inicio` | nativo nuevo | deep link o `active` | diagnóstico ordenado |
| 11I Apps | ≥ 1 app en `shortcutTargets` | RN | al continuar | no avanza |
| 12I Atajos | — (no hay API) | — | — | lo prueba 13I |
| 13I Prueba por app | `lastTriggeredAt ≥ startedAt − 1 s` | `getShortcutTargetsHealth` | `active` + `refresh()` | reparación y vuelta |
| 13I Retorno (opcional) | disparo con sonda `return` | idem | idem | reintentar / omitir |
| 14I Avisos | `getPermissionsAsync().granted` | expo-notifications | al responder / `active` | abrir Ajustes |
| Todos los de prueba | `nativeSynced` (kill switch en nativo) | `app-state` | antes de armar la sonda | "Necesitamos conexión para terminar" |

### 5.2 Cuando la pantalla del teléfono no coincide

- La ilustración nunca es la única guía: cada paso dice **la meta** ("Still tiene que
  quedar activado") además de los rótulos literales.
- Los rótulos salen de las tablas oficiales del idioma del teléfono (ya existentes:
  `system-strings.ts`, es / es-419 / en).
- "¿Se ve distinto?" abre una hoja con: el camino del fabricante (Android, `android-oem.ts`)
  o de la versión (iOS < 26 / 26+); la salida universal ("Busca «Still» en la lupa de
  Ajustes" / "En Atajos, pestaña Automatización, toca +"); y "Volver a intentar".
- **Nunca se avanza con un "Ya lo hice" cuando existe una señal.** Las únicas casillas
  autodeclaradas son las que no tienen API (autoarranque, ventanas emergentes), y la prueba
  real las cubre.

---

## 6. Android: lectura de uso y ayudas nativas

### 6.1 Módulo `StillUsageInsights.kt` (nuevo) + puente en `StillRestrictionModule.kt`

| Método RN | Qué hace |
|---|---|
| `hasUsageAccess(): boolean` | `AppOpsManager.unsafeCheckOpNoThrow(OPSTR_GET_USAGE_STATS, uid, pkg) == MODE_ALLOWED` (el código borrado en `0361a36` sirve de base). |
| `openUsageAccessSettings(): boolean` | `ACTION_USAGE_ACCESS_SETTINGS` con `data = package:com.still.screentime` (abre la fila de Still donde el sistema lo admite [hipótesis HA1]); si lanza excepción, la misma acción sin `data`; si también falla, `ACTION_APPLICATION_DETAILS_SETTINGS`. No espera resultado: RN verifica al volver. |
| `getUsageSummary(days = 7): UsageSummary` | Ver 6.1.1. Nunca persiste nada; devuelve y olvida. |
| `getAppIcon(packageName, sizeDp = 48): string \| null` | PNG en `data:` URI desde `packageManager.getApplicationIcon` (para 3.5/3.6). |
| `getHealth()` + `serviceRunning` | `StillAccessibilityService.active` (hoy existe, no se expone) — 11A. |
| `isIgnoringBatteryOptimizations(): boolean` | `PowerManager.isIgnoringBatteryOptimizations(pkg)` — 13A. |
| `openBatterySettings(): boolean` | `ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS`, si no, Información de la app — 13A. |
| `setSetupAwaiting(step: "accessibility" \| null)` | Prefs con vencimiento de 10 min para la vuelta automática (6.2). |
| `beginSetupProbe(pkg)` / `getSetupProbeResult()` | Prueba real (6.4). |

`UsageSummary = { days: { date: "YYYY-MM-DD", foregroundSeconds, unlocks }[], topApps: { packageName, label, dailySeconds }[], measuredDays, partialToday }`.

#### 6.1.1 Cálculo (puro y testeado)

- Fuente: `UsageStatsManager.queryEvents(inicioDelDíaLocal − 7 días, ahora)`. Se usa la
  secuencia de eventos, no `queryAndAggregateUsageStats` (su `totalTimeInForeground` se
  desvía del Bienestar digital).
- Lógica en un objeto Kotlin **sin dependencias de Android** (`UsageSessions`) que recibe
  `(timestamp, package, class, type)` y devuelve segundos por día local y paquete:
  `ACTIVITY_RESUMED` abre sesión por (paquete, clase); `ACTIVITY_PAUSED`/`ACTIVITY_STOPPED`
  la cierra; `SCREEN_NON_INTERACTIVE`, `KEYGUARD_SHOWN` y `DEVICE_SHUTDOWN` cierran todas;
  las sesiones se parten en la medianoche local; una sesión abierta al final se cierra en
  `ahora`. Un paquete con varias actividades cuenta el tiempo una sola vez (unión de
  intervalos).
- Se excluyen: Still, el launcher por defecto (`resolveActivity(HOME)`), `com.android.systemui`
  y paquetes sin actividad de lanzador (la consulta `LAUNCHER` ya está declarada en el manifiesto).
- Desbloqueos: `KEYGUARD_HIDDEN` por día; si el período entero da 0 pero hay uso (teléfono
  sin bloqueo), se usa `SCREEN_INTERACTIVE`.
- Promedio: días **completos** con uso > 0 dentro de los últimos 7; si no hay ninguno,
  hoy hasta ahora con `partialToday = true`. Top apps: promedio diario por paquete en los
  mismos días, 5 primeras, `label` desde `PackageManager`.
- Tests JVM: se agrega `testImplementation "junit:junit:4.13.2"` a
  `android/app/build.gradle` y `android/app/src/test/java/.../UsageSessionsTest.kt`
  (sesiones que cruzan medianoche, dos actividades del mismo paquete, pantalla apagada con
  sesión abierta, launcher excluido, desbloqueos con y sin keyguard). Se corre con
  `./gradlew :app:testDebugUnitTest` (necesita `ANDROID_HOME`).
- Las cuentas de presentación (promedio → "3 h 3 min", comparación, años, porcentaje de
  las top 3) viven en TypeScript (`src/lib/onboarding-insights.ts`) con Vitest.

### 6.2 Vuelta automática a Still

- **Accesibilidad:** cuando RN abre Ajustes para este paso, guarda en prefs
  `setupAwaiting = "accessibility"` con vencimiento de 10 min. En
  `StillAccessibilityService.onServiceConnected`, si está vigente, lanza
  `MainActivity` con `still://onboarding?verified=accessibility`
  (`FLAG_ACTIVITY_NEW_TASK | FLAG_ACTIVITY_REORDER_TO_FRONT`) y lo borra. Un servicio de
  accesibilidad enlazado por el sistema está exento de la restricción de abrir actividades
  desde segundo plano [web: Android BAL]; el escudo ya lo usa.
- **Acceso de uso:** sin vuelta automática (Still no tiene exención en ese momento). La
  guía dice "Cuando lo actives, vuelve con ◀" y la verificación ocurre al volver.
- **Resaltar a Still en la lista:** a `ACTION_ACCESSIBILITY_SETTINGS` se le agrega el extra
  `:settings:fragment_args_key` = componente del servicio (resalta la fila en Pixel)
  [hipótesis HA2]; y en API 31+ se prueba primero `ACTION_ACCESSIBILITY_DETAILS_SETTINGS`
  con `EXTRA_COMPONENT_NAME` [hipótesis HA3]. Cada intento cae al siguiente si lanza.

### 6.3 Selector con sugerencias (D11)

`presentAppPicker` acepta `suggested: {packageName, dailySeconds}[]`. `AppPickerActivity`
muestra esa sección arriba ("LAS QUE MÁS USAS", minutos al día a la derecha), sin marcar,
y debajo la lista completa como hoy. Sin sugerencias, igual que hoy.

### 6.4 Prueba real en Android (paso 14A)

- `beginSetupProbe(packageName)` guarda `setupProbe = {package, expiresAt: +2 min}`.
- `StillAccessibilityService`, al detectar esa app con la sonda vigente, abre
  `InterventionActivity` en **modo prueba**: título "Así aparece la pausa.", texto "Todo
  funciona. Cuando abras {app}, vas a ver esto.", un solo botón "Volver a Still". No cuenta
  como apertura, no carga anuncio, no toca contadores. Guarda `setupProbeVerifiedAt` y
  vuelve con `still://onboarding?verified=probe`.
- `getSetupProbeResult(): {verifiedAt?: string}` para que RN lo lea al volver (por si el
  deep link no llega).
- `native-config.test.ts` pasa a exigir: permiso `PACKAGE_USAGE_STATS` presente con
  `tools:ignore="ProtectedPermissions"`, `UsageStatsManager` usado **solo** en
  `StillUsageInsights.kt`, y que ningún archivo que haga red lo importe.

---

## 7. iOS con Family Controls (rama apilada, D1)

Todo lo de esta sección va en `feat/onboarding-ios-screen-time`, sobre `feat/onboarding-story`.
En `feat/onboarding-story` iOS solo necesita saber **si** hay informe:
`isScreenTimeReportAvailable()` → `false` en los builds actuales.

- **Extensión** `StillScreenTimeReport` (bundle `app.still.ios.ScreenTimeReport`), a partir
  de `ios/StillDeviceActivityReport/` (reescrita): contextos `still.onboarding.reveal`,
  `still.onboarding.life`, `still.onboarding.top`. Dibuja con SwiftUI los bloques de 3.3,
  3.4 y 3.5 con la tipografía Recursive empaquetada en la extensión y los colores de
  `tokens.ts`; las cuentas replican `onboarding-insights.ts` (tests Swift no hay: se
  comparan valores fijos en un test de TS que lee el `.swift`, como `native-config.test.ts`).
- **Estimación en la extensión:** la extensión lee `guessMinutes` de
  `UserDefaults(suiteName: "group.app.still.ios")`. Apple describe el sandbox del informe
  como de solo lectura [web] → **hipótesis HI1**. Si no puede leerla, la comparación se
  dibuja en RN arriba ("Creías: 2 h") y la extensión muestra solo el número real.
- **Entitlements:** `com.apple.developer.family-controls` en `Still.entitlements` y en la
  extensión; App Group en ambas. `StillActivityReportView` pasa a aceptar el contexto y el
  intervalo (7 días completos).
- **Nativo:** `isScreenTimeReportAvailable()` = el `.appex` está en
  `Bundle.main.builtInPlugInsURL` **y** el entitlement está presente;
  `requestAuthorization()` ya existe (`StillRestrictionEngine.swift:20`).
- **Flag remoto** `iosScreenTimeInsightsEnabled` en `packages/contracts/src/schemas.ts`
  (`.default(false)`, mismo patrón que `iosHomeOnCancelEnabled`), en `/admin`
  (`apps/web/app/admin/actions.ts` + `page.tsx`) y en `dev-config`. Los pasos 2–3 de iOS
  aparecen solo con flag **y** informe disponible.
- **Pasos del usuario (Apple):** registrar el App ID de la extensión con App Group y Family
  Controls; pedir **Family Controls (Distribution)** para `app.still.ios` y
  `app.still.ios.ScreenTimeReport` en developer.apple.com/contact/request/family-controls-distribution
  (días a semanas; en 2026 hay reportes de demoras [web]); crear credenciales EAS del
  nuevo target (`eas credentials`, interactivo); actualizar ficha y notas de revisión
  (`docs/store-listing.md`, `docs/store-compliance.md`) — "Still usa Tiempo en pantalla
  solo para mostrarte tu uso; los datos no salen del iPhone".
- **Validación:** compila en simulador con firma de desarrollo; el informe con datos solo
  se ve en el iPhone del usuario (iOS 27) con un build de desarrollo (hipótesis HI1, HI2).

---

## 8. Piezas de interfaz nuevas

| Pieza | Dónde | Notas |
|---|---|---|
| `StoryScreen` | `src/components/onboarding/story-screen.tsx` | Top bar (marca, progreso continuo con `GrowFill`, Saltar), cuerpo, pie con CTA primario + secundario de texto. Reusa `densityFor` y `fitBreaks` (se mueven a `src/lib/onboarding-layout.ts`). |
| `SteppedSlider` | `src/components/stepped-slider.tsx` | Extraído de `DurationSlider`, pasos genéricos, háptica. |
| `BigNumber` | `src/components/onboarding/big-number.tsx` | `AnimatedNumber` de `motion.tsx`, tamaño `type.dataHero`, unidad pequeña. |
| `ComparisonChip` | idem | Flecha ↗/↘ + porcentaje, durazno/mineral. |
| `UsageBars` | idem | Siete barras (vacías con "?" en 3.2) y barras por app (3.5). |
| `PhoneFrame` + `HomeGrid` | `src/components/onboarding/phone.tsx` | Teléfono genérico (sin marca), barra de estado réplica con la hora real, grilla 4×5 neutra, app objetivo resaltada. |
| `PauseReplica` | `src/components/onboarding/pause-replica.tsx` | Variante iOS y Android con los textos de `src/lib/pause-copy.ts`. |
| `SetupStep` | `src/components/setup/setup-step.tsx` | Estado (pendiente / esperando / verificado ✓ / falló) + ilustración + CTA + "¿Se ve distinto?" (§5.2). Lo reusan onboarding, Ajustes y la tarjeta de Hoy. |

---

## 9. Privacidad, tiendas y cumplimiento

- **Play:** `PACKAGE_USAGE_STATS` no tiene formulario de declaración propio, pero la
  política User Data exige divulgación destacada antes de acceder a datos sensibles [web]:
  3.2 es esa divulgación (qué, para qué, que no sale del teléfono) y el acceso lo concede la
  persona en Ajustes. **Data safety:** los datos se procesan solo en el dispositivo → no
  se declaran como recopilados. Actualizar `docs/store-compliance.md` (la línea "Still
  does not request Usage Access" cambia) y el video de la declaración de Accesibilidad no
  cambia.
- **Consentimiento de anuncios (D12):** `AdsConsent.gatherConsent` en el paso 10 cubre
  iOS y además cierra el hueco de Android (el SDK de GMA del proceso del escudo lee el
  estado IABTCF que UMP guarda en las SharedPreferences por defecto de la app)
  [hipótesis HA4: comprobar en el emulador con geografía EEE de depuración de UMP].
- **App Store:** sin cambios en `feat/onboarding-story` (iOS no pide nada nuevo). La rama
  de §7 cambia ficha, notas y etiqueta de privacidad (sin datos recopilados).
- **Analítica:** solo los eventos de D14; `analytics.test.ts` agrega casos que prueban que
  un nombre de app o minutos no pasan el filtro.

---

## 10. Casos borde

- Still muere en segundo plano mientras la persona está en Ajustes/Atajos (MIUI lo hace):
  al abrir, `onboardingProgress` retoma el paso y lo re-verifica (D9).
- La persona concede Acceso de uso y luego lo quita: la historia ya pasó; nada más lo usa.
- Teléfono nuevo / sin datos: 3.3 dice que no hay datos y la historia sigue con la estimación.
- Estimación 12 h o más y uso real mucho menor: "X % menos de lo que creías" (sin juicio).
- Idioma distinto de es/en: inglés (como el resto de la app).
- Pantalla chica / texto grande: `StoryScreen` hace scroll solo en ese caso (como hoy).
- `iosRestrictionEnabled` / `androidRestrictionEnabled` apagados: la historia se muestra;
  la configuración se reemplaza por "Las pausas vuelven pronto" (comportamiento actual) y
  `onboarded = true`.
- Usuarios existentes (`onboarded = true`): no ven el onboarding nuevo. La tarjeta
  "Configuración incompleta" de Hoy aparece también para ellos si algún paso requerido
  deja de verificar (p. ej. Accesibilidad apagada).

---

## 11. Hipótesis (se validan en la fase indicada; cada una tiene salida)

| # | Hipótesis | Fase | Si falla |
|---|---|---|---|
| HA1 | `ACTION_USAGE_ACCESS_SETTINGS` con `package:` abre la fila de Still (emulador API 36 y Xiaomi Android 16) | F3 | Se abre la lista; la guía dice "busca Still". |
| HA2 | `:settings:fragment_args_key` resalta a Still en la lista de Accesibilidad | F4 | Sin resaltado; la réplica ya muestra dónde está. |
| HA3 | `ACTION_ACCESSIBILITY_DETAILS_SETTINGS` + `EXTRA_COMPONENT_NAME` abre la página de Still para una app no preinstalada (API 31+) | F4 | Cae a HA2 / lista. |
| HA4 | El GMA del proceso del escudo respeta el consentimiento que UMP guardó desde RN (IABTCF en SharedPreferences por defecto) | F6 | Se llama a UMP también desde Kotlin antes de precargar. |
| HA5 | `onServiceConnected` puede traer Still al frente (exención BAL de servicios de accesibilidad) en Android 16 y MIUI | F4 | La guía pide volver con ◀; la verificación al volver no cambia. |
| HA6 | Los eventos de uso cubren ≥ 7 días (MIUI puede guardar menos) | F3 | Se promedian los días que haya; el texto dice "últimos N días". |
| HI1 | La extensión de informe puede **leer** el App Group | F7 (dispositivo del usuario) | La comparación se dibuja en RN arriba. |
| HI2 | `DeviceActivityReport` muestra datos apenas se autoriza (Tiempo en pantalla activado) | F7 (dispositivo) | Estado vacío de la extensión; la historia sigue con la estimación. |
| HI3 | El entitlement de avisos urgentes se sincroniza con EAS sin trámite | F5 | Se quita la línea; el aviso sigue como nivel "activo". |
| HI4 | Abrir una app con el atajo `Still - {App}` dispara la automatización de esa app | F5 (simulador no dispara automatizaciones → dispositivo del usuario) | El retorno se marca "creado" (sin ✓) y se valida en la primera entrada real. |
| HI5 | Con sonda activa, el nombre de «App actual» que no coincide es de la app sondeada | F5 | Se desactiva el aprendizaje de alias y la fila explica "elige {App} en el trigger". |

---

## 12. Fases, criterios de terminado y `/goal`

Una fase = un commit (mensaje en español, con el Co-Authored-By del repo). Gates en cada
fase: `pnpm check`. Donde toque Kotlin: `./gradlew :app:testDebugUnitTest` y
`pnpm --filter mobile acceptance:shield` en el AVD `Still_QA_API_36`. Donde toque Swift:
build firmado de simulador ("Still QA", no el simulador del usuario) y
`pnpm --filter mobile acceptance:ios-shortcuts`.

| Fase | Contenido | Terminado cuando |
|---|---|---|
| **F1** | `src/lib/onboarding-flow.ts` (pasos aplicables por plataforma, capacidades, flags y datos; siguiente paso; reanudación), `src/lib/onboarding-insights.ts` (promedio, comparación, años, top 3, formatos es/en), `onboardingProgress` en storage, `nativeSynced` en `app-state`. | Tests de Vitest para cada rama de la máquina y cada fórmula; `pnpm check`. |
| **F2** | Historia sin datos nativos: `StoryScreen`, `SteppedSlider` (y `DurationSlider` encima), pasos 1, 4–8 (3.1, 3.4–3.8) con estimación, `PhoneFrame`/`HomeGrid`/`PauseReplica`, `pause-copy.ts` compartido; nuevo `app/(onboarding)/index.tsx` sobre la máquina; `onboarded` al final (D9). | Recorrido completo en simulador iOS y emulador Android con capturas en `docs/onboarding-v2/`; reducir movimiento probado. |
| **F3** | Android uso: `StillUsageInsights.kt`, `UsageSessions` + JUnit, permiso en manifiesto + `app.config.ts`, `native-config.test.ts` actualizado, pasos 2–3 y 3.5 con datos e íconos reales, D10 en 3.6. HA1, HA6. | Datos reales en el emulador (usar apps con `adb shell monkey -p <pkg> 1` durante unos minutos y comparar con `dumpsys usagestats`); sin permiso, la historia sigue con la estimación. |
| **F4** | Android configuración verificada: 11A (`serviceRunning`, disclosure guardada, HA2/HA3, vuelta automática HA5, ajustes restringidos), 12A con sugerencias (D11), 13A batería, 14A modo prueba en `InterventionActivity` + sonda. | En el emulador: cada paso avanza solo con su señal; apagar Accesibilidad a mitad vuelve al paso; la prueba no toca contadores (`getLocalWellbeing` antes/después); `acceptance:shield` verde. |
| **F5** | iOS configuración verificada: 11I–14I embebidos, sonda persistida y criterio único, vuelta al onboarding tras la prueba, alias con sonda (HI5), prueba de retorno (HI4), paso de avisos + entitlement (HI3), aviso de "¿Continuar en Still?" en iOS < 26. | En "Still QA": las pruebas pasan corriendo los atajos de biblioteca `Test Still News` / `Test Still Fitness` (hacen lo que haría la automatización); matar Still durante la prueba retoma el paso. |
| **F6** | Paso 10 (UMP, D12, HA4), tarjeta "Termina de configurar Still" en Hoy, ruta `/setup` y Ajustes, eventos de analítica (D14) + tests, `docs/store-compliance.md`, `docs/android-setup.md`, `docs/ios-shortcuts.md`. | UMP con geografía EEE de depuración muestra el formulario en el paso 10 y no en la primera pausa; `pnpm check`. |
| **F7** | Rama apilada `feat/onboarding-ios-screen-time` (§7): target de extensión, entitlements, `isScreenTimeReportAvailable`, flag `iosScreenTimeInsightsEnabled` (contracts + `/admin` + dev-config), contextos SwiftUI. **No se mergea.** | Compila y corre en simulador con firma de desarrollo; con el flag apagado iOS se comporta igual que en F5; checklist para el iPhone del usuario escrita en §14. |
| **F8** | Cierre: §14 de este documento (resultados, desvíos, capturas finales de cada paso en ambas plataformas en `docs/onboarding-v2/`), memoria del proyecto. | Todo lo anterior verde; nada pusheado sin pedido del usuario. |

### Prompt para `/goal`

```
/goal Implementar el onboarding v2 de Still siguiendo docs/onboarding-v2-plan.md en la rama
feat/onboarding-story (worktree aparte si otra sesión usa el checkout). Las decisiones D1–D14
están cerradas: no reabrirlas ni re-investigar lo que el plan ya resolvió. Ejecutar las fases
F1→F8 en orden, un commit por fase, con los gates de §12 en cada una (pnpm check; en Kotlin
./gradlew :app:testDebugUnitTest y acceptance:shield en el AVD Still_QA_API_36; en Swift build
firmado del simulador "Still QA" y acceptance:ios-shortcuts). Validar cada hipótesis de §11 en
su fase y, si falla, aplicar su salida y anotarlo en §14. F7 va en la rama apilada
feat/onboarding-ios-screen-time y no se mergea. Todo texto visible en inglés y español con
localize(), con la voz de docs/brand/04-voice-and-tone.md; ningún nombre de app ni dato de uso
sale del teléfono ni va a analítica. Cada paso de configuración avanza solo con su señal (§5.1).
Al terminar, completar §14 con resultados, desvíos y capturas en docs/onboarding-v2/, y dejar
lo que solo puede hacer el usuario (iPhone físico, Xiaomi, Apple, Play) en una lista. No pushear
ni mergear sin pedido explícito.
```

---

## 13. Fuentes

- Grüning, Riedel, Lorenz-Spreen (2023). *Directing smartphone use through the self-nudge
  app one sec.* PNAS 120(8). https://www.pnas.org/doi/10.1073/pnas.2213114120 ·
  resumen: https://pubmed.ncbi.nlm.nih.gov/36795756/ · https://one-sec.app/max-planck-study/
- Family Controls (Distribution), pedido por bundle ID y por extensión; demoras en 2026:
  https://developer.apple.com/forums/thread/725036 ·
  https://developer.apple.com/forums/thread/818553 ·
  https://newly.app/how-to/family-controls-entitlement
- Sandbox de solo lectura del informe de Device Activity:
  https://developer.apple.com/forums/thread/817516 ·
  https://developer.apple.com/forums/thread/818174
- Play, divulgación destacada y User Data:
  https://support.google.com/googleplay/android-developer/answer/10144311 ·
  https://support.google.com/googleplay/android-developer/answer/11150561
- Límite de inicio de actividades en segundo plano (exención de servicios enlazados como
  `AccessibilityService`): https://developer.android.com/guide/components/activities/background-starts

---

## 14. Resultados de la implementación

### 14.1 Commits

| Fase | Commit | Qué entró |
|---|---|---|
| F1 | `f748ffd` | `onboarding-flow.ts` (pasos, avance, reanudación, señales, `probeOutcome`), `onboarding-insights.ts`, progreso persistido, `nativeSynced`. |
| F2 | `8f911f2` | La historia en pantalla (estimación, lo que suma, estudio, demo del teléfono y de la pausa, cómo funciona, 18+), `SteppedSlider`, `pause-copy.ts`. |
| F3 | `36d7f36` | Acceso de uso en Android: `StillUsageInsights.kt` + `UsageSessions.kt` (JUnit), permiso, revelación, apps más usadas con íconos reales. |
| F4 | `7f493c0` | Configuración verificada en Android: Accesibilidad (corriendo), vuelta automática, selector con sugerencias, batería, prueba real en modo prueba, señal perdida. |
| F6 | `b640f01` | UMP en el onboarding, tarjeta "Termina de configurar Still" en Hoy, `/setup`, analítica sin datos, docs. (Antes que F5, ver 14.3.) |
| — | `c302f50` | Merge de `feat/ios-still-action` (sesión paralela: acción «Pausar <app>», selector y lista conectar/probar nuevos). |
| F5 | `b75aa6c` | Configuración verificada en iOS con los componentes de esa rama, avisos + entitlement de avisos urgentes, salidas de la pausa por "/". |
| F7 | `8b9e6d5` en **`feat/onboarding-ios-screen-time`** (apilada, **no mergear**) | Extensión de informe de Tiempo en pantalla, Family Controls, flag `iosScreenTimeInsightsEnabled`, ficha y notas de revisión. |
| F8 | este commit | §14/§15, capturas finales, memoria. |

### 14.2 Hipótesis

| # | Resultado | Evidencia / salida aplicada |
|---|---|---|
| HA1 | ✅ emulador API 36 | `ACTION_USAGE_ACCESS_SETTINGS` + `package:` abre la página de Still ("App usage data"). Falta Xiaomi. |
| HA2 | ⚪ no observable | Still ya aparece primera en "Downloaded apps"; el extra queda, no molesta. |
| HA3 | ❌ emulador API 36 | La página de detalle no se abre para una app descargada: Android muestra la lista. Salida: la lista (es lo que dibuja la réplica 1). |
| HA4 | ✅ emulador | UMP con geografía EEE de depuración: formulario en el paso 10 y claves `IABTCF_*` en las SharedPreferences por defecto, las que lee el SDK de anuncios del mismo proceso. |
| HA5 | ✅ emulador API 36 | Al tocar "Allow", `onServiceConnected` trae Still al frente y el paso queda verificado. Falta MIUI. |
| HA6 | ⏳ | El emulador solo tenía datos del día tras un arranque en frío; el texto usa el N real de días. Falta Xiaomi. |
| HI1 | ⏳ dispositivo | La extensión lee la estimación del App Group; si no puede, la pantalla la muestra arriba ("creías 3 h"). |
| HI2 | ⏳ dispositivo | El permiso llega al diálogo de Apple en el simulador; el informe con datos requiere el iPhone (no se ingresó el código del simulador). |
| HI3 | ✅ tras un trámite (2026-09-25) | EAS no lo sincroniza solo: en modo no interactivo no se autentica ante Apple y usa el perfil guardado, y con la clave de App Store Connect «sincroniza» la capacidad sin que Apple la guarde. Hubo que marcar «Time Sensitive Notifications» a mano en el App ID `app.still.ios` (developer.apple.com) y regenerar el perfil con `eas env:exec production "eas credentials -p ios" --non-interactive` (borrar el perfil del proyecto y "All: Set up…"). Perfil F5RWG7MZD4; iOS 0.3.0 (12) con el entitlement en TestFlight. Entre medio salió 0.3.0 (10) sin él. |
| HI4 | ⏳ dispositivo | "Probar volver" existe para apps sin scheme; que abrir con `Still - <App>` dispare la automatización solo se ve en un iPhone. |
| HI5 | — sin objeto | La rama paralela eliminó el nivel "una automatización": el nombre llega exacto desde la AppEntity. No se implementó el alias. |

### 14.3 Desvíos respecto al plan

- **Orden F6 → F5.** La sesión «iOS shortcut y selección de apps» estaba rehaciendo `ios-apps`,
  `shortcut-setup` y `StillShortcutIntent` en `feat/ios-still-action`. Se acordó mergear su rama
  antes de F5 y embeber sus componentes (`IosAppPicker`, `ShortcutGuide`, `ShortcutConnectList`
  con `probe`/`onProbeStart`/`returnTo` externos) en vez de reescribirlos.
- **iOS sin nivel "una automatización".** Consecuencia de esa rama: la guía de 12I es la de "una
  automatización por app con «Pausar <app>» ya lista"; HI5 queda sin objeto.
- **F2 no cerraba D9.** `onboarded` al final llegó con F4 (Android) y F5 (iOS); mientras tanto el
  paso de plataforma entraba a las pantallas viejas.
- **"Conectada" en iOS** = la automatización disparó durante esta configuración (`firedSince`),
  sea por la prueba con sonda o por una pausa real si la persona abrió la app antes de probar.
- **Espera de la prueba en iOS**: 8 s (antes 6 s), 20 s en iOS < 26.
- **Rótulos de Acceso de uso por versión de Android.** Android 15 y 16 renombraron la página
  ("App usage data" / "Permitir el acceso a los datos de uso de la app"); la guía elige por
  `Platform.Version` con las tablas de AOSP android14/15/16-release (`usageAccessKeys`).
- **Ajustes fuera del cálculo de uso** (es adonde el propio onboarding manda) y del selector.
- **UsageSessions** también devuelve encendidos de pantalla: sin pantalla de bloqueo, los
  "desbloqueos" son encendidos (TS decide).
- **Sin migración de Supabase para el flag nuevo**: la función de publicar no rechaza claves nuevas
  y el esquema lee la ausente como `false`.

### 14.4 Bugs encontrados en QA (todos corregidos)

1. Réplica de la pausa: sus botones quedaban bajo el fundido del teléfono → `PhoneFrame fit`.
2. Si el sistema mataba Still en Ajustes (o volvía por Fast Refresh), el paso de Acceso de uso no
   re-verificaba → `usageRequestedAt` en el progreso.
3. Íconos de apps que nunca llegaban: el efecto que guardaba el resumen se cancelaba solo.
4. "Más de la mitad es de 3 apps" con 2 apps → la cuenta real.
5. El resumen final podía mostrar un dato de salud viejo → cada paso de configuración vuelve a
   leer el teléfono al mostrarse.
6. Una pausa real durante el onboarding de iOS terminaba en Hoy sin haber terminado → las cinco
   salidas de la pausa van a "/", que decide Hoy u onboarding.
7. Build F7: ciclo al embeber la extensión después del script de AdMob; `Label(token)` sin
   `import FamilyControls`.

### 14.5 Verificación

- `pnpm check` en cada fase (final: mobile 262, contracts 30 (31 en F7), web 68).
- `./gradlew :app:testDebugUnitTest`: 8 tests de `UsageSessions`.
- `acceptance:shield` verde en F3 y F4 con `com.google.android.deskclock=Clock
  com.google.android.contacts=Contacts`. Con Gmail/YouTube/Calendar el gate no es fiable en este
  AVD (tour de Gmail, actualización forzada de YouTube, alta de cuenta de Calendar sobre el
  escudo) y falla igual con el nativo de `main`: no es regresión.
- Build de simulador firmado (sin tocar `project.pbxproj`; `DEVELOPMENT_TEAM` por línea de
  comandos) y `acceptance:ios-shortcuts` PASS (`PauseAppIntent`) en F5; build con la extensión en F7.
- Recorridos con Maestro en el AVD `Still_QA_API_36` (es-419 y en-US) y en el simulador
  "Still QA" (es-419): historia, permiso de uso (rechazo y reintento), revelación con datos que
  coinciden con `dumpsys usagestats`, Accesibilidad con vuelta automática, selector con
  sugerencias, prueba real, señal perdida, "Terminar después" → tarjeta de Hoy → `/setup`, UMP,
  y en iOS apps → guía → prueba por app (pausa real y sonda) → avisos → resumen → Hoy.

**Receta de QA** (para repetirla): en Android, resetear solo los datos de Still (kv store +
`still_restrictions.xml`) en vez de `pm clear`, que reactiva el menú del dev client, y mover su botón
flotante (tapa "Saltar"); apagar Accesibilidad antes de sembrar preferencias para `acceptance:shield`
y quitar el idioma por app (busca rótulos en inglés). En iOS, las automatizaciones no disparan en el
simulador: crear en Atajos un atajo con «Pausar app» → la app y ejecutarlo con
`shortcuts://run-shortcut?name=…`. Maestro no refresca la jerarquía tras volver de otra actividad:
partir los recorridos.

### 14.6 Capturas (`docs/onboarding-v2/`)

| Paso | iOS | Android |
|---|---|---|
| 1 Estimación | `f2-ios-01b-guess-moved` | — (igual) |
| 2 Permiso de uso | F7 (rama apilada) | `f3-and-02-usage-permission`, `f3-and-02b-settings-opened`, `f3-and-02d-denied` |
| 3 Tu tiempo real | F7 | `f3-and-03-reveal` |
| 4 Lo que suma | `f2-ios-04-life`, `f2-ios-reduce-motion-life` | `f3-and-04-life-real` |
| 5 Dónde se va + estudio | `f2-ios-05-where` | `f3-and-05-where-real` |
| 6 El gesto | `f2-ios-06-habit` | `f2-and-06-habit`, `f3-and-06-habit-real` |
| 7 La pausa | `f2-ios-07-pause-demo`, `f2-ios-07b-went-back`, `f2-ios-07c-ad` | `f2-and-07-pause-demo` |
| 8 Cómo funciona | `f2-ios-08-how` | — (igual) |
| 9 18+ | `f8-ios-09-adult` | — (igual) |
| 10 Anuncios (EEE) | — | `f6-and-10-ads-consent`, `f6-and-10b-ump-form`, `f6-and-10c-consent-answered` |
| 11 Accesibilidad / Apps | `f5-ios-11-apps`, `f5-ios-11d-news-chosen` | `f4-and-11-accessibility`, `f4-and-11d-still-page`, `f4-and-11e-allow` |
| 12 Apps / Atajos | `f5-ios-12-shortcuts`, `f5-ios-12b-shortcuts-maps` | `f4-and-12-apps`, `f4-and-12b-picker`, `f4-and-12c-apps-chosen`, `f4-and-12d-picker-suggested` |
| 13/14 Pruebas | `f5-ios-13-tests`, `f5-ios-13c-two-apps`, `f5-ios-13d-back-in-onboarding` | `f4-and-14-live-test`, `f4-and-14b-probe-shield`, `f4-and-14c-verified` |
| 14I Avisos | `f5-ios-14-notices`, `f5-ios-14b-system-prompt`, `f5-ios-14c-notices-on` | — |
| 15 Listo / Hoy | `f5-ios-15-done`, `f5-ios-16-today` | `f4-and-15-done`, `f4-and-16-today` |
| Señal perdida · Hoy · /setup | — | `f4-and-lost-signal-back`, `f6-and-18-today-card`, `f6-and-19-setup-route` |

---

## 15. Lo que solo puede hacer el usuario

**Integración**
1. Revisar y decidir el merge de `feat/onboarding-story` (incluye `feat/ios-still-action`). La
   sesión «iOS shortcut y selección de apps» espera este aviso para verificar, unir y publicar;
   publicar es decisión del usuario.
2. **No mergear `feat/onboarding-ios-screen-time`** hasta que Apple apruebe Family Controls
   (punto 5).

**iPhone (iOS 27)**
3. Build de desarrollo de `feat/onboarding-story`: recorrer el onboarding completo con
   automatizaciones reales — prueba por app (la automatización real, no un atajo de biblioteca),
   aviso «¿Continuar en Still?» si se prueba en un iPhone con iOS < 26, "Probar volver" con
   `Still - <App>` para una app sin scheme (HI4), avisos urgentes con Concentración (HI3).
4. Build de desarrollo de `feat/onboarding-ios-screen-time` con `EXPO_PUBLIC_DEV_IOS_SCREEN_TIME=1`:
   permiso de Tiempo en pantalla (código del iPhone), que el informe muestre datos (HI2) y compare
   con la estimación (HI1), apps más usadas con sus íconos.

**Apple**
5. Registrar el App ID `app.still.ios.ScreenTimeReport` (App Group + Family Controls) y pedir
   **Family Controls (Distribution)** para `app.still.ios` y `app.still.ios.ScreenTimeReport`
   (developer.apple.com/contact/request/family-controls-distribution). Cuando aprueben:
   `eas credentials` del target nuevo, mergear la rama apilada, publicar con
   `iosScreenTimeInsightsEnabled` encendido en `/admin` y la ficha/notas ya actualizadas en esa rama.
6. Avisos urgentes (HI3): resuelto el 2026-09-25 (capacidad activada a mano en el App ID y perfil
   regenerado; 0.3.0 (12)). Para cualquier capacidad nueva en el futuro: activarla primero en
   developer.apple.com y regenerar el perfil con `eas credentials` antes de `pnpm deploy:apps`.

**Xiaomi (Android 16/MIUI)**
7. Build nuevo (cambió Kotlin): HA1 (página de Acceso de uso de Still), HA5 (Still vuelve solo al
   activar Accesibilidad), HA6 (7 días de datos), el paso "Que Still siga activo" (batería leída;
   autoarranque y ventanas emergentes) y la prueba real con MIUI.

**Google Play**
8. Revisar Data safety cuando salga el build con `PACKAGE_USAGE_STATS`: el uso se procesa solo en el
   teléfono (no se declara como recopilado). La divulgación destacada es la pantalla del paso 2.

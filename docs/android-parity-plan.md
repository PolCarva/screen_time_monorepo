# Still Android · Paridad del flujo de pausa con iOS — investigación y plan

Fecha: 2026-09-21 (impl. 2026-09-22) · Rama base: `codex/ios-shortcuts-shield-flow` · Estado: **fases 1–8 completas; validado en emulador (API 34/36) y en Xiaomi real (Android 16/MIUI), con dos fallos de dispositivo hallados y corregidos** (ver §10–§11). La propuesta original de `/goal` está en §8.

Objetivo único y no negociable: **el shield y el anuncio son una sola pantalla**.
Abrir app elegida → shield de Still (dice cuántas veces se abrió hoy, ofrece
"Ver anuncio" / "Ya no quiero entrar") → tocar "Ver anuncio" → el anuncio
aparece de inmediato, en esa misma pantalla, sin salto, sin notificación, sin
carga perceptible → al terminar, en esa misma pantalla, "Quiero entrar" /
"Ya no quiero entrar".

Hoy no se cumple: `InterventionActivity` (shield Kotlin) al tocar el botón hace
`startActivity(still://intervention)` hacia `MainActivity` (React Native) y el
anuncio recién se muestra allí. Son **dos pantallas de Still**. Este trabajo
elimina ese salto.

> **Cómo se obtuvo la evidencia.** Todo lo marcado **[medido]** se cronometró en
> el emulador **Pixel 6 API 34 (Android 14)** con un prototipo desechable (ya
> revertido; la rama quedó limpia salvo `ios/…project.pbxproj`, que ya estaba
> modificado). El prototipo añadió un `RewardedAd` nativo cargado desde el
> proceso del `AccessibilityService`, un conmutador de modo de shield
> (Kotlin / RN / Kotlin+anuncio) y marcadores de log. Lo marcado **[fuente]**
> viene de documentación oficial citada en §9. Lo que **no** se pudo probar en
> el emulador (OEM reales, Restricted Settings de un APK descargado) está dicho
> como tal.

---

## 0. Decisiones firmes (no reabrir)

Heredadas del trabajo iOS y confirmadas por el usuario, más las tomadas aquí.

| # | Decisión | Origen |
|---|---|---|
| D1 | El anuncio arranca con **toque explícito**, nunca automático. Rewarded + verificación de servidor (SSV) que ya existe. | Usuario |
| D2 | Orden **anuncio → decisión**: primero el anuncio, y recién después "Quiero entrar" / "Ya no quiero entrar". | Usuario |
| D3 | Sin anuncio: **pase guardado → acceso de emergencia → pausa de 15 s** (concede 5 min, no gasta wallet, no reporta unlock). Nunca dejar al usuario atascado. | Usuario |
| D4 | Un anuncio completado **nunca se pierde**: si tras verlo no entra, la recompensa queda como pase guardado. | Usuario |
| D5 | Cancelar registra una **apertura evitada**; el próximo arranque abre en Hoy, no sobre la pausa vieja. | Usuario |
| D6 | Lógica nueva en **módulos puros con tests Vitest** que no importen React Native; textos con `localize(en, es)`. | Repo |
| **D7** | **Camino A2 elegido: el shield sigue siendo Kotlin y el anuncio se muestra ahí** con el SDK nativo. Se descarta A1 (shield RN). Ver §2 con latencias. | Este plan |
| **D8** | El overlay con `SYSTEM_ALERT_WINDOW` **queda descartado como vía para el anuncio**: un rewarded exige una Activity en primer plano. El shield es una Activity, no un overlay. | Este plan / [fuente] |
| **D9** | ~~**Tutorial de setup con capturas reales del sistema**~~ — **reemplazada** por la D7 de [`ui-clarity-plan.md`](ui-clarity-plan.md) (2026-09-22): las pantallas de Accesibilidad se dibujan en código, en el idioma del teléfono, y los PNG se borraron. Texto original: tutorial (Accesibilidad de Android), con el patrón de iOS: recortar la captura real, guardar las coordenadas del anillo en un manifiesto generado y dibujar el anillo desde la app, nunca quemarlo en el JPEG. Se retira la UI de sistema **falsa** que dibuja hoy `android-setup-visual.tsx`. | Usuario, 2026-09-21 |
| **D10** | **Comunicación en voz de producto.** No hablar de "Android" ni del mecanismo interno; Still es quien actúa ("Still se encarga del resto"). Centrar el texto en lo que le importa al usuario, no en nuestro proceso. Se reescribe el copy de `android-setup.tsx` y del shield. | Usuario, 2026-09-21 |

---

## 1. Qué permite Android hoy y qué no (con evidencia)

| Pregunta | Respuesta | Evidencia |
|---|---|---|
| ¿Detectar que se abrió una app elegida? | **Sí.** `AccessibilityService` con `TYPE_WINDOW_STATE_CHANGED`, ya construido. | Repo (`StillAccessibilityService.kt`) |
| ¿Lanzar el shield desde background al detectarla? | **Sí.** Un `AccessibilityService` habilitado lo liga el sistema con `BIND_ALLOW_BACKGROUND_ACTIVITY_STARTS`; su `startActivity` está exento del bloqueo de background. | [fuente] AOSP `AccessibilityServiceConnection.bindLocked()`; doc "background-starts". **[medido]** El shield se dibujó en el emulador sin ningún bloqueo. |
| ¿Ese lanzamiento se degrada a notificación en Android 14/15/16? | **No.** Un launch bloqueado no se convierte en notificación: se descarta en silencio y se loguea "Background activity launch blocked!". El nuestro no se bloquea. | [fuente] doc "background-starts". **[medido]** log `START … (BAL_ALLOW_PERMISSION)`, `Displayed …InterventionActivity`. |
| ¿Mostrar el anuncio en esa misma Activity, sin salto? | **Sí.** `RewardedAd.show(activity, …)` desde `InterventionActivity`. | **[medido]** ver §2 y §3. |
| ¿Mostrar el anuncio en un overlay `SYSTEM_ALERT_WINDOW`? | **No.** Un rewarded exige Activity en primer plano (`ERROR_CODE_APP_NOT_FOREGROUND`). Por eso el shield es Activity. | [fuente] `FullScreenContentCallback`. |
| ¿Listar las apps instaladas para elegirlas? | **Sí**, con `<queries> LAUNCHER` (ya usado), sin `QUERY_ALL_PACKAGES`. | Repo (`AppPickerActivity.kt`, manifest) |
| ¿Volver a la app exacta tras la decisión? | **Sí.** `getLaunchIntentForPackage` + ventana de acceso atada al boot count (ya construido). | Repo (`StillRestrictionModule.startUnlock`). Gate `acceptance:shield`. |
| ¿Salir al inicio al cancelar? | **Sí.** `Intent.ACTION_MAIN + CATEGORY_HOME` (ya construido). | Repo |
| ¿Habilitar el servicio en un build fuera de Play (Android 13+)? | **Depende del origen de instalación.** Un APK descargado (navegador / EAS) queda bajo "Restricted Settings"; por adb no. | §5 y [fuente]. **[medido]** en el emulador el origen fue `packageSource=1` (OTHER) → **no** restringido; solo apareció el diálogo normal "Allow full control". |

**Lo que Android tiene y iOS no necesita:** la lista real de apps instaladas
(iOS jamás la entrega). Android sí puede mostrarlas con etiqueta e icono.

**Lo que falta respecto a iOS** (a construir): orden anuncio→decisión, pase que
sobrevive, pausa de 15 s, estado real por app, guía con capturas reales,
pantalla de reparación, y salida limpia al inicio. Detalle en §4.

---

## 2. Decisión A1 vs A2, con latencias medidas

El criterio de aceptación es "abrir app → shield → anuncio visible" sin carga
perceptible. Se prototiparon **los dos** caminos y se cronometraron.

### A1 — El shield pasa a ser React Native (descartado)

El `AccessibilityService` lanza `MainActivity` con el deep link y se elimina
`InterventionActivity`. Reutilizaría todo el pipeline RN sin duplicar nada.

**[medido]** Evento de accesibilidad → contenido del shield RN visible:

| Estado del proceso | `MainActivity` (splash) | Shield RN montado (JS) | Notas |
|---|---|---|---|
| RN vivo (caliente) | 217–356 ms | **467–662 ms** tras el evento | Se ve un destello del splash (chalk) antes del shield |
| Proceso recién recreado por el sistema | — | montó en 1 de 3 corridas dentro de la ventana; **inestable** | El servicio revive, pero RN arranca de cero al recibir el deep link |

Problemas de A1:
- **Arranque en frío de RN.** Cuando el OEM mata el proceso (lo normal tras un
  rato), abrir la app elegida obliga a cargar el bundle JS antes de dibujar el
  shield. En el emulador ya se ven ~470–660 ms **con el proceso vivo**; en un
  gama baja con el proceso desalojado es peor y **poco fiable** (2 de 3 corridas
  no dibujaron el shield a tiempo).
- **Splash perceptible.** Una Activity lanzada desde un servicio recibe el
  splash de color sólido de Android; **[medido]** se observó el destello chalk
  entre la app y el shield. Eso es "carga perceptible", que D-objetivo prohíbe.
- El anuncio saldría bien (mismo pipeline RN que iOS), pero el **shield** no
  cumple el requisito de instantaneidad.

### A2 — El shield sigue siendo Kotlin y el anuncio se muestra ahí (elegido, D7)

`InterventionActivity` carga y muestra el rewarded con el SDK nativo, ya
presente en el APK vía `react-native-google-mobile-ads` (`play-services-ads
24.6.0`).

**[medido]** Evento de accesibilidad → shield Kotlin dibujado:

| App / estado | Evento → shield visible | Nota |
|---|---|---|
| Reloj, proceso caliente | **72–192 ms** | |
| Reloj, servicio recién recreado | **205–210 ms** | proceso fresco, sin RN |
| YouTube, proceso caliente | 72–874 ms | |
| YouTube arrancando en frío a la vez | 863–1233 ms tras el evento, pero **234–303 ms tras hacerse visible la app** | la Activity propia de YouTube domina el tiempo, no el shield |

El shield Kotlin es una Activity nativa sin bundle JS, así que se dibuja en
**decenas a ~200 ms** aunque el proceso acabe de revivir. Cumple el requisito.

### Cómo se garantiza que el anuncio salga "de 1"

El anuncio debe estar **precargado antes** del toque. Hipótesis del brief
(mantener un `RewardedAd` cargado en memoria del proceso del servicio):
**confirmada [medido]**.

- El `AccessibilityService` inicializó el SDK (**750 ms**) y cargó un rewarded
  (**2008 ms**) una sola vez, en segundo plano, sin Activity.
- Al tocar "Ver anuncio", `show()` mostró el anuncio a los **158 ms**;
  `AdActivity` visible a **+220 ms**. Sin carga perceptible.
- La recompensa se concedió durante la reproducción; el `AdActivity` corrió
  **dentro del proceso `com.still.screentime`**.
- El objeto `RewardedAd` cargado **sobrevivió vivo >30 min** en el proceso del
  servicio (heartbeat hasta age=1900 s).

Matices que el plan debe respetar:
- El SDK **caduca los rewarded a ~1 h** [fuente]. El heartbeat solo prueba que
  la referencia no es nula; hay que **recargar antes de la hora** y tras cada
  uso (el prototipo recargó solo tras `onAdDismissed`).
- Si el proceso muere, el anuncio precargado se pierde y hay que recargar al
  revivir el servicio (init 750 ms + carga ~2 s **[medido]**). Por eso, si al
  tocar no hay anuncio listo, se aplica el timeout y el fallback de iOS
  (`REWARD_AD_LOAD_TIMEOUT_MS = 12_000` → pase → emergencia → pausa 15 s).
- **Precarga solo cuando corresponde:** al conectarse el servicio y tras cada
  uso, respetando el kill switch, el `rewardProvider` y los topes de wallet, sin
  malgastar impresiones.

**El reto de negocio de A2 (autenticación) y su solución.** La lógica de crear
el reward intent firmado (SSV `customData`/`userId`) y hacer el claim vive en JS
con el token de Supabase en `expo-secure-store`. No se duplica la autenticación:

1. Mientras Still está abierta, RN **pre-firma** intents contra
   `POST /api/v1/rewards/intents` y deja unos pocos en `SharedPreferences`
   (id, `customData`, `userId`, `expiresAt`).
2. El shield Kotlin **consume uno**, lo pasa a
   `setServerSideVerificationOptions` antes de `show()`, y al ganar **encola el
   resultado** (clientEventId + intentId) en un outbox nativo.
3. RN, al volver al frente, **hace el claim** (`/rewards/intents/{id}/claim`) y
   reporta el unlock, reactivando el outbox `getPendingUnlockEvents` /
   `acknowledgeUnlockEvent` que hoy en Android son **stubs vacíos** (en iOS ya es
   un outbox real).

Caducidad de los intents: **15 min** desde su creación
(`202608310002_bound_active_reward_intents.sql`: `expiresAt = now + 15m`; máximo
**3 intents activos** por usuario; el claim rechaza `reward_intent_expired`).
Consecuencia para el diseño: los intents pre-firmados **no aguantan** un rato
largo con la app cerrada. Regla: **refrescar el buffer cada vez que Still pasa a
primer plano** y descartar los caducados; si al tocar "Ver anuncio" no hay
intent vigente, el anuncio igual se muestra con SSV de respaldo mínimo y el
claim se resuelve luego, o se cae al pase/emergencia/pausa. El buffer de 3 cubre
"dos apps bloqueadas seguidas" sin ir a red en medio del shield.

---

## 3. Flujo técnico de A2, paso a paso

1. `StillAccessibilityService` detecta la app elegida (ya lo hace) y lanza
   `InterventionActivity` con el paquete y el conteo del día.
2. El servicio mantiene un `RewardedAd` precargado en el proceso (init temprano,
   recarga tras uso y antes de la hora).
3. `InterventionActivity` muestra el shield: "‹App› se abrió N veces hoy" +
   **"Ver anuncio"** / **"Ya no quiero entrar"**.
4. "Ver anuncio" → si hay anuncio listo, `show()` **en esa Activity** (158 ms
   **[medido]**). Si no: muestra un estado breve mientras carga (≤12 s) y cae a
   pase → emergencia → pausa 15 s.
5. Anuncio completo → claim encolado → en la **misma Activity** aparecen
   **"Quiero entrar"** / **"Ya no quiero entrar"** (orden anuncio→decisión, D2).
6. "Quiero entrar" → `startUnlock` (ventana atada al boot count) + relanzar el
   paquete exacto (ya construido, gate `acceptance:shield`).
7. "Ya no quiero entrar" → apertura evitada; si ya vio el anuncio, la recompensa
   queda como pase (D4); Home.
8. La máquina de estados `intervention-flow.ts` (pura, 23 tests) gobierna
   fases/gate/notice; el shield Kotlin la **replica** (no puede importar RN),
   por eso conviene extraer las transiciones a un módulo puro compartible por
   contrato/tests y traducirlas a Kotlin, o exponerlas por el puente. Ver §4.

---

## 4. Arquitectura propuesta

### Qué se reutiliza de iOS (sin duplicar)
- `src/lib/intervention-flow.ts` — máquina de estados pura (fases anuncio →
  claiming → decision → entering/leaving, pausa 15 s, "el anuncio no se pierde").
  Es la fuente de verdad del **orden** y de las **reglas**. El shield Kotlin
  debe comportarse igual; se añaden tests que fijen esa equivalencia.
- Pipeline de reward: `POST /rewards/intents` (firma + SSV), `claim`, wallet,
  `token_ledger`, SSV con AdMob. **Sin cambios de servidor.**
- Outbox de unlocks (`getPendingUnlockEvents`/`acknowledgeUnlockEvent`) — ya
  existe en JS (`app-state.tsx` lo drena en `refresh`); en Android hay que
  **implementar el lado nativo** (hoy stubs).
- `reward-provider.ts` (timeout 12 s, fallback) como espejo de la política en
  el lado nativo.

### Qué se crea (Kotlin)
- **`StillRewardedAdManager.kt`** (objeto de proceso): init del SDK, precarga,
  supervivencia, recarga antes de la hora y tras uso; `show(activity)` con SSV;
  reporta earned/dismissed/failed. Respeta kill switch y topes.
- Buffer de **intents pre-firmados** en `SharedPreferences` + **outbox de
  resultados de anuncio** que RN drena (reactivar los stubs
  `getPendingUnlockEvents`/`acknowledgeUnlockEvent`).
- `InterventionActivity` ampliada: botón "Ver anuncio" → `show()`; estado de
  carga; pantalla de decisión post-anuncio; pausa de 15 s cuando no hay nada.
- **Estado real por app** expuesto a RN (última pausa, apps conectadas) para
  Ajustes y la pantalla de apps.
- **Selección de apps a RN** (D-abierta H, §6.8): método nativo que liste
  apps instaladas (etiqueta + icono) para unificar con `app/ios-apps.tsx`, o
  mantener `AppPickerActivity`. Recomendación en §6.

### Qué se toca (JS/infra)
- `restriction-engine.ts`: tipos para intents pre-firmados, outbox de anuncios,
  estado por app; RN pre-firma intents y hace el claim al volver al frente.
- `app/intervention.tsx`: en Android ya no hay rama que navegue a otra pantalla
  para el anuncio; el shield nativo es autosuficiente. La rama RN Android
  (`PlatformIntervention`) se retira o queda solo como fallback in-app.
- **Comunicación (D10):** reescribir `app/android-setup.tsx` y los textos del
  shield a voz de producto. Ver §5.
- **Guía real (D9):** nuevo pipeline de capturas (ver §5); retirar la UI falsa
  de `android-setup-visual.tsx`.

### Archivos (mapa)
```
Crear:
  android/.../StillRewardedAdManager.kt
  android/.../InterventionAdFlow.kt          (decisión/pausa en Kotlin, espejo de intervention-flow)
  scripts/android-guide/build.mjs + spec.json (recorte + manifiesto de anillos)
  src/components/android-guide-image.tsx      (dibuja el anillo, como shortcut-guide-image)
  src/components/android-guide-assets.ts      (generado)
  src/lib/android-intervention.ts + .test.ts  (lógica pura nueva, Vitest)
Tocar:
  android/.../StillAccessibilityService.kt    (precarga al conectar; ya lanza el shield)
  android/.../InterventionActivity.kt         (anuncio + decisión + pausa en la misma pantalla)
  android/.../StillRestrictionModule.kt       (intents pre-firmados; outbox real; estado por app)
  src/native/restriction-engine.ts
  app/intervention.tsx                        (retirar salto Android)
  app/android-setup.tsx                       (voz de producto + guía real)
  app/ios-apps.tsx / pantalla de apps         (estado por app; unificación opcional)
Retirar:
  src/components/android-setup-visual.tsx      (UI de sistema falsa) → reemplazo por capturas reales
```

---

## 5. Flujo de usuario y onboarding (voz de producto, capturas reales)

### Onboarding — dos pasos, sin jerga (D10)
El copy actual explica el mecanismo ("ANDROID / SETUP", "Two steps once. Then
Android does the rest.", "Android returns for you", "The main button opens the
right Android screen, waits for you to return…"). Se reemplaza por texto que
lidera con el beneficio y hace a **Still** el sujeto. Ejemplos de dirección
(en/es), a pulir en diseño:

| Antes (proceso/Android) | Después (producto) |
|---|---|
| "ANDROID / SETUP" | "Empieza con Still" / "Empezá con Still" |
| "Two steps once. Then Android does the rest." | "Un momento de setup y Still se encarga del resto." |
| "Enable Still once" | "Dale permiso a Still" |
| "Android returns for you" | "Vuelves a tu app cuando lo decides" |
| "The main button opens the right Android screen, waits for you to return…" | "Toca una vez y Still te guía." |

Regla de estilo para D10: nada de "Android", "Accessibility settings",
"servicio", "startActivity"; el usuario lee qué gana (menos aperturas
automáticas, tiempo recuperado) y que **Still lo hace por él**. El único punto
donde el sistema se nombra es el permiso, porque el usuario lo verá en pantalla;
ahí se usa una **captura real** con el control exacto rodeado (abajo), no una
explicación.

### Guía de permiso con capturas reales (D9)

> **Reemplazada** (2026-09-22): la guía ya no usa capturas. Las tres pantallas
> se dibujan en código (`src/components/guide/android-settings-screens.tsx`),
> ver D7 y §4.4 de [`ui-clarity-plan.md`](ui-clarity-plan.md). Lo que sigue
> queda como registro.

Se replica el patrón de iOS (`scripts/shortcut-guide/build.swift` + `spec.json`
+ `src/components/shortcut-guide-image.tsx`), adaptado a Android:

1. Se capturan las pantallas reales con `adb exec-out screencap -p` (validado en
   esta investigación).
2. Un script (`scripts/android-guide/build.mjs`) recorta las capturas y escribe
   un manifiesto con las coordenadas del anillo como fracción de la imagen.
3. `android-guide-image.tsx` **dibuja el anillo** sobre la captura; nunca se
   quema en el JPEG. Cada imagen puede abrir la pantalla del sistema
   correspondiente (`Settings.ACTION_ACCESSIBILITY_SETTINGS`).

Pantallas reales a capturar (ya verificadas en el emulador API 34):
- **Accesibilidad → Apps descargadas → Still**, con "Still / Off" rodeado.
- El diálogo **"Allow Still to have full control of your device?"** con
  **Allow** rodeado (es el paso que el usuario debe confirmar).
- Para builds fuera de Play: la ruta **App info → ⋮ → Allow restricted
  settings** (§6). Solo se muestra si se detecta ese caso.

Las capturas se toman en inglés y en español (el sistema traduce las etiquetas
en la misma posición), como en iOS.

### Uso (idéntico al requisito)
Abrir app elegida → shield ("‹App› se abrió N veces hoy", "Ver anuncio" /
"Ya no quiero entrar") → "Ver anuncio" → anuncio **en la misma pantalla** →
"Quiero entrar" (abre la app, ventana configurada) / "Ya no quiero entrar"
(apertura evitada, pase guardado si ya vio el anuncio, inicio).

---

## 6. Riesgos y edge cases

### 6.1 Google Play (el riesgo mayor) y plan B
La política de `AccessibilityService` **sigue permitiendo** usos de no-tool como
el nuestro en 2026 [fuente: `answer/10964491`], con `isAccessibilityTool=false`
(ya lo usamos). Requiere: declaración en Play Console, **prominent disclosure**
in-app + consentimiento (ya existe el diálogo en `android-setup.tsx`), **vídeo**
que muestre app→disclosure→consentimiento→función central, y **documentar la API
en la ficha**. Cláusula nueva (vigente 28-ene-2026): prohíbe la **acción
autónoma** vía accesibilidad; permite explícitamente "si ocurre X, hacer Y",
que es justo nuestro patrón determinista.

Riesgo real y específico: (a) la cláusula "usar APIs más acotadas cuando se
pueda" — hay que **justificar** por qué `UsageStatsManager` (polling) no basta
(latencia y fiabilidad), o enviar un **fallback de Usage Access** como one sec /
AppBlock; (b) mostrar **publicidad** en una app con accesibilidad recibe más
escrutinio, aunque el rewarded con opt-in explícito dentro de la Activity propia
encaja en la excepción de anuncios [fuente: `answer/9857753`, `answer/7313578`].
Precedentes vivos con accesibilidad **y anuncios**: `blockit`
(com.hypenet.focus) y YourHour (com.mindefy…) están publicados con "Contains
ads" en 2026.

**Plan B si la accesibilidad deja de ser viable** (rechazo, o Android 17
"Advanced Protection" que restringe servicios de accesibilidad a herramientas
verificadas [fuente]): migrar la **detección** a `UsageStatsManager`
(`queryEvents` / `getAppStandbyBucket`) + un **overlay** (`SYSTEM_ALERT_WINDOW`)
para el shield de "vuelve" — pero **el anuncio seguiría necesitando una
Activity**, así que el shield con anuncio sería una Activity lanzada desde ese
overlay/servicio. Es el modelo de AppBlock (usage access + overlay). Coste: la
detección por usage access es menos inmediata y el overlay también es un permiso
especial. Se documenta como contingencia, no como camino base.

Copy de disclosure ya sugerido en `store-compliance.md`; mantenerlo.

### 6.2 Restricted Settings (Android 13+)
Un APK **descargado** (navegador, EAS internal distribution, Firebase App
Distribution) queda como `PACKAGE_SOURCE_DOWNLOADED_FILE`/`LOCAL_FILE` → el
sistema bloquea habilitar la accesibilidad hasta que el usuario haga **App info
→ ⋮ → Allow restricted settings** [fuente]. **[medido]** por adb el origen es
`OTHER` → **no** se restringe; por eso el emulador no lo reproduce y **cualquier
prueba con APK/EAS sí chocará**. Android 15 amplía a overlay, device admin,
usage access, etc.

- **Detección:** no hay API directa; heurística
  `PackageManager.getInstallSourceInfo(pkg).getPackageSource()` (API 33) ∈
  {LOCAL_FILE=3, DOWNLOADED_FILE=4} ⇒ probable restricción; y si tras volver de
  Ajustes el servicio sigue apagado, mostrar el walkthrough "Allow restricted
  settings" con captura real.
- **Onboarding:** cuando se detecta, insertar ese paso extra antes del permiso.

### 6.3 Lanzar el shield desde background (14/15/16)
Permitido: el servicio ligado con `BIND_ALLOW_BACKGROUND_ACTIVITY_STARTS` está
exento; los cambios de 14/15/16/17 apuntan a PendingIntent/IntentSender, no a
este camino [fuente]. **[medido]** en API 34, sin bloqueos; el shield se dibuja
en 72–210 ms con el proceso vivo o recién revivido. **No probado** en 15/16 por
falta de imagen; el mecanismo AOSP es idéntico en esas ramas [fuente].

### 6.4 OEM (Xiaomi, Samsung, Huawei, Oppo/OnePlus/Realme, Vivo)
Matan servicios en background y piden autostart; one sec admite que en algunos
"es difícil y a veces imposible" y lista Motorola/Oppo/Asus como no compatibles
[fuente]. Impacto: si el OEM mata el proceso y **no** revive el servicio, no hay
shield hasta reabrir Still. Evidencia de que en HyperOS/MIUI el servicio de
accesibilidad puede quedar apagado tras la purga [fuente].

- **Detectable con APIs públicas:** `PowerManager.isIgnoringBatteryOptimizations`,
  `ActivityManager.isBackgroundRestricted()`,
  `getHistoricalProcessExitReasons()` (por qué murió el proceso). **No** hay API
  para leer si el autostart está concedido; solo se puede **abrir** la pantalla
  OEM (component names conocidos: Xiaomi `com.miui.securitycenter`, Oppo
  `com.coloros.safecenter`, etc.).
- **Qué decir al usuario, por OEM** (en voz de producto, no técnica): Xiaomi →
  activar inicio automático y "mostrar ventanas emergentes en segundo plano";
  Samsung → sacar Still de "apps en suspensión"; Huawei → "gestión manual" en
  inicio de apps; Oppo/OnePlus/Realme/Vivo → autostart + batería sin
  restricción. Enmarcarlo como "para que Still no se duerma", best-effort.
- **No probado aquí** (emulador Pixel, sin capa OEM): se dice explícito.

### 6.5 Otros edge cases
- **Reinicio del teléfono:** el servicio revive al habilitarse la accesibilidad;
  el anuncio precargado se pierde y se recarga (init 750 ms + ~2 s **[medido]**).
  La ventana de acceso está atada al `BOOT_COUNT` (ya construido), así que un
  unlock viejo no sobrevive al reinicio.
- **Servicio desactivado por el usuario:** `getHealth` ya reporta
  `accessibility_disabled`; el shield no aparece. Surface en Ajustes con copy de
  producto ("Still está en pausa, actívalo").
- **App elegida desinstalada:** `startUnlock` ya hace rollback si
  `getLaunchIntentForPackage` es null (`target_unavailable`). El shield igual no
  debería dispararse (no llega el evento).
- **Multiventana / split screen:** `TYPE_WINDOW_STATE_CHANGED` puede llegar por
  la app en foco; validar en dispositivo que el shield no parpadee con dos apps
  visibles. **No probado** (pendiente device).
- **Dos apps bloqueadas seguidas:** ya cubierto por `singleTop` + `recreate()`
  en `onNewIntent` y por el gate `acceptance:shield` (atribución por app
  independiente). El buffer de 3 intents pre-firmados evita ir a red entre
  ambas. **[medido]** el shield refresca etiqueta/conteo al segundo lanzamiento.
- **Anuncio sin fill:** no reproducible con test ads en emulador; se cae al
  timeout de 12 s → pase → emergencia → pausa 15 s (política iOS). **No
  probado** el no-fill real.
- **Proceso matado a mitad del flujo:** si muere tras ganar el anuncio pero
  antes del claim, el resultado quedó en el outbox nativo → RN lo drena al
  volver (idempotente por `clientEventId`). Si muere durante `show()`, no hay
  recompensa (correcto). Diseñar el outbox nativo con esa idempotencia.

---

## 7. Orden de implementación por fases

Cada fase = un commit, con criterio de terminado verificable. Gates que deben
seguir pasando en cada fase: **`pnpm check`** y **`pnpm --filter mobile
acceptance:shield`** (device con build debuggable).

- **Fase A1 · Anuncio nativo en el shield.** `StillRewardedAdManager` +
  precarga desde el servicio + `show()` en `InterventionActivity`.
  *Terminado:* en emulador, tocar "Ver anuncio" muestra el rewarded ≤300 ms
  (**[medido]** 158 ms de referencia) sin salir de la Activity; log confirma
  `AdActivity` en el proceso de Still.
- **Fase A2 · Intents pre-firmados + outbox nativo.** RN pre-firma y deja en
  `SharedPreferences`; el shield consume + encola; RN hace el claim al frente
  (reactivar `getPendingUnlockEvents`/`acknowledgeUnlockEvent`).
  *Terminado:* claim y unlock reportados tras un anuncio real; test de
  idempotencia del outbox; refresco de buffer al foreground.
- **Fase A3 · Orden anuncio→decisión, pausa 15 s, pase que sobrevive.** Portar
  las reglas de `intervention-flow.ts` a Kotlin (`InterventionAdFlow`) con tests
  puros. *Terminado:* las cuatro rutas (anuncio, pase, emergencia, pausa) y "el
  anuncio no se pierde" pasan tests; el salto RN de Android se retira de
  `intervention.tsx`.
- **Fase A4 · Estado por app + unificación de la pantalla de apps.**
  *Terminado:* Ajustes y la pantalla de apps muestran última pausa y apps
  conectadas con datos nativos.
- **Fase A5 · Guía con capturas reales + voz de producto (D9, D10).** Pipeline
  `android-guide/build.mjs`, componente que dibuja el anillo, copy reescrito,
  retiro de `android-setup-visual.tsx`. *Terminado:* onboarding sin UI falsa,
  sin jerga de "Android/proceso", con capturas reales rodeadas.
- **Fase A6 · Restricted Settings + reparación + OEM.** Detección y walkthrough;
  pantalla de reparación con causas en orden y enlaces a la pantalla del
  sistema; textos OEM. *Terminado:* con un APK descargado real, el onboarding
  detecta y guía el "Allow restricted settings".
- **Fase A7 · Validación en dispositivo.** Cronometrar "abrir app → shield →
  anuncio visible" en frío y caliente en un teléfono real; probar un OEM si hay;
  correr `acceptance:shield`. *Terminado:* criterio de aceptación cumplido en
  device; checklist firmada.

---

## 8. Propuesta de `/goal`

> **Goal: llevar a Android el flujo de pausa de iOS en una sola pantalla, con el
> anuncio dentro del shield Kotlin (camino A2 ya validado por prototipo).**
>
> No re-investigar: A2 está decidido (D7); el overlay para el anuncio está
> descartado (D8); Play sigue permitiendo la accesibilidad no-tool con
> declaración/disclosure/vídeo; el shield desde background está exento y se
> dibuja en 72–210 ms; un rewarded precargado en el proceso del servicio se
> muestra a 158 ms del toque y sobrevive >30 min. Todo medido en Pixel 6 API 34
> (ver `docs/android-parity-plan.md`).
>
> Construir, en fases, un commit por fase, con `pnpm check` y
> `pnpm --filter mobile acceptance:shield` en verde:
>
> 1. **Anuncio nativo en el shield.** `StillRewardedAdManager` (init temprano
>    desde `StillAccessibilityService`, precarga, supervivencia, recarga antes de
>    la hora y tras uso, respetando kill switch y topes de wallet) + `show()` en
>    `InterventionActivity`. El anuncio nunca arranca solo (D1).
> 2. **Auth sin duplicar.** RN pre-firma reward intents (`POST /rewards/intents`,
>    caducan a 15 min, máx 3) y los deja en `SharedPreferences`; el shield
>    consume uno, adjunta SSV `customData`/`userId`, `show()`, y encola el
>    resultado en un outbox nativo; RN hace el claim y reporta el unlock al
>    volver al frente, reactivando `getPendingUnlockEvents`/
>    `acknowledgeUnlockEvent` (hoy stubs). Refrescar el buffer en cada
>    foreground. Idempotente por `clientEventId`.
> 3. **Orden anuncio→decisión + fallbacks.** En la misma Activity: anuncio →
>    "Quiero entrar" / "Ya no quiero entrar" (D2). Sin anuncio: pase → emergencia
>    → pausa de 15 s (5 min, sin wallet, sin reporte) (D3). El anuncio completado
>    se guarda como pase si no entra (D4). Portar las reglas de
>    `intervention-flow.ts` a un módulo Kotlin espejo con tests puros; retirar el
>    salto RN de Android en `app/intervention.tsx`.
> 4. **Estado real por app** (última pausa, apps conectadas) en Ajustes y en la
>    pantalla de apps; evaluar unificar con `app/ios-apps.tsx` exponiendo las
>    apps instaladas (etiqueta + icono) por un método nativo.
> 5. **Guía con capturas reales (D9)** replicando el patrón de iOS
>    (`scripts/android-guide/build.mjs` + `spec.json` + `android-guide-image.tsx`
>    que dibuja el anillo, nunca quemado): capturas reales de Accesibilidad y del
>    diálogo "Allow full control". Retirar `android-setup-visual.tsx` (UI falsa).
> 6. **Comunicación en voz de producto (D10):** reescribir `app/android-setup.tsx`
>    y los textos del shield para que Still sea el sujeto ("Still se encarga del
>    resto"), sin nombrar "Android" ni el mecanismo, centrados en el beneficio.
> 7. **Restricted Settings + reparación + OEM:** detección por
>    `getInstallSourceInfo().getPackageSource()` y walkthrough con captura real;
>    pantalla de reparación con causas en orden y enlaces al sistema; textos por
>    OEM (autostart, batería, ventanas emergentes) en voz de producto.
> 8. **Validación en dispositivo:** cronometrar "abrir app → shield → anuncio
>    visible" en frío/caliente en un teléfono real; probar un OEM si hay; correr
>    `acceptance:shield`.
>
> Reglas: lógica nueva en módulos puros con tests Vitest sin React Native;
> textos con `localize(en, es)` (D6). Sin `push` ni PR salvo que se pida.

---

## 9. Fuentes

- Play — [Uso de AccessibilityService](https://support.google.com/googleplay/android-developer/answer/10964491) · [Permisos y APIs sensibles](https://support.google.com/googleplay/android-developer/answer/16558241) · [Política de anuncios](https://support.google.com/googleplay/android-developer/answer/9857753) · [Rewarded](https://support.google.com/admob/answer/7313578) · [Advanced Protection A17](https://support.google.com/android/answer/16339980)
- Android — [Background activity starts](https://developer.android.com/guide/components/activities/background-starts) · behavior-changes [14](https://developer.android.com/about/versions/14/behavior-changes-14) / [15](https://developer.android.com/about/versions/15/behavior-changes-15) / [16](https://developer.android.com/about/versions/16/behavior-changes-16) · [Splash screens](https://developer.android.com/develop/ui/views/launch/splash-screen) · [InstallSourceInfo](https://developer.android.com/reference/android/content/pm/InstallSourceInfo) · [Restricted settings (usuario)](https://support.google.com/android/answer/12623953) · CDD 15 §9.8
- GMA — [Rewarded (Android)](https://developers.google.com/admob/android/rewarded) · [SSV](https://developers.google.com/admob/android/ssv) · [Preloading](https://developers.google.com/admob/android/ad-preloading) · [FullScreenContentCallback](https://developers.google.com/admob/android/reference/com/google/android/gms/ads/FullScreenContentCallback)
- one sec / OEM — [Setup Android](https://tutorials.one-sec.app/android-accessibility-permission) · [Ajustes de fondo](https://tutorials.one-sec.app/additional-android-background-settings) · [Compatibilidad](https://tutorials.one-sec.app/android-device-compatibility-list) · [dontkillmyapp.com](https://dontkillmyapp.com/)
- Repo — `apps/mobile/src/lib/intervention-flow.ts` · `supabase/migrations/202608310002_bound_active_reward_intents.sql` · `apps/web/app/api/v1/rewards/intents/route.ts` · `docs/store-compliance.md` · `docs/ios-shortcuts.md`

---

## 10. Estado de implementación (2026-09-22)

Implementado en esta rama, un commit por fase, con `pnpm check` (150 tests) y
`pnpm --filter mobile acceptance:shield` en verde en el emulador Pixel 6 API 34.
El único cambio previo no relacionado es `ios/…project.pbxproj`.

| Fase | Estado | Verificación |
|---|---|---|
| 1 · Anuncio nativo en el shield | ✅ | `StillRewardedAdManager` precarga desde el servicio y `InterventionActivity` muestra el rewarded; anuncio a **+134 ms** del toque, `AdActivity` dentro de `com.still.screentime`. |
| 2 · Auth sin duplicar | ✅ | RN pre-firma intents en `SharedPreferences`; el shield consume uno con SSV y encola el resultado; RN reclama y reporta al foreground. Round-trip nativo verificado (intent consumido, ambos outbox poblados, neto cero). |
| 3 · Orden anuncio→decisión + fallbacks | ✅ | Decisión en la misma Activity; pausa de 15 s → ventana de 5 min sin reporte; salto a RN retirado. Pausa verificada por captura. |
| 4 · Estado por app | ✅ | `app_last_pause_at` por paquete + `getSelectedAppsState`; mostrado en Ajustes. `AppPickerActivity` nativo se mantiene. |
| 5 · Guía con capturas reales (D9) | ✅ | Pipeline `android-guide/build.mjs` + capturas reales de Accesibilidad; anillo dibujado por la app; UI falsa retirada. Anillo verificado sobre cada control. |
| 6 · Voz de producto (D10) | ✅ | Copy de onboarding reescrito; Still es el sujeto; sin "Android" salvo la divulgación legal. |
| 7 · Restricted Settings + reparación + OEM | ✅ | `getInstallEnvironment` (heurística de install source), `openAppInfo`/`openAccessibilitySettings`, `android-oem.ts` (con tests) y `app/android-repair.tsx` con causas en orden. |
| 8 · Validación en dispositivo | ✅ (incl. OEM real) | Validado en emulador API 34 / API 36 y en el **Xiaomi real (Android 16 / MIUI)**: "abrir app → shield" +65 ms, anuncio a pantalla completa dentro de `com.still.screentime`, `acceptance:shield` verde, exención BAL confirmada. En el Xiaomi se hallaron y corrigieron dos fallos reales (ver §11) y se documentaron los bloqueos de adb de MIUI (no deja `settings put`/`input`) y que el force-stop revoca la accesibilidad. |

### Medido en el emulador (build de esta rama, no el prototipo)

| Métrica | Android 14 (API 34) | Android 16 (API 36) |
|---|---|---|
| Abrir app → shield dibujado | +225 ms | +438 ms |
| Tocar "Ver anuncio" → anuncio visible | +134 ms | +247 ms |
| Proceso del anuncio | `com.still.screentime` | `com.still.screentime` |
| `acceptance:shield` | verde | verde |
| Lanzar shield desde background | sin bloqueo | sin bloqueo (BAL exento) |

El rewarded precargado sobrevive >30 min en el proceso del servicio (medido en
API 34). API 36 usa una imagen con Play Store, lo más cercano al Xiaomi sin el
hardware; falta solo el comportamiento OEM de MIUI, que sí necesita el teléfono.

### Runbook: cerrar la fase 8 en el teléfono (turnkey)

Cuando el Xiaomi (u otro Android) esté conectado por USB con la depuración
autorizada, la corrida física completa es un solo comando (build de debug ya
compilado con `pnpm --filter mobile android`):

```sh
pnpm --filter mobile acceptance:shield:device <serial>   # serial de `adb devices`
```

`scripts/verify-shield-device.sh` instala el build, activa la accesibilidad
(mejor esfuerzo; en MIUI puede requerir activarla a mano tras permitir los
ajustes restringidos), siembra Gmail+YouTube y un intent pre-firmado, corre
`acceptance:shield` y cronometra "abrir app → shield" en frío y en caliente y
"tocar Ver anuncio → anuncio visible". Deja la app instalada para inspección
manual y recuerda los pasos por OEM (§6.4). Es lo único que falta de la fase 8;
en esta sesión el teléfono no estuvo conectado el tiempo suficiente para correrlo.

### Notas de gate

`acceptance:shield` respeta ahora `ANDROID_SERIAL` para elegir dispositivo cuando
hay más de uno conectado. En el emulador, la app por defecto Gmail dispara dos
eventos de ventana al abrir su `WelcomeTourActivity` y el conteo marca 2 en vez
de 1; es un artefacto del emulador (no del conteo, que es correcto con apps de una
sola Activity y en dispositivo real). El gate se corre en el emulador con
`Clock=Reloj` + `YouTube`, y con su default Gmail+YouTube en el teléfono físico.

---

## 11. Hallazgos y arreglos en el Xiaomi real (2026-09-22)

Probando en el teléfono del usuario (Xiaomi 2407FPN8EG, Android 16 / MIUI)
aparecieron cosas que ni el emulador ni la investigación mostraban. Todo
corregido y re-verificado en el dispositivo.

- **Bypass por Picture-in-Picture.** YouTube (y cualquier app con PiP) dejaba una
  ventana flotante de video **por encima** del shield; el usuario podía verla o
  expandirla y saltarse la pausa. Android dibuja las ventanas PiP sobre las
  Activities normales, así que el shield (una Activity) no puede taparla. **Arreglo
  (decisión del usuario):** el `AccessibilityService` detecta la ventana PiP de una
  app bloqueada (`getWindows()` + `isInPictureInPictureMode`) y la cierra
  (`ACTION_DISMISS`, con click en el botón de cerrar como respaldo). Requirió
  `canRetrieveWindowContent="true"` + `flagRetrieveInteractiveWindows`; se usa solo
  para localizar y cerrar la PiP, nunca para leer/guardar contenido, y se
  actualizó la divulgación de privacidad en consecuencia.
- **Reapertura en caliente no mostraba el shield.** Al reabrir una app ya cargada,
  MIUI no traía al frente la instancia del shield que había quedado en background
  (a diferencia de crear una nueva). **Arreglo:** la detección pasa a resolver la
  app en primer plano con `getWindows()` (más robusta que el paquete del evento,
  ahora que se leen ventanas) y añade `typeWindowsChanged`; además el shield **se
  cierra solo al pasar a segundo plano sin resolver** (salvo mientras muestra el
  anuncio), de modo que cada apertura crea una instancia fresca que sí sube al
  frente.
- **Bloqueos de adb en MIUI.** MIUI rechaza `adb shell settings put secure`
  (WRITE_SECURE_SETTINGS) y `adb shell input` (INJECT_EVENTS) sin la opción
  "Depuración USB (ajustes de seguridad)". Por eso la accesibilidad se activa a
  mano y `acceptance:shield` (que inyecta toques) no corre por adb en MIUI; el
  shield en sí y su latencia sí se verificaron.
- **force-stop revoca la accesibilidad.** En MIUI, matar la app (force-stop, o la
  gestión agresiva de background) deja `enabled_accessibility_services` en `null`;
  el servicio no se recupera solo hasta reactivarlo. Refuerza la necesidad de la
  pantalla de reparación y de los textos por OEM (§7).

Medido en el Xiaomi: abrir app → shield **+65 ms**; el rewarded precargado se
muestra dentro de `com.still.screentime`; la PiP se cierra sola; la reapertura en
caliente vuelve a mostrar el shield.

---

## 12. Ventana de acceso elegida y expiración en vivo (2026-09-22)

Rama: `feat/access-duration-slider-and-live-expiry`.

### 12.1 Qué cambió

1. **El tiempo ya no se define antes.** Desapareció el selector de "Tiempo que
   desbloquea cada pase" de Ajustes. La ventana se elige **después** de pagarla
   —anuncio, pase guardado o acceso de emergencia— con un slider de **1 min** a
   **Resto del día**.
   - Paradas: `ACCESS_DURATION_STEPS` en `packages/contracts/src/domain.ts`
     (fuente de verdad, con tests) y su espejo en `AccessDuration.kt`.
   - "Resto del día" se resuelve a los segundos que faltan hasta la medianoche
     local **en el momento de conceder el acceso**, no 24 h fijas.
   - La pausa gratuita de 15 s sigue dando 5 min fijos y **no** pasa por el
     slider: si se pudiera elegir, saltarse el anuncio sería mejor negocio (D3).
   - La última ventana elegida se guarda en `last_access_duration_seconds` y
     sólo sirve para posicionar el slider la próxima vez.

2. **La ventana termina cuando dice, aunque el usuario nunca salga de la app.**
   `StillAccessibilityService` arma un temporizador por app con ventana viva
   (`armAccessWindows`), programado sobre `elapsedRealtime` y validado contra
   el `BOOT_COUNT` con el que se guardó. Al vencer:
   1. borra `unlocked:<pkg>` / `unlocked_boot:<pkg>`;
   2. si esa app sigue en primer plano, lanza el shield ahí mismo;
   3. 450 ms después verifica: si el OEM rechazó el arranque de actividad en
      background, usa `performGlobalAction(GLOBAL_ACTION_HOME)` —API de
      accesibilidad, no necesita arrancar una actividad— y reintenta el shield.

   Se rearma en `onServiceConnected` (cualquier ventana ya vencida se cierra en
   el acto) y cuando un evento encuentra una app desbloqueada sin temporizador,
   así que matar el proceso no regala tiempo. Todas las rutas que conceden
   acceso avisan con `StillAccessibilityService.watchAccessWindows()`: el
   shield (`InterventionActivity`) y `startUnlock` de React Native.

3. **`getAccessWindows`** (nuevo, ambas plataformas) expone las ventanas vivas.
   "Hoy" muestra *Abierto ahora · vuelve la pausa mm:ss* leyendo el deadline
   nativo, no un contador de JavaScript.

### 12.2 Medido en el emulador (Pixel 6, API 34)

| Paso | Resultado |
|---|---|
| Abrir Clock → shield | "Clock opened once today." + "Tú decides cuánto dura el acceso en el siguiente paso." |
| Usar 1 pase → slider | "How long do you want in Clock?", valor 10 min, extremos 1 min / Rest of day |
| Arrastrar a la izquierda | valor 1 min, botón "I want to go in · 1 min" |
| Arrastrar a la derecha | 12 hours → Rest of day |
| Entrar con 1 min | Clock en primer plano, `unlocked:…` escrito, `last_access_duration_seconds=60` |
| **Esperar sin tocar nada** | **el shield vuelve solo**, con Clock en primer plano todo el rato |
| Precisión del deadline | deadline `187047ms`, shield reanudado `187170ms` → **123 ms** de desvío (es la latencia de `adb`, el temporizador es exacto) |
| El escudo se queda | tras volver sigue en primer plano minutos después (`ResumedActivity: .InterventionActivity`), con "Volver" / "Usar 1 pase · Abrir Clock" |
| "Resto del día" | elegido a las 15:33:55 → deadline `31927993ms` con `elapsedRealtime≈1562993ms`, es decir **30 365 s = 8 h 26 min 05 s**, exactamente lo que faltaba para medianoche local (no 24 h). `last_access_duration_seconds=86400` guarda la *parada* del slider, no la ventana concedida |

### 12.3 Pendiente de teléfono real

El arranque de actividad desde el servicio ya estaba validado en Xiaomi
(§10–11); la ruta nueva es la misma llamada desde un temporizador, con el
fallback `GLOBAL_ACTION_HOME` detrás. Conviene repetir el paso "esperar sin
tocar nada" en el Xiaomi antes de publicar.

---

## 13. Cerrar Still desde Recientes apaga la pausa (Xiaomi, 2026-09-25)

Reporte en el Xiaomi (Android 16 / MIUI): cada vez que Still se cierra por
completo (su tarjeta deslizada fuera de Recientes) la pausa deja de aparecer;
en segundo plano funciona. Still decía «Activado, pero no arrancó» y los
ajustes del teléfono, «No se otorgó ningún permiso».

### 13.1 Causa

- MIUI mata el proceso de Still y no deja que Android lo vuelva a levantar
  (lo decide su «Inicio automático»). El servicio cae con sus conexiones: los
  `ConnectionRecord` del sistema quedan `DEAD`.
- `AccessibilityManagerService` (rama `android16-release`) pasa el servicio a
  `mCrashedServices` en `binderDied()`, y `updateServicesLocked()` salta los
  servicios caídos. Solo salen de ahí si el servicio se vuelve a conectar, si
  el usuario apaga y enciende el interruptor
  (`removeDisabledServicesFromTemporaryStatesLocked`), si la app se actualiza o
  con un force-stop, que además lo apaga. El interruptor sigue en
  `enabled_accessibility_services`: de ahí «Activado» sin servicio.
- Es distinto del force-stop de §11, que borra el interruptor.
- Ninguna app puede sacar su servicio de ese estado: abrir Still no lo revive,
  y enlazarlo desde la propia app no llega al sistema porque su conexión está
  muerta.

**Reproducción sin Xiaomi:** en el emulador API 36, `adb shell am stop-app
com.still.screentime` deja exactamente ese estado (`Crashed
services:{…StillAccessibilityService}` con el interruptor activado). Abrir
Still no lo cambia; apagar y encender el interruptor sí.

### 13.2 Arreglo

Solo JS; lo nativo no cambia.

- `pauseStatus` distingue `stopped` (activado pero sin servicio) de `activate`.
  Hoy muestra «Still se detuvo» con «Volver a encender Still»; Ajustes, «Still
  se detuvo» / «Tu teléfono lo cerró. Apágalo y vuelve a encenderlo en
  Accesibilidad.».
- Paso de Accesibilidad: «Vuelve a encender Still.» con qué hacer (apagar y
  encender; Still vuelve solo) y, en fabricantes que cierran apps, que pasa al
  cerrar Still desde Recientes y que el paso siguiente lo evita.
- «Que Still siga activo»: dice qué pasa si el teléfono cierra Still. En Xiaomi
  pide «Inicio automático» y la batería «Sin restricciones» (los dos en la
  información de Still, cuyo botón pasa a secundario) y **fijar Still en
  Recientes** con el candado, que MIUI nunca cierra.
- «¿No aparece la pausa?»: la primera causa pasa a ser «Apaga y vuelve a
  encender Still» cuando está activado sin servicio.

**Verificado en el emulador API 36:** `stop-app` → Hoy, Ajustes y el paso de
Accesibilidad muestran el estado detenido (en inglés y español, con el texto
de Xiaomi forzado a mano para la captura) → «Abrir Accesibilidad» → apagar y
encender → Still vuelve solo y el paso queda en «Still está activado». También
«¿No aparece la pausa?» con la causa nueva primero. Typecheck y 290 tests en
verde.

### 13.3 Pendiente en el Xiaomi

Confirmar que con «Inicio automático» activado, y con Still fijado en
Recientes, cerrarlo ya no deja la pausa apagada. Si con el inicio automático
sigue pasando, el siguiente experimento es el servicio en un proceso propio
(`android:process`). Eso obliga a compartir las preferencias entre procesos y
a separar el directorio de WebView de los anuncios.

---

## 14. Cada ajuste, con acceso directo (2026-09-25)

Pedido del usuario: el resumen final decía «Still sigue activo en segundo plano ·
recomendado» sin forma de ir a arreglarlo. Y, en general, cada vez que Still
muestra un ajuste tiene que llevar a su lugar exacto.

| Dónde | Qué abre ahora |
|---|---|
| Resumen «Todo listo»: línea pendiente | Su paso, y en «segundo plano» además los ajustes del primer consejo del fabricante (información de Still en Xiaomi). Al volver, el paso lo comprueba y deja confirmarlo |
| «Que Still siga activo»: fila de batería | La batería de Still (`ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS`; en Android 16 abre la batería de la app) |
| «Que Still siga activo»: cada consejo | Su pantalla: `appInfo` (inicio automático y batería en Xiaomi; suspensión en Samsung), `battery`, `autostart` (listas de Huawei, OPPO y vivo), `popups` («Otros permisos» de MIUI), `recents` (abre Recientes desde el servicio) |
| «¿No aparece la pausa?» | Los mismos consejos, cada uno con su acceso; las causas de Accesibilidad abren Accesibilidad y Still vuelve solo |
| Prueba fallida | «Still no está funcionando» abre Accesibilidad; ventanas emergentes abre su pantalla |
| Hoy y Ajustes, «Still se detuvo» | Accesibilidad directo (sin pasar por el flujo); Still vuelve solo |

Nativo nuevo: `StillSetup.openKeepAliveSetting(target)`; cada lista termina en
la información de Still, que existe en todos los teléfonos, y Recientes usa
`GLOBAL_ACTION_RECENTS` del servicio. Si nada abre (Recientes sin el servicio,
o un build anterior a este sin el método), Still dice cómo llegar en una hoja.
Los builds sin `openKeepAliveSetting` usan la batería o la información de Still.

**Verificado en el emulador API 36** con un build de depuración: cada consejo
muestra «Configurar ›» («Abrir ›» en Recientes); la fila de batería abrió
`AppBatteryUsageActivity` de Still y el primer consejo de Xiaomi abrió
`InstalledAppDetails` de Still. Recientes, ventanas emergentes y el toque en el
resumen quedaron sin comprobar: la Mac se quedó sin memoria (23 GB de swap) y
el emulador dejó de responder. Typecheck y 291 tests en verde.

**Pendiente en el Xiaomi:** que «Otros permisos» de MIUI (ventanas emergentes)
abra en HyperOS, y que Recientes abra con la tarjeta de Still a mano.

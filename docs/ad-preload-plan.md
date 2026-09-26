# Anuncios siempre listos: que la pausa no muestre "Preparando el anuncio…"

Rama: `feat/ad-preload` (worktree `../screen_time-ad-preload`, sale de `main`
0654a2c). Escrito el 2026-09-26 a partir del pedido del usuario:

> Lo ideal sería que NUNCA aparezca "preparando ad", así que podríamos siempre
> tener en la recámara una ad ya precargada y no esperar a que el usuario entre
> al shield para empezar a preparar. O preparar VARIAS antes así tenemos varias
> para mostrar. […] a veces tarda MUCHO en obtener la ad y a ese tiempo de
> espera se agrega el de preparar.

Este plan solo investiga y decide; la implementación la hace una sesión aparte
con el prompt de §8.

## 1. Qué pasa hoy (leído en el código de `main`, 2026-09-26)

Ya hay precarga en las dos plataformas, pero de **un solo anuncio** y con
huecos que dejan la recámara vacía justo cuando llega la pausa.

### Android (nativo, `StillRewardedAdManager.kt`)

- Un anuncio vive en el proceso del servicio de accesibilidad (sobrevive entre
  pausas). Se precarga al conectar el servicio, al sincronizar la config, al
  terminar una ventana, al abrir el escudo y después de mostrar uno.
- **Caducidad sin reposición:** a los 55 min `isAdReady()` descarta el anuncio y
  recién ahí pide otro. Nadie lo mira hasta la siguiente pausa, así que **la
  primera pausa después de una hora sin usar el teléfono siempre espera**
  ("Preparando…" hasta 12 s, `AD_WAIT_MS`).
- **Sin reintentos:** si una carga falla (sin relleno, sin red), no se vuelve a
  intentar hasta el próximo disparador, que suele ser el escudo mismo, y ese
  escudo espera.
- **Uno solo:** después de ver un anuncio, la recarga arranca al cerrarlo; si la
  ventana elegida es corta, la pausa siguiente puede encontrarla en vuelo.
- El SSV se pone al mostrar (`setServerSideVerificationOptions` con un intent
  prefirmado del buffer de 3), así que el anuncio precargado no depende de la red
  de Still.

### iOS (React Native, `reward-provider.ts` + `reward-ad-state.tsx`)

- `RewardAdProvider` prepara un anuncio en cuanto la app está elegible, pero todo
  en fila: `AdsConsent.gatherConsent` (red, UMP) → `mobileAds().initialize()` →
  `POST /api/v1/rewards/intents` (red, Vercel + Supabase) → `RewardedAd.load`
  (hasta 12 s).
- iOS suspende la app en segundo plano y a menudo la cierra. **En frío (el
  atajo abre Still con la app cerrada) toda esa fila corre con la pausa en
  pantalla.** Esta es la espera "inaudita": red de consentimiento + red del
  intent + carga del anuncio, una detrás de otra.
- **Anuncio viejo:** el anuncio preparado solo se renueva cuando su intent está
  por vencer (24 h). Un anuncio de AdMob caduca a la hora, así que tras más de 1 h
  suspendida la app ofrece "Ver anuncio" con un anuncio caducado, que
  probablemente falle al mostrarse ("Ese anuncio no cargó").
- **Suspensión como fallo:** una carga iniciada justo antes de volver a la app
  bloqueada queda congelada; al volver, el `setTimeout` de 12 s vence de golpe →
  "unavailable" → la pausa siguiente pide un anuncio nuevo y espera.
- `react-native-google-mobile-ads` 15.8.3 **aplica el SSV al cargar** (lo lee de
  las opciones del pedido en el callback de carga, `RNGoogleMobileAdsFullScreenAd.mm`)
  y no expone cómo cambiarlo después. En iOS cada anuncio precargado necesita su
  intent **antes** de cargar.
- El intent vale 24 h (`apps/web/app/api/v1/rewards/intents/route.ts`) y sigue
  pendiente hasta que se reclama; el servidor admite 5 pendientes por usuario.

## 2. Qué se descartó

- **API de precarga de Google** (`RewardedAdPreloader`: buffer, reintentos y
  caducidad automáticos). En Android legacy 24.x es "limited alpha" (24.4.0) y
  en iOS es beta desde el SDK 13.3.0, mientras la app usa 12.11.0 a través de
  `react-native-google-mobile-ads` 15.8.3. Subir el SDK de iOS por fuera de la
  librería o depender de una API alfa es más riesgo que escribir el pool, que son
  pocas líneas. Revisar cuando la librería traiga el SDK 13.x y la API salga de
  beta.
- **Refresco en segundo plano en iOS** (`BGAppRefreshTask`): iOS decide cuándo
  (o si) corre, y un anuncio cargado en segundo plano se pierde si iOS cierra la
  app después. No garantiza nada.

## 3. Decisiones (cerradas, no reabrir)

| # | Decisión |
|---|----------|
| P1 | **Pool de 2 anuncios** en Android y en iOS (Google recomienda 2 por unidad; tope de la app, 6). Se muestra primero el más viejo que siga válido. Una sola carga en vuelo por vez: se llena de a uno hasta 2. |
| P2 | **Vida útil:** un anuncio se descarta a los 55 min de cargado (igual que hoy en Android) y se renueva a partir de los 50 min, de a uno, para que nunca caduquen los dos juntos. |
| P3 | **Android renueva solo con la pantalla encendida** (usuario, 2026-09-26: ahorra datos, los videos pesan varios MB). Con la pantalla apagada los anuncios se dejan caducar. Al encenderse la pantalla (`ACTION_SCREEN_ON`) y al desbloquear (`ACTION_USER_PRESENT`) se poda y se rellena al instante: el encendido suele adelantarse varios segundos a abrir una app. También se rellena cuando vuelve la red (`registerDefaultNetworkCallback`). |
| P4 | **Reintentos tras un fallo, con espera creciente:** 30 s, 1 min, 2 min, 5 min y 10 min como tope; se reinicia al cargar bien. Los disparadores (pantalla, primer plano, red, escudo) saltan la espera solo si el último intento fue hace 30 s o más. En Android, el reintento programado con la pantalla apagada espera al encendido (P3). |
| P5 | **La pausa espera como máximo 3 s** (usuario, 2026-09-26). Reemplaza el "hasta 12 s" de D1 en `docs/ads-only-pause-plan.md`; el resto de D1 sigue: sin anuncio queda la respiración de 15 s y una respiración empezada nunca se cambia por el anuncio. La carga sigue en segundo plano y llena el pool para la próxima pausa. Constantes: JS `AD_GATE_WAIT_MS = 3_000` y Kotlin `AD_WAIT_MS = 3_000L`, con comentario de espejo. El tiempo límite de una carga en segundo plano es otro: 30 s en iOS (`REWARD_AD_LOAD_TIMEOUT_MS`) y `LOAD_STUCK_MS` (60 s) en Android. |
| P6 | **iOS guarda sus intents en disco** (`lib/storage`), uno por lugar del pool, y los reutiliza al recargar un anuncio caducado, descartado o que falló al mostrarse. Un intent deja de reutilizarse cuando su anuncio dio `earned`, se haya reclamado o no. El `POST` de intents sale del camino crítico: corre en segundo plano, y en frío la carga usa los intents guardados si les quedan más de 60 s. Como máximo quedan 3 pendientes de iOS por usuario (2 del pool + 1 de reemplazo), por debajo del tope de 5 del servidor. |
| P7 | **iOS no espera al consentimiento si ya lo tenía:** si `AdsConsent.getConsentInfo()` dice `canRequestAds` (de la sesión anterior), se inicializa y se carga enseguida y `gatherConsent` corre en paralelo (es el patrón que documenta Google). Si después dice que no se puede, se vacía el pool. Sin consentimiento previo (primera vez), igual que hoy. |
| P8 | **iOS y la suspensión:** al volver a primer plano (`AppState` `active`) se poda lo que tiene más de 55 min y se rellena. Una carga que quedó en vuelo durante la suspensión y lleva más de 30 s se abandona y se reinicia: la suspensión **no** cuenta como fallo ni activa la espera creciente. Ningún anuncio de más de 55 min se ofrece ni se muestra. |
| P9 | **Medición:** evento PostHog `pause_ad_gate` con `{ platform, ad: "ready" \| "preparing" \| "none", waitedMs }` cuando la pausa resuelve qué ofrece (al abrir si ya hay anuncio; si no, al llegar el anuncio o al vencer los 3 s). iOS lo envía con `capture` (respeta la preferencia de analítica). Android lo anota en una cola en `SharedPreferences` (como la cola de resultados de anuncios, tope 50 entradas) y React Native la vacía y la envía al volver a primer plano. Sin datos nuevos: ni app, ni paquete, ni hora exacta. |
| P10 | **Sin cambios de servidor.** Contratos, endpoints y migraciones quedan igual. |
| P11 | **Salida:** Android es nativo y necesita build de tienda; iOS es solo JS pero toca anuncios, y el runbook (§6) manda esos cambios por build de tienda. Sale todo junto como 0.3.6 (`pnpm version:apps 0.3.6` + `pnpm deploy:apps`), **solo cuando el usuario lo pida**. |

## 4. Fases

Cada fase termina con sus tests en verde y un commit en la rama. No hacer push
ni publicar builds ni actualizaciones OTA (§6). El worktree nuevo necesita
`pnpm install` antes de empezar.

### Fase 1: lógica pura del pool

- `apps/mobile/src/lib/ad-pool.ts` (sin React Native, como
  `reward-intent-buffer.ts`): tipos `PooledAd<T> = { item: T; loadedAt: number }`
  y funciones puras `pruneExpired(pool, now, ttlMs)`, `takeOldest(pool)`,
  `slotsToFill(pool, size)`, `dueForRefresh(pool, now, refreshAfterMs)`,
  `retryDelayMs(failures)` (P4), `triggerMayBypassBackoff(lastAttemptAt, now)`
  y `gateOffer({ poolReady, loading, waitedMs })` → `ready | preparing | none`
  (P5). Constantes `AD_POOL_SIZE = 2`, `AD_TTL_MS = 55 min`,
  `AD_REFRESH_AFTER_MS = 50 min`, `AD_GATE_WAIT_MS = 3_000`.
- `ad-pool.test.ts` con Vitest: poda, orden, llenado de a uno, escalera de
  reintentos y tope, espera de 3 s.
- Espejo en Kotlin: `android/.../AdPool.kt` con la misma lógica sobre
  `elapsedRealtime` (sin clases de Android) y `android/app/src/test/.../AdPoolTest.kt`,
  en el estilo de `PausePointTest.kt`.

### Fase 2: Android

- `StillRewardedAdManager`: `loadedAd` pasa a ser una cola de hasta 2
  `(RewardedAd, loadedAtElapsed)` usando `AdPool`. `state()` es `READY` si queda
  alguno válido. `show()` toma el más viejo válido; el SSV se sigue poniendo al
  mostrar con el buffer de intents (sin cambios). Al terminar una carga bien, si
  falta otro, empieza el siguiente.
- Renovación (P2, P3): un `Handler` programa la próxima renovación a los 50 min
  del más viejo. Al vencer, si `PowerManager.isInteractive` descarta y recarga
  ese; si no, lo deja para el encendido.
- Reintentos (P4): contador de fallos y `postDelayed` con `AdPool.retryDelay`.
  El contador vuelve a 0 al cargar bien. `preload(reason)` respeta la regla de los
  30 s.
- `StillAccessibilityService`: registra en `onServiceConnected` (y quita en
  `onUnbind`/`onDestroy`) un receptor de `ACTION_SCREEN_ON` y
  `ACTION_USER_PRESENT` y un `NetworkCallback`. Los tres llaman
  `StillRewardedAdManager.preload(ctx, "screen-on" | "unlocked" | "network")`.
  Al apagarse la pantalla se cancela la renovación programada.
- `InterventionActivity`: `AD_WAIT_MS = 3_000L` (P5) y se actualiza el
  comentario del espejo. Anota `pause_ad_gate` en la cola (P9).
- Solo en debug: una clave de preferencias (`debug_ad_ttl_ms`) acorta la vida
  útil para probar la caducidad en QA. En release se ignora.
- `adb logcat -s StillRewardedAd` muestra cada carga, renovación, poda y
  reintento con su motivo.

### Fase 3: iOS

- `reward-provider.ts`: el pool (P1) reemplaza `loadedAd`/`loadingAd`. Cada
  lugar guarda `{ intent, ad, loadedAt }`. `REWARD_AD_LOAD_TIMEOUT_MS = 30_000`
  (P5). `prepare()` aplica P7 con `AdsConsent.getConsentInfo()`.
- `reward-ad-state.tsx`: el estado sale del pool (`ready` si hay un anuncio
  válido; `preparing` si no hay y hay una carga en vuelo; `unavailable` tras un
  fallo sin anuncio). Guarda y reutiliza intents en disco (P6). Pide los intents
  que faltan en segundo plano. Escucha `AppState` (P8). Reintenta con la escalera
  de P4, solo en primer plano. `showPrepared()` toma el más viejo y enseguida
  rellena ese lugar.
- `shortcut-intervention.tsx`: el "Preparando" dura como máximo
  `AD_GATE_WAIT_MS` desde que abre la pausa. Después la puerta pasa a `none` y
  empieza la respiración. `awaitingFreshAd` queda dentro de esos mismos 3 s.
  Envía `pause_ad_gate` (P9).
- Tests: ajustar `reward-provider.test.ts` (el tiempo límite nuevo, el pool, el
  consentimiento en paralelo) y agregar el caso de la puerta a los 3 s en
  `shortcut-intervention.test.ts` o `intervention-flow.test.ts`.

### Fase 4: medición en Android desde React Native

- Un método del puente (`StillRestrictionModule`) que devuelve la cola
  `pause_ad_gate` y la vacía. React Native lo llama al volver a primer plano y
  manda cada entrada con `capture("pause_ad_gate", …)`. Test de la conversión.

### Fase 5: verificación y documentos

- `pnpm check` en verde, más `./gradlew :app:testDebugUnitTest` para
  `AdPoolTest`.
- QA en emulador Android (reusar el que corra, si no `Still_QA_API_36`; receta
  de `docs/android-parity-plan.md` y la memoria del escudo) con anuncios de
  prueba:
  1. Al conectar el servicio, el log muestra 2 cargados.
  2. Pausa → "Ver anuncio" al instante → verlo → al terminar la ventana, la pausa
     siguiente también ofrece "Ver anuncio" al instante (el segundo).
  3. `debug_ad_ttl_ms` corto y pantalla apagada más que eso → al encender, el
     log muestra la poda y la recarga, y la pausa abierta enseguida ofrece el
     anuncio o espera 3 s como máximo.
  4. Modo avión → la pausa pasa a la respiración a los 3 s; el log muestra la
     escalera de reintentos; sin modo avión → recarga sola.
- QA en el simulador iOS (`~/.claude/bin/ios-sim acquire`, UDID explícito) con
  anuncios de prueba:
  1. Abrir la pausa del atajo en caliente → "Ver anuncio" al instante.
  2. Terminar la app y abrir la pausa en frío → se mide cuánto tarda "Ver
     anuncio" (intents guardados, consentimiento en paralelo); si pasa de 3 s,
     respiración.
  3. Ver un anuncio, volver y abrir otra pausa enseguida → el segundo anuncio,
     sin espera.
  4. Sin red → respiración a los 3 s.
- Completar §7 con lo medido y agregar una nota en D1 de
  `docs/ads-only-pause-plan.md` que apunte a P5.

## 5. Riesgos y qué mirar

- **Tasa de muestra en AdMob:** con 2 en la recámara, algunos anuncios caducan
  sin mostrarse; bajan la "show rate" del informe, pero no son impresiones ni
  tráfico inválido. P3 limita el desperdicio a los ratos de pantalla encendida.
- **Datos y batería:** como mucho, unas 2 cargas por hora de pantalla encendida
  sin pausas; ninguna con la pantalla apagada (Android). En iOS solo se carga con
  la app en primer plano.
- **Xiaomi y el servicio caído** (memoria `android-service-stopped-after-close`):
  si el proceso muere, el pool se pierde; al reconectar el servicio se rellena. No
  empeora respecto de hoy.
- **Intents de iOS:** un intent `earned` que no se pudo reclamar no se reutiliza
  nunca (P6); el servidor lo concilia como hoy.

## 6. Pasos del usuario

- Probar en el iPhone (iOS 27) y en el Xiaomi con la build 0.3.6 cuando exista:
  abrir una app bloqueada después de más de una hora sin usar el teléfono (el
  caso que hoy siempre espera), y dos pausas seguidas.
- Decidir cuándo publicar 0.3.6 (`pnpm version:apps 0.3.6`, commit,
  `pnpm deploy:apps`).
- En PostHog, mirar `pause_ad_gate`: la proporción de `ready` al abrir es la
  métrica de "nunca aparece Preparando".

## 7. Resultados (2026-09-26)

Commits en `feat/ad-preload`: `7873d79` (fase 1), `495def5` (fase 2), `600886f`
(fase 3), `feab736` (fase 4), `2e077e5`, `c0c9336` y `b8c2f61` (arreglos del QA,
abajo). Sin push, sin builds de tienda, sin OTA.

### Verificado

- `pnpm check` en verde (contracts 30, mobile 363, web 83 tests) y
  `./gradlew :app:testDebugUnitTest` en verde (35 tests JVM, 8 de `AdPoolTest`).
- **Android**, emulador `Still_QA_API_36`, build debug de la rama, anuncios de
  prueba, log `adb logcat -s StillRewardedAd`:
  1. Al conectar el servicio el pool llega a 2 anuncios en 9 a 12 s (el primero
     tarda 7 a 10 s y el segundo 2 a 3 s).
  2. Con el pool lleno, la pausa ofrece «Watch ad» al instante
     (`pause_ad_gate` = `ready → ready, 0 ms`). Después de ver uno, el pool vuelve
     a 2 en 17 s y la pausa siguiente también ofrece el anuncio al instante.
  3. Con `debug_ad_ttl_ms = 120000`, la renovación arranca a los 109 s del primer
     anuncio y mientras tanto siguen 2 disponibles. Con la pantalla apagada más que
     la vida útil no hubo ninguna carga (el reintento programado se descartó). Al
     desbloquear con el pool vacío, la carga arrancó (`unlocked`) y la pausa
     esperó 2,3 s y ofreció el anuncio (`preparing → ready, 2302 ms`).
  4. En modo avión la carga falla en 3 s. La pausa, sin carga en vuelo y con el
     reintento retenido, va directo a la respiración (`none → none, 0 ms`). Los
     reintentos salen a los 30 s y después a los 60 s; al volver la red, el aviso
     `network` recarga sin esperar el minuto (2 listos en 13 s).
- **iOS**, simulador `Still QA` (iOS 26), build debug 0.3.5 de la rama con Metro
  del worktree, anuncios de prueba:
  1. En caliente, la pausa ofrece «Ver anuncio» al instante.
  2. En frío por el camino real (contexto pendiente del App Intent escrito en el
     app group y la app cerrada), «Preparando» duró menos de 1 s y «Ver anuncio»
     apareció a los ≤ 1,8 s de hidratar. Usó los 2 intents guardados, sin ningún
     `POST` al servidor.
  3. Después de ver un anuncio (ganado y reclamado), una pausa inmediata ofrece el
     segundo al instante. El intent ganado sale del disco y se crea uno nuevo para
     el reemplazo (quedan 2).

### Hallazgos y arreglos

- **Reintento en 0 s** (`c0c9336`): en el emulador una carga tardó 97 s en fallar
  y la espera, contada desde el inicio del intento, ya había vencido. Ahora cuenta
  desde el fallo, en Kotlin y en TS, con test.
- **`pause_ad_gate` doble** (`b8c2f61`): cuando el servicio vuelve a levantar el
  escudo de la misma apertura (arranque en frío), `onNewIntent` lo recrea y
  anotaba de nuevo. La marca pasa por el estado guardado, con la clave app +
  aperturas del día.
- Reinstalar la app deja el servicio en «Crashed services» hasta apagarlo y
  prenderlo. Es el problema conocido del Xiaomi, no es de este cambio.
- El emulador tiene 2 GB de RAM: las cargas tardan más que en un teléfono y la app
  Reloj tuvo una ANR detrás del escudo. No tiene que ver con los anuncios.
- QA en el simulador: `still://` lo captura una app vieja `com.still.screentime`,
  así que conviene usar `app.still.ios://intervention?...`. Un enlace directo en
  frío llega antes de hidratar y sin `deviceId` va directo a la respiración, igual
  que antes. El camino real espera la hidratación
  (`checkPendingShortcut`), por eso la medición en frío se hizo escribiendo
  `shortcutIntervention.pending` en el app group.

### No verificado

- iOS sin red: el simulador usa la red del Mac. Lo cubren los tests (espera de
  3 s).
- La fase 4 en un dispositivo (React Native vaciando la cola de Android): la
  cubren los tests y la compilación. Abrir la app en el emulador recién borrado
  habría registrado un dispositivo nuevo en producción.
- El consentimiento en paralelo (P7): en desarrollo no se pide consentimiento.
  Lo cubren los tests.
- Nada se probó todavía en teléfonos reales.
- Un anuncio de prueba se reclamó contra la API de producción desde el
  dispositivo de desarrollo del simulador, como en los QA anteriores.

### Rebase sobre `main` 0.3.6 y salida en 0.3.7 (2026-09-26)

- `main` 0.3.6 (sesión «borrar datos y autenticación») reescribió el arranque de
  `StillAccessibilityService`: cada paso en `guarded`, nada de anuncios en
  `onServiceConnected` y una precarga `service-idle` 5 s después si la pantalla
  está encendida. Quedó esa versión más lo de este plan: `SCREEN_OFF` en el
  receptor y el callback de red. Como Android llama a `onAvailable` apenas se
  registra el callback, la red ahora pasa por
  `StillRewardedAdManager.onNetworkAvailable`, que solo recarga si antes falló
  una carga. Así el arranque sigue liviano.
- En el emulador, con el APK rebaseado: al conectar el servicio no se carga
  nada; la primera carga sale a los 5 s y hay 2 listos a los 7 s. Sin red, la
  carga falla, los reintentos salen a los 30 s y a los 60 s, y al volver la red
  el aviso llega; si el último intento tiene menos de 30 s, espera al reintento
  (P4).
- Checks en verde después del rebase: contracts 30, web 83, mobile 372 y 35
  tests JVM.
- Las notas de App Review y la descripción de la App Store pasaron a «3
  seconds» y a «eliges cuánto tiempo entrar» (`docs/store-listing.md`).
- Sale en la 0.3.7 junto con todo `main`.

### Pendiente para el usuario

- Probar en el iPhone y en el Xiaomi (§6), sobre todo abrir una app bloqueada
  después de más de una hora sin usar el teléfono.

## 8. Prompt para `/goal`

```
/goal Implementa docs/ad-preload-plan.md en la rama feat/ad-preload (worktree
../screen_time-ad-preload; corre pnpm install primero). Las decisiones P1–P11
están cerradas: no las reabras ni reinvestigues la API de precarga de Google.
Haz las fases 1 a 5 en orden, cada una con sus tests en verde y un commit en la
rama. Para el simulador usa ~/.claude/bin/ios-sim acquire y su UDID; para
Android reusa el emulador que esté corriendo. No hagas push, no publiques
builds ni actualizaciones OTA y no toques la carpeta principal del repo (otra
sesión trabaja ahí). Termina completando §7 con lo medido y lo que quede
pendiente para el usuario.
```

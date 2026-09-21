# Still iOS · Pausa vía Atajos v2 — investigación y plan

Fecha: 2026-09-20 · Rama base: `codex/ios-shortcuts-shield-flow` · Estado: **fases 1–5 implementadas** (ver §11); Fase 0 pendiente en dispositivo.

Este documento complementa a `docs/ios-shortcuts.md` (contrato del flujo v1 ya
construido en esta rama). Aquí se documenta cómo funciona one sec, qué permite
iOS, qué falta en Still y en qué orden construirlo.

> **Límite de la investigación.** one sec no pudo instalarse desde esta sesión:
> el simulador de iOS no tiene App Store y un iPhone físico no es manejable
> desde aquí. Todo lo marcado **[doc]** proviene de la documentación oficial de
> one sec, su ficha de App Store y reseñas; lo marcado **[inferido]** es
> deducción técnica. La Fase 0 cierra esa brecha en el iPhone con iOS 27.

---

## 0. Decisiones ya tomadas (no reabrir)

| # | Decisión | Origen |
|---|---|---|
| D1 | El anuncio arranca con **toque explícito "Ver anuncio"** (formato rewarded + SSV actual). Tras completarlo aparecen "Quiero entrar" / "Ya no quiero entrar". | Usuario, 2026-09-20 |
| D2 | "Ya no quiero entrar" usa **`UIApplication.suspend` tras un kill switch remoto**, con fallback automático (atajo auxiliar "Ir a inicio" → pantalla "Listo"). | Usuario |
| D3 | Sin anuncio disponible: **pase guardado → acceso de emergencia → pausa cronometrada de 15 s**. Nunca se deja al usuario atascado. | Usuario |
| D4 | Dispositivo de validación: **iPhone con iOS 27**. | Usuario |
| D5 | Se mantiene el **modo Atajos** y siguen desactivados los shields de Managed Settings en iOS (ya decidido en `docs/ios-shortcuts.md`). | Repo |
| D6 | El canal Atajos → Still sigue siendo **App Group + polling** (`shortcutIntervention.pending`), no un deep link. Ya está construido y probado. | Repo |
| D7 | El parámetro del intent sigue siendo `appName: String` (no `AppEntity`), para aceptar tanto un valor fijo como la variable "App actual". Se le añade una lista de opciones. | Este plan |
| D8 | Retorno a la app: **URL scheme del catálogo primero**; si no hay, el atajo de retorno `Still - <App>` que ya existe. | Este plan |

---

## 1. Cómo funciona realmente one sec

### Setup clásico (iOS 17–26) **[doc]**
1. Atajos → Automatización → **+** → **App** → elegir **una** app → "Se abre".
2. "Ejecutar inmediatamente" (iOS 17+; en iOS ≤16 era desactivar "Preguntar antes de ejecutar"; desde 15.4 se puede apagar la notificación).
3. Añadir acción **"🅰️ Activate one sec (when app opens)"**.
4. **Volver a seleccionar la misma app** en el parámetro "App" de la acción ("⚠️ Original App to be Opened"). Sin esto no funciona.
5. Repetir **una automatización por app**. Opcional: una segunda por app ("Se cierra" → "🅱️ Log app closing") para la ventana de "cambio intencional de app".

### Setup nuevo (one sec 6.0 + iOS 27, publicado 2026-09-20) **[doc]**
"Add Intervention" **importa la automatización**: 1 paso en vez de ~10. Es posible porque en iOS 27 los triggers son acciones dentro del atajo, se pueden apilar varios, y un atajo con triggers **se puede compartir por enlace**. Al importarlo, el trigger llega **desactivado y en gris**; el usuario activa un toggle y corre con la configuración del creador (MacStories, reseña de iOS 27).

### Piezas del mecanismo
| Tema | Cómo lo resuelve one sec |
|---|---|
| Selección de apps | En la app (catálogo propio + "custom apps" con nombre y URL scheme). Esa lista alimenta el parámetro "App" de la acción. **[doc]** |
| Detección del intento | No detecta nada por sí misma: iOS ejecuta la automatización y ésta llama a la acción con la app como parámetro. **[doc]** |
| Permisos | Ninguno para el flujo de Atajos. Screen Time solo para bloqueos y "Lock Shortcuts App"; notificaciones y HealthKit opcionales. **[doc]** |
| ¿Se ve la app original? | **Sí**, brevemente (segundos en equipos viejos; "muy mejorado en iOS 18.3"). Workaround oficial: sustituir el icono del Home por un atajo que ejecuta la acción. **[doc]** |
| Volver a la app | **URL scheme** (`instagram://`). Sin scheme: el usuario crea un atajo "Open App" y one sec llama `shortcuts://run-shortcut?name=…`. **[doc]** |
| No continuar | "I don't want to open X" → la app se cierra y queda el Home. **[doc]** Mecanismo **[inferido]**: `UIApplication.suspend` (no hay API pública). |
| Anti-bucle | La acción corre en segundo plano y decide si interviene (ventanas de tiempo, Focus, horarios). **[doc + inferido]** |
| Automatización rota/borrada | **No lo detecta.** Ofrece un banner de diagnóstico y una checklist manual; para evitar el borrado bloquea la app Atajos con Screen Time. Tras reiniciar, iOS no corre automatizaciones ~2 min. **[doc]** |
| Modelo | Gratis 1 app; Pro para más. |

**Conclusión:** one sec no usa nada privado de Apple. Su ventaja es un catálogo de URL schemes, años de tutoriales y, desde hoy, la importación por enlace de iOS 27.

---

## 2. Qué permite iOS (y qué no)

| Pregunta | Respuesta |
|---|---|
| ¿Automation automática al abrir otra app? | **Sí.** Trigger App → "Se abre" + "Ejecutar inmediatamente" (iOS 17+). |
| ¿Evitar que la app original se muestre antes? | **No.** iOS lanza la app y después dispara la automatización. Alternativas: icono-atajo en el Home, o shield de Screen Time — descartado: el shield no puede abrir Still ni mostrar anuncios. **Alternativa adoptada:** aceptar el destello y minimizar la latencia (intent en background, arranque rápido). |
| ¿Pasar a Still qué app era? | **Sí, como parámetro de la acción.** Apple nunca entrega el bundle id; la identidad es lo que configure el atajo: valor fijo por automatización, o la acción **"Obtener app actual" (iOS 18.2+)** en una automatización multi-app. |
| ¿Still puede abrir esa app luego? | **Sí con URL scheme** (`UIApplication.open`, sin confirmación). Sin scheme → `shortcuts://run-shortcut`. No hay API pública para abrir por bundle id. |
| ¿Mandar al Home? | **Sin API pública.** `suspend` (no documentado), atajo con "Ir a la pantalla de inicio", o instrucción manual. |
| ¿Qué pide confirmación? | iOS ≤16 "Preguntar antes de ejecutar". Pasar a primer plano desde un intent: **iOS 16.4–25 muestra diálogo** (`requestToContinueInForeground`); **iOS 26+ no** (`continueInForeground(alwaysConfirm: false)`). Atajos importados: trigger desactivado hasta activar el toggle (iOS 27). |
| Cambios recientes | 15.4 apagar notificación · 17 "Ejecutar inmediatamente" · 18.2 "Obtener app actual" · 18.3 rendimiento · 26 `IntentModes` · 26.4 bloqueo del permiso Screen Time · **27 triggers dentro del atajo, compartibles, apilables** · SiriKit deprecado en WWDC26. |
| ¿Verificar que la automatización existe? | **No hay API.** Única señal fiable: que el intent se ejecute. |

---

## 3. Estado actual de Still en esta rama

Stack: Expo SDK 57 / RN 0.86 con `ios/` committeado, pnpm + Turborepo, Vitest, Supabase + Next.js. `deploymentTarget` 16.4.

**Ya construido y reutilizable**
- `apps/mobile/ios/StillNative/StillShortcutIntent.swift` — `PauseBeforeOpeningIntent` (`openAppWhenRun=false`, `supportedModes=[.background,.foreground(.dynamic)]`) y `ShortcutInterventionState` (prepare/pending/complete/cancel, allowances por app, dedupe 30 s, TTL 10 min, métricas por app).
- Handoff App Group → `app/_layout.tsx:56-75` (polling en `active`) → `/intervention`.
- `src/lib/shortcut-intervention.ts` — `getInterventionUnlockAction` (tabla de decisión) y `completeShortcutAndReturn` (orden allowance → registro → abrir), ambos con tests.
- Anuncios: `src/native/reward-provider.ts` + `src/state/reward-ad-state.tsx` (precarga, tope 12 s, gracia de 1.5 s tras `CLOSED`) y claim SSV en `app/intervention.tsx:101-112`.
- `app/shortcut-setup.tsx` + `src/components/shortcut-step-visual.tsx`.
- Gates: `acceptance:ios-shortcuts`, `acceptance:ios-device-ready`, `src/native/native-config.test.ts`.

**Brechas respecto al flujo objetivo**
1. No hay selección de apps dentro de Still: el nombre se teclea en Atajos y el tutorial usa "YouTube" fijo.
2. Retorno solo por atajo `Still - <App>` (2 artefactos por app, nombre exacto con `·`).
3. Orden invertido: hoy se decide **antes** del anuncio; objetivo: anuncio → decisión.
4. "Volver" navega a la pestaña Hoy; no sale al Home.
5. Sin verificación ni reparación: `getHealth` devuelve éxito fijo en modo Atajos (`StillRestrictionEngine.swift:208-217`).
6. Sin importación por enlace (iOS 27) ni automatización única multi-app.
7. Deuda: `scripts/configure-ios-targets.rb:17-21` no añade `StillShortcutIntent.swift`; `isPauseFeatureEnabled` ignora `iosRestrictionEnabled`; una sola intervención pendiente a la vez; cinco docs siguen diciendo "iOS dormido".

---

## 4. Arquitectura propuesta

### 4.1 Modelo de datos
**JS (fuente de verdad de la selección)** — clave `iosShortcutTargets` en `src/lib/storage.ts`:
```ts
type ShortcutTarget = {
  id: string;               // "instagram" | "custom:<slug>"
  name: string;             // nombre visible = valor que recibe el intent
  aliases: string[];        // variantes para casar "Obtener app actual"
  urlScheme: string | null; // retorno directo; null → atajo de retorno
  origin: "catalog" | "custom" | "detected";
  state: "active" | "removed";
};
```
**Catálogo** — nuevo `src/lib/ios-app-catalog.ts`: ~30 apps (`id`, `name`, `aliases`, `urlScheme`). Cada scheme se verifica en dispositivo (H7) antes de entrar. `LSApplicationQueriesSchemes` (≤50) en `Info.plist` para detectar apps instaladas con `canOpenURL` y ordenarlas primero.

**Nativo (App Group `group.com.still.screentime`)** — claves nuevas junto a las existentes:
- `shortcutIntervention.targets` — espejo JSON de `ShortcutTarget[]`.
- `shortcutIntervention.lastTriggered` — `[targetKey: Date]`, se escribe en **cada** ejecución del intent (también con allowance activa): es la señal de "la automatización vive".
- `shortcutIntervention.setupProbe` — `{ targetKey, startedAt }` para el test de setup (TTL 120 s).
- `resetLocalData()` debe preservar `targets`.

### 4.2 Intent (`StillShortcutIntent.swift`)
- Mantener `appName: String` y añadir `DynamicOptionsProvider` que lista los `targets` activos → en Atajos se **elige de una lista** en vez de teclear, y sigue aceptando la variable "App actual".
- `prepare(appName:)`: resolver target por nombre/alias normalizado → si `state == removed` salir en silencio; si no existe, **auto-adoptar** como `origin: "detected"`; registrar `lastTriggered`; si hay `setupProbe` vigente para ese target devolver contexto con `isSetupTest: true` (sin contar intento).
- `complete()`: `returnURL = target.urlScheme ?? shortcuts://run-shortcut?name=Still - <App>`.
- `ShortcutInterventionContext` gana `isSetupTest: Bool` y `returnKind: "scheme" | "shortcut"`.
- La `targetKey` (base64 del nombre en minúsculas) **no cambia**: allowances y métricas siguen válidas.

### 4.3 Puente (`StillRestrictionEngine.swift/.m`, `src/native/restriction-engine.ts`)
Métodos nuevos: `setShortcutTargets(targets)`, `getShortcutTargetsHealth()` → `[{ name, targetKey, lastTriggeredAt, verifiedAt }]`, `beginShortcutSetupProbe(name)`, `suspendToHome()`. `getHealth` en modo Atajos pasa a `selectedCount = targets activos`, `engineActive = ≥1 verificado`, `issue = "shortcuts_not_verified"` si ninguno.

### 4.4 Comunicación y deep links
- **Atajos → Still:** App Group + polling (D6). No hace falta URL de entrada.
- **Still → app destino:** `Linking.openURL(urlScheme)`; fallback `shortcuts://run-shortcut?name=…`.
- **Still → Atajos (setup/reparación):** enlace iCloud de importación (iOS 27), `shortcuts://open-shortcut?name=Still - Pausa`, `shortcuts://create-shortcut`, `shortcuts://`.
- **Still → Home:** `suspendToHome()`; fallback `shortcuts://run-shortcut?name=Still - Inicio`.

### 4.5 Flujo de intervención (máquina de estados pura)
Nuevo `src/lib/intervention-flow.ts` (+ test), consumido por `app/intervention.tsx`:
```
gate ──"Ver anuncio"──▶ ad ──earned──▶ claim ──ok──▶ decision ──"Quiero entrar"──▶ complete → abrir returnUrl
 │                       ├─dismissed─▶ gate (aviso, sin castigo)      └─"Ya no quiero entrar"─▶ cancel + guardar pase → Home
 │                       └─failed────▶ gate con siguiente fallback
 ├─"Ya no quiero entrar"──▶ cancel → Home
 ├─sin anuncio + pase/emergencia ─▶ "Usar pase · Entrar" → complete → abrir   (el gate ya es la decisión)
 └─sin nada ─▶ pausa 15 s ─▶ decision (entrar sin gastar wallet ni reportar unlock)
```
- La variante del gate la sigue eligiendo `getInterventionUnlockAction`; `retry_ad` sin pase ni emergencia se convierte en `timed_pause`.
- Si el usuario completa el anuncio y elige no entrar, **la recompensa no se pierde**: `addProvisionalReward` sin `spendLocalWallet` → queda como pase guardado.
- Pausa cronometrada: nuevo `unlockShortcutWithPause(contextId)` en `src/state/app-state.tsx` — activa la allowance nativa, **no** gasta wallet ni llama a `reportUnlock` (sin cambios de backend).
- `isSetupTest` → pantalla "Conectado ✓" en lugar del gate.

### 4.6 Salida al Home
`src/lib/leave-to-home.ts`: `router.replace("/(tabs)/(today)")` **antes** de salir (para no reabrir sobre una intervención vieja) → si `config.iosHomeOnCancelEnabled` → `suspendToHome()`; si no → atajo `Still - Inicio` si está marcado como instalado → si no, pantalla "Listo. Desliza hacia arriba para salir."
Flag nuevo `iosHomeOnCancelEnabled` en `remoteConfigSchema` (`packages/contracts/src/schemas.ts`), migración Supabase, `apps/web/app/admin/actions.ts`, `supabase/tests/production_invariants.sql`. Default `false` (fail-closed), se activa desde admin.

### 4.7 Niveles de setup (según versión de iOS)
| Nivel | iOS | Pasos del usuario | Depende de |
|---|---|---|---|
| **A · Importar** | 27+ | Tocar "Añadir a Atajos" → "Añadir" → elegir apps en el trigger → activar toggle | H2 |
| **B · Una automatización** | 18.2–26 | 1 automatización multi-app: App(s) → Se abre → Ejecutar inmediatamente → "Obtener app actual" → "Pause Before Opening" con App = App actual | H1 |
| **C · Por app** | 16.4–18.1 | Flujo v1 actual, pero eligiendo el nombre de una lista y **sin atajo de retorno** para apps del catálogo (6 → 4 pasos) | — |

Cada nivel se activa con constantes en `src/lib/ios-shortcut-setup.ts` (`IOS_SHORTCUT_IMPORT_URL`, `IOS_SINGLE_AUTOMATION_ENABLED`). Si una hipótesis falla, el nivel se apaga y el usuario cae al siguiente **sin cambiar código**.

---

## 5. Flujo completo de usuario

**Configuración:** elige apps en Still → Still elige el nivel A/B/C por versión de iOS → tutorial → Atajos → vuelve a Still → "Probar" abre la app destino → la automatización dispara → Still vuelve al frente con "Instagram conectado ✓".

**Uso:** toca Instagram → iOS la abre (destello) → la automatización corre el intent en background → sin allowance: guarda contexto y trae Still al frente → gate "Instagram se abrió 3 veces hoy" → **Ver anuncio** → anuncio completo → **Quiero entrar** (allowance + `instagram://`; la automatización vuelve a dispararse, ve la allowance y calla) o **Ya no quiero entrar** (intento evitado, pase guardado, Home).

---

## 6. Onboarding / tutorial

| # | Pantalla | Texto aproximado | Acción |
|---|---|---|---|
| 1 | **Elige tus apps** (`/ios-apps`) | "¿Qué apps quieres abrir con más intención?" Lista del catálogo (instaladas primero) + "Otra app…" | Multi-selección → "Continuar (3)" |
| 2A | **Conecta Atajos** (iOS 27) | "Un toque y listo. Still añade un atajo que avisa cuando abres esas apps." 3 mini-pasos ilustrados: *Añadir atajo* → *Elige las mismas apps* → *Activa el interruptor* | "Añadir a Atajos" → enlace iCloud |
| 2B | **Conecta Atajos** (18.2–26) | Checklist de 5 pasos con ilustración por paso | "Abrir Atajos" → `shortcuts://` |
| 2C | **Conecta Atajos** (≤18.1) | Flujo v1 por app, nombre elegido de lista | "Abrir Atajos" |
| 3 | **Pruébalo** | "Abre Instagram para comprobarlo." Fila por app: ○ sin probar / ✓ conectada | "Probar Instagram" → `beginShortcutSetupProbe` + abre el scheme; al volver, ✓ o "No lo detectamos → Reparar" |
| 4 | **Listo** | Resumen + 2 tips: apagar "Notificar al ejecutar"; tras reiniciar el iPhone las automatizaciones tardan ~2 min | "Terminar" → Hoy |

- **Volver a Still:** miga "◀ Still" de iOS o el conmutador; en la prueba, Still vuelve solo porque la automatización lo trae.
- **Editar apps:** Ajustes → "Apps con pausa" (misma lista + estado "Activa · última pausa hace 2 h" / "Sin verificar"). Añadir → recordatorio "añádela también en el trigger del atajo" con `shortcuts://open-shortcut?name=Still - Pausa` → Probar. Quitar → `state: "removed"` (el intent calla) + recordatorio de quitarla del trigger.
- **Reparar:** checklist con causas ordenadas — interruptor apagado · app no está en el trigger · falta "Ejecutar inmediatamente" · atajo borrado (→ reimportar) · iPhone recién reiniciado — y botón "Probar de nuevo".
- Reutilizar `ShortcutStepVisual` con variantes nuevas (`import`, `toggle`, `current-app`) y `localize(en, es)`.

---

## 7. Archivos a tocar

**Nuevos:** `apps/mobile/src/lib/ios-app-catalog.ts` · `src/lib/ios-shortcut-setup.ts` · `src/lib/intervention-flow.ts` · `src/lib/leave-to-home.ts` · `src/state/shortcut-targets.ts` (todos con `.test.ts`) · `app/ios-apps.tsx` · `app/shortcut-repair.tsx` · migración Supabase para el flag.

**Modificados:** `ios/StillNative/StillShortcutIntent.swift` · `StillRestrictionEngine.swift` / `.m` · `SharedRestrictionState.swift` (preservar targets en reset) · `ios/Still/Info.plist` (`LSApplicationQueriesSchemes`) · `scripts/configure-ios-targets.rb` (añadir el intent) · `src/native/restriction-engine.ts` · `src/state/app-state.tsx` · `app/intervention.tsx` · `app/shortcut-setup.tsx` · `app/(onboarding)/index.tsx` · `app/(tabs)/(settings)/index.tsx` · `app/_layout.tsx` (registrar rutas, pasar `isSetupTest`) · `src/components/shortcut-step-visual.tsx` · `src/lib/shortcut-intervention.ts` (`timed_pause`) · `src/lib/restriction-mode.ts` · `packages/contracts/src/schemas.ts` · `apps/web/app/admin/actions.ts` · `supabase/tests/production_invariants.sql` · `scripts/verify-ios-shortcuts-build.mjs` · `src/native/native-config.test.ts` · `docs/ios-shortcuts.md`, `docs/store-compliance.md`, `docs/implementation-status.md`.

---

## 8. Riesgos y edge cases

| Riesgo | Mitigación |
|---|---|
| App Review rechaza `suspend` | Flag remoto apagado por defecto + fallback en cadena; nota en review notes. |
| H1/H2 fallan en dispositivo | Niveles A/B tras constantes; C ya funciona hoy. |
| Nombre localizado de "App actual" ≠ catálogo | `aliases` + normalización (minúsculas, sin diacríticos); si no casa, auto-adopción como `detected`. |
| URL scheme errado o app desinstalada | `openURL` falla → fallback a atajo de retorno → mensaje con la allowance ya activa (copy actual). |
| Dos apps disparan casi a la vez | Hoy hay un único `pending`: gana la última. Aceptado en v2; documentar. |
| Anuncio cerrado antes de terminar | Vuelve al gate sin castigo ni recompensa. |
| Modo avión para forzar la pausa de 15 s | Fricción igualmente aplicada; allowance de la pausa limitada a 5 min. |
| Reinicio del iPhone (~2 min sin automatizaciones) | Tip en "Listo" y en Reparar. |
| Usuario borra o apaga el atajo | No detectable; estado "última pausa hace X" + botón Probar. Sin falsas alarmas. |
| iOS 16.4–25 muestra "Continuar en Still" | Limitación de Apple documentada; experiencia objetivo = iOS 26+. |
| Xcode local 26.0.1 sin SDK de iOS 27 | Instalar Xcode 27 o distribuir por EAS/TestFlight antes de la Fase 0. |
| `expo prebuild --clean` borra el intent | Añadirlo a `configure-ios-targets.rb` (Fase 1). |
| Política AdMob | Rewarded con opt-in explícito (D1) ✔; ningún anuncio en extensiones ✔. |

---

## 9. Fases, orden y criterios de terminado

### Fase 0 — Validación en iPhone iOS 27 (manual, ~1 h, la hace el usuario)
Prerrequisito: build instalable en iOS 27. Registrar resultados en §10.
- **H9** Instalar one sec 6.0, "Add Intervention", abrir el atajo importado y capturar su estructura (trigger, acciones, parámetro). Anotar qué pasa al elegir "no abrir".
- **H1** Automatización multi-app + "Obtener app actual" → ¿llega el nombre correcto? Latencia.
- **H2** Compartir por enlace un atajo con trigger App + acción de Still: ¿qué se conserva (apps, "Ejecutar inmediatamente", parámetro ligado a variable)?
- **H3** `continueInForeground` sin diálogo en iOS 27; tiempo app destino → gate de Still (arranque en frío y en caliente).
- **H4** `suspend` aterriza en el Home (no en la app destino).
- **H5** Volver por URL scheme re-dispara la automatización y la allowance la silencia.
- **H6** `DynamicOptionsProvider` lista las apps y acepta la variable.
- **H7** Verificar uno a uno los URL schemes del catálogo.
**Terminado cuando:** §10 está completo y las constantes de nivel A/B tienen valor.

### Fase 1 — Targets, catálogo e intent
**Terminado cuando:** elegir apps en Still las hace aparecer como lista en la acción de Atajos; nombres desconocidos se auto-adoptan; `removed` calla; `lastTriggered` se escribe siempre; retorno por scheme con fallback; `configure-ios-targets.rb` incluye el intent; `pnpm check` verde y `acceptance:ios-shortcuts` actualizado.

### Fase 2 — Flujo de intervención anuncio → decisión
**Terminado cuando:** `intervention-flow.test.ts` cubre todas las transiciones de §4.5; en dispositivo: anuncio completo → dos opciones; anuncio cerrado → gate; pase guardado al cancelar tras anuncio; pausa de 15 s cuando no hay nada; los tests de `completeShortcutAndReturn` siguen pasando.

### Fase 3 — Salida al Home + flag remoto
**Terminado cuando:** con el flag activo "Ya no quiero entrar" deja al usuario en el Home y al reabrir Still se ve Hoy; con el flag apagado aplica el fallback; migración + pgTAP + admin verdes.

### Fase 4 — Onboarding, gestión y reparación
**Terminado cuando:** un usuario nuevo en iOS 27 completa selección → importación → prueba en < 2 min sin teclear nada; Ajustes muestra estado real por app; `getHealth` ya no devuelve éxito fijo; Reparar lleva a una prueba exitosa.

### Fase 5 — Endurecimiento y documentación
**Terminado cuando:** checklist física de `docs/ios-shortcuts.md` (ampliada a 12 puntos) pasa en iOS 27 y en la versión mínima soportada; docs sin contradicciones sobre "iOS dormido"; `isPauseFeatureEnabled` vuelve a respetar `iosRestrictionEnabled`; notas de App Review redactadas.

Orden: **0 → 1 → 2 → 3 → 4 → 5**. Las fases 1–3 no dependen de los resultados de la Fase 0 y pueden empezar en paralelo; la 4 sí necesita H1/H2.

---

## 10. Resultados de validación (rellenar en Fase 0)

| Hipótesis | Resultado | Notas |
|---|---|---|
| H1 App actual en automatización multi-app | ⏳ | |
| H2 Importación por enlace con trigger | ⏳ | |
| H3 Primer plano sin diálogo en iOS 27 | 🟡 simulador | Confirmado en el simulador de iOS 26.0: `continueInForeground` trae Still al frente sin diálogo. Falta iOS 27 y dispositivo. |
| H4 `suspend` → Home | 🟡 simulador | Confirmado en el simulador de iOS 26.0: aterriza en el Home y al reabrir Still se ve Hoy. Falta dispositivo. |
| H5 Retorno por scheme + allowance | 🟡 simulador | `applenews://` vuelve a News sin pasar por Atajos y el intent calla durante la allowance. El re-disparo de la automatización no es comprobable en simulador. |
| H6 Lista de opciones + variable | ✅ simulador | La acción lista exactamente las apps elegidas en Still y ofrece «Variables…». |
| H7 URL schemes del catálogo | ⏳ | |
| H9 Estructura del atajo de one sec 6.0 | ⏳ | |

---

## 11. Estado de implementación (2026-09-20)

Fases 1–5 implementadas en esta rama, un commit por fase. Verificado sin dispositivo: `pnpm check` (172 tests), `pnpm build`, 25 invariantes pgTAP en el stack local, compilación de iOS para simulador y `acceptance:ios-shortcuts` contra ese `.app`. **Nada se ha observado en un iPhone físico**; la checklist de 12 puntos está en `docs/ios-shortcuts.md`.

Niveles de setup: H1 y H2 siguen ⏳, así que `IOS_SHORTCUT_IMPORT_URL = ""` y `IOS_SINGLE_AUTOMATION_ENABLED = false`. Todos los usuarios reciben hoy el nivel **C · Por app**, ya sin teclear el nombre y sin atajo de retorno para apps del catálogo.

### Desviaciones respecto a este plan

| Plan | Implementado | Motivo |
|---|---|---|
| `state: "active" \| "removed"` | Se añade `"available"` | Las apps del catálogo no elegidas también se reflejan al intent, para que una app añadida solo en el trigger se adopte con su URL scheme en vez de como desconocida. |
| `resetLocalData()` preserva `targets` | **Los borra** | "Borrar datos locales" es una acción de privacidad; conservar la lista de apps la contradiría. Las automatizaciones que sigan existiendo vuelven a adoptarse solas en la siguiente apertura. |
| `src/state/shortcut-targets.ts` | Lógica pura en `src/lib/shortcut-targets.ts` + provider en `src/state/shortcut-targets.tsx` | La regla del goal exige módulos puros testeables sin React Native. |
| `timed_pause` en `shortcut-intervention.ts` | Mapeo en `intervention-flow.ts` (`gateFromUnlockAction`) | Evita tocar `getInterventionUnlockAction`, que Android sigue usando con `retry_ad`. |
| Flag solo en contratos/migración/admin/pgTAP | Además, el RPC `admin_publish_remote_config` rechaza un payload sin el flag, y el admin gana el checkbox de `iosRestrictionEnabled` que faltaba | Sin ese checkbox iOS no podía activarse nunca desde `/admin`. |
| — | El intent también calla si `restrictionsEnabled` es falso | Da a `iosRestrictionEnabled` efecto real en iOS (kill switch), igual que exige la base de datos al reportar un unlock. |
| Pantalla "Listo" genérica | Ruta `/leave` | Último eslabón de la cadena de salida al Home. |

### Prueba en simulador (2026-09-20)

Se montó y recorrió el flujo en el simulador de iOS 26.0 (receta en `docs/ios-shortcuts.md`). Hallazgos:

- **Los triggers «cuando se abre una app» no disparan en el simulador** (no corre `contextstored`/`coreduetd`). H1 y el disparo real solo son comprobables en un iPhone. Todo lo posterior al disparo se prueba con un atajo normal que ejecuta la misma acción.
- **Bug corregido:** se pasaba `Linking.openURL` como referencia suelta; ese método lee `this` y lanzaba antes de llegar a iOS, así que el retorno a la app fallaba siempre. Venía del código v1. Hay un test que impide reintroducirlo.
- **Bug corregido:** un fallo espurio dejaba el URL scheme de una app desactivado para siempre. Ahora «Probar» lo reintenta y lo restaura si abre.
- **Cambio de convención:** `Still · <App>` → `Still - <App>`. El punto medio (U+00B7) no existe en el teclado estándar de iOS, así que el usuario no podía escribir ese nombre.
- El trigger admite varias apps a la vez (apoya H1) y la acción acepta variables (H6).
- La primera ejecución de un atajo de retorno muestra un aviso de iOS («Allow … to output 1 app?»); el tutorial ya lo explica.
- Se añadió Apple News al catálogo (`applenews://`), útil además porque existe en el simulador.
- Interruptores solo de desarrollo: `EXPO_PUBLIC_DEV_IOS_PAUSES` y `EXPO_PUBLIC_DEV_IOS_HOME_ON_CANCEL`.

### Guía con capturas reales (2026-09-21)

El tutorial dibujado no bastaba: en la prueba real una automatización quedó guardada con «No actions» (faltó añadir la acción de Still). Ahora el nivel «por app» se explica toque a toque con **capturas reales de Atajos** y el control exacto rodeado con un anillo. Cada imagen es un botón; los enlaces verificados en iOS 26.0 son `shortcuts://create-automation` (lista de triggers), `shortcuts://create-shortcut`, `shortcuts://automations` (pestaña Automatización) y `shortcuts://` (reanuda donde se dejó). No existe URL para el interior de la hoja «nueva automatización», así que los pasos intermedios reanudan Atajos en vez de saltar. Detalles y regeneración en `docs/ios-shortcuts.md`.

Siguiente mejora posible, no hecha: un vídeo en Picture-in-Picture que flote sobre Atajos mientras el usuario configura, para no tener que alternar entre apps.

### Pendiente fuera de este trabajo

- Fase 0 completa (H1–H9) y la checklist física de 12 puntos.
- Activar `iosRestrictionEnabled` en producción: hoy está en `false`, así que **iOS no pausa nada en producción** hasta que se publique desde `/admin`.
- Aplicar la migración `202609200001` a producción (no se ha hecho `db push`).
- Unidades de anuncio de iOS reales en el entorno de build (`EXPO_PUBLIC_ADMOB_REWARDED_IOS`).
- Decidir si se retira el entitlement de Family Controls antes del primer archive (ver `store-compliance.md`).

## Fuentes
- one sec — [Setup iOS](https://tutorials.one-sec.app/setup-ios) · [Setup legacy](https://tutorials.one-sec.app/setup-ios-legacy) · [Intentional App Switching](https://tutorials.one-sec.app/en/articles/3310146) · [Custom apps](https://tutorials.one-sec.app/adding-custom-apps) · [Apps sin URL scheme](https://tutorials.one-sec.app/en/articles/3378626) · [Intervention not showing](https://tutorials.one-sec.app/en/articles/3262210) · [Prevent preview](https://tutorials.one-sec.app/en/articles/3312258) · [Prevent deleting automations](https://tutorials.one-sec.app/en/articles/4018306) · [Lock Screen Time permission](https://one-sec.app/blog/lock-screen-time-permission/) · [App Store](https://apps.apple.com/us/app/one-sec-screen-time-focus/id1532875441)
- iOS 27 — [MacStories review, p.13](https://www.macstories.net/stories/ios-and-ipados-27-review/13/) · [WWDC26 What's new in Shortcuts](https://developer.apple.com/videos/play/wwdc2026/310/) · [MacRumors](https://www.macrumors.com/guide/ios-27-shortcuts/) · [Cassinelli](https://matthewcassinelli.com/ios-27-turn-automations-off-on-filters-shortcuts/)
- Apple — [QA1561 salir de la app](https://developer.apple.com/library/archive/qa/qa1561/_index.html) · [ForegroundContinuableIntent](https://developer.apple.com/documentation/appintents/foregroundcontinuableintent)
- AdMob — [Políticas de anuncios con recompensa](https://support.google.com/admob/answer/7313578?hl=en) · [Rewarded interstitial](https://support.google.com/admob/answer/9884467?hl=en)

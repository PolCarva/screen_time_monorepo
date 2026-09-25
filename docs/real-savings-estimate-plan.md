# Tiempo devuelto con tu uso real

Fecha: 2026-09-25 · Rama: `feat/real-savings-estimate` (desde `main` 6f57895) · Estado: plan,
sin implementar.

**Pedido del usuario:** "una vez con acceso a screentime en android y ios, ¿no podemos estimar
mejor las horas que se ahorran en vez de setearlas a 2 min default? realmente hacer un promedio
de uso". Después de ver las opciones, eligió: (1) personalizar solo dentro del teléfono y dejar
el servidor con el valor de config; (2) Android ahora e iOS cuando Apple apruebe Family
Controls, dentro de la extensión; (3) sumar una tarjeta "antes vs. ahora".

Etiquetas de evidencia: **[código]** leído en el repo, **[web]** documentación o fuente
externa, **[hipótesis]** a validar (tabla §9).

---

## 0. Decisiones firmes (no reabrir)

| # | Decisión | Origen |
|---|---|---|
| **D1** | **Solo en el teléfono.** El tiempo personalizado se calcula y se guarda en el teléfono. El servidor y la estadística colectiva siguen con `estimatedMinutesPerAvoidedOpen` de la config activa (hoy 2 min). La subida a `/api/v1/wellbeing/daily` no cambia y nada derivado del uso sale del teléfono. Data safety no cambia. | Usuario, 2026-09-25 |
| **D2** | **Alcance.** Android en `main` ahora. En iOS, el tiempo personalizado solo existe dentro de la extensión de informe de Tiempo en pantalla, en la rama apilada `feat/onboarding-ios-screen-time`, que no se mergea hasta que Apple apruebe Family Controls (Distribution). El iOS de `main` sigue con el valor de config, más la regla de re-entrada (D6). | Usuario, 2026-09-25 |
| **D3** | **Tarjeta "Antes y ahora".** Compara el uso diario de las apps pausadas antes de Still con el de ahora. En Android se basa en la línea de base (D7). En iOS vive dentro de la extensión, en la rama apilada. | Usuario, 2026-09-25 |
| **D4** | **La medida es la sesión típica de cada app,** no el uso diario promedio: cada pausa evitada ahorra una sesión, no un día. La sesión típica es la **mediana** de las sesiones de esa app (no la media, que se deforma con una sesión larga). Hacen falta al menos **5 sesiones** y el valor tiene un **tope de 30 min**. La definición de sesión está en §2.1. | Recomendación aceptada |
| **D5** | **Orden de fuentes por app:** (1) la sesión típica **antes de Still** (línea de base, D7); (2) la de los **últimos 7 días completos más hoy**; (3) el valor de config. La base va primero porque las sesiones con Still activo se cortan cuando vence el acceso elegido (60 s a fin del día, o 5 min tras la pausa gratis) [código] y porque la base es lo que habría pasado sin Still. | Recomendación aceptada |
| **D6** | **Regla de re-entrada.** Si una pausa de una app no termina en entrar, y la persona entra a esa misma app dentro de los **10 min** siguientes a esa pausa, esa pausa no suma minutos. Los conteos "pausas / entraste / no entraste" no cambian; solo cambian los minutos. Rige en iOS y Android. El servidor no cambia (D1). | Recomendación aceptada |
| **D7** | **Línea de base.** Son los días completos **anteriores a la fecha del onboarding** que el teléfono todavía guarda: máximo 7, mínimo 3; con menos no hay base. Se captura en la primera lectura con acceso, sea al terminar el onboarding o al conceder el acceso más tarde, y no se vuelve a capturar. Guarda solo `packageName → {segundos por día, sesiones, mediana}` de las apps con uso. Quien hizo el onboarding antes de esta versión no tiene `onboardedAt` y por lo tanto no tiene base ni tarjeta; usa las fuentes (2) o (3) de D5. | Recomendación aceptada |
| **D8** | **Almacenamiento.** La base y el caché viven en el kv-store de RN (`expo-sqlite/kv-store`, en `files/SQLite`). Android Auto Backup no lo respalda, porque las reglas solo incluyen `sharedpref` [código]. Los minutos por app que necesita la pausa nativa van a `noBackupFilesDir/session-minutes.json`, nunca a SharedPreferences. "Borrar datos locales" limpia todo esto. **Reemplaza D4 del onboarding v2** ("se lee una vez, nunca se guarda"): se actualizan la divulgación y `store-compliance.md`. | Recomendación aceptada |
| **D9** | **Android sin acceso de uso.** Hoy ofrece un link "Calcular con mi uso", no un modal. Lleva a la misma pantalla de divulgación del onboarding (la divulgación destacada que pide Play) y de ahí a Ajustes. Si no se concede, todo sigue con el valor de config. | Recomendación aceptada |
| **D10** | **La tarjeta "Antes y ahora" es honesta.** Es una comparación, no una causa: nunca dice "gracias a Still". Si el uso subió, lo dice igual ("12 min más al día"). Aparece con ≥ 3 días completos después del día del onboarding (ese día no cuenta) y con la base de D7. | Recomendación aceptada |
| **D11** | **Refresco.** Las estadísticas recientes se recalculan cuando Hoy toma foco y el último cálculo tiene más de 6 h o es de otro día. La lectura nativa corre en un hilo aparte. | Recomendación aceptada |
| **D12** | **iOS (rama apilada).** La extensión empareja cada app elegida en Still con la app de Tiempo en pantalla: primero por `bundleId` del catálogo (campo nuevo para las apps populares), si no por nombre normalizado contra `matchKeys`. La sesión típica en iOS es `totalActivityDuration / numberOfPickups` de esa app. Es una aproximación: Apple no da sesiones y "pickup" es "tomar el teléfono y abrir primero esa app" [web]. Mínimo 5 pickups y tope de 30 min; si no, se usa config. | Recomendación aceptada |
| **D13** | **Sin flags remotos nuevos para Android:** la vuelta a la config es automática. iOS sigue detrás de `iosScreenTimeInsightsEnabled`. | Recomendación aceptada |

---

## 1. Qué hay hoy [código]

| Hecho | Dónde |
|---|---|
| Minutos de Hoy = `round(notEntered × config.estimatedMinutesPerAvoidedOpen)`, con `notEntered = max(unlocks, openAttempts) − unlocks` | `apps/mobile/src/lib/today-summary.ts:26-39`, `app/(tabs)/(today)/index.tsx:172-173`, texto en `:329-330` |
| El servidor calcula `max(open_attempts − unlocks, 0) × estimatedMinutesPerAvoidedOpen`; la subida no manda minutos | `supabase/migrations/202609230001_real_impact_stats.sql:322-338`, `apps/web/app/api/v1/wellbeing/daily/route.ts:37-47` |
| La config tiene 0 por defecto y rango 0–60; los 2 min vienen de la config activa en `/admin` | `packages/contracts/src/schemas.ts:15,49` |
| La pausa de Android dice "Hoy no entraste a {app} {n veces}: unos {X} recuperados", con `max(0, app_open_attempts − 1 − app_unlocks) × config`. Solo aparece en la compuerta (con anuncio listo o cargando) | `InterventionActivity.kt:892-928`, `:189-195` |
| Android ya cuenta **por app y por día** en SharedPreferences `still_restrictions`: `app_open_attempts:<día>:<pkg>`, `app_avoided_opens`, `app_unlocks`. No hay registro de eventos con hora; `app_last_pause_at:<pkg>` se pisa en cada pausa | `StillRestrictionModule.kt:780-819`, `StillAccessibilityService.kt:109-125`, `InterventionActivity.kt:495-510,610-630` |
| iOS cuenta por día (`productMetrics:<día>`) y por app (`targetProductMetrics:shortcut:<base64(nombre.lowercased())>:<día>`) en el App Group `group.app.still.ios`. La app se conoce solo por nombre: **no hay bundle ID en ningún lado** | `SharedRestrictionState.swift:22,76-80,446-454,555-557`, `StillShortcutIntent.swift:236,267,312-316,347-351,391-393`, `ios-app-catalog.ts:1-22` |
| La lectura de uso de Android (`getUsageSummary`) existe solo para la historia del onboarding: devuelve segundos por app y por día (top 10) y **no guarda sesiones**. `UsageSessions.summarize` suma intervalos sin duración mínima | `StillUsageInsights.kt:19-29,62-108`, `UsageSessions.kt:36-110`, `StillRestrictionModule.kt:183-219` |
| El onboarding lee el uso una vez, lo tiene en memoria y **no lo guarda** (D4 del onboarding v2). Al terminar solo queda `onboarded` (booleano), sin fecha | `onboarding-flow.tsx:119,180-196,424-425`, `app-state.tsx:340,361` |
| La divulgación de acceso de uso dice: "Con el acceso de uso, Still cuenta cuánto usas cada app. Se calcula en este teléfono y no sale de aquí." | `components/onboarding/usage-steps.tsx:74-75` |
| `native-config.test.ts`: `UsageStatsManager` solo en `StillUsageInsights.kt` y nunca en el módulo, la pausa o el servicio; `StillUsageInsights.kt` no puede contener `SharedPreferences` ni red (vale hasta en comentarios) | `src/native/native-config.test.ts:36-38,86-96` |
| Después de entrar, Still corta la sesión cuando vence el acceso: vuelve a mostrar la pausa o manda a Inicio | `StillAccessibilityService.kt:221-316` |
| La extensión de la rama apilada (`8b9e6d5`) lee `onboarding.guessMinutes` del App Group; agrega `totalActivityDuration` por día y por app (clave `bundleIdentifier ?? localizedDisplayName`); los pickups los suma solo por día | `git show feat/onboarding-ios-screen-time:apps/mobile/ios/StillScreenTimeReport/StillScreenTimeReport.swift` `:45-109` |
| AOSP borra los archivos diarios de uso (que incluyen los eventos) a los **10 días** | [web] `UsageStatsDatabase.prune`, `mCal.addDays(-10)` (android14-release) |

---

## 2. Cómo se calcula

### 2.1 Sesión (Android)

Se parte de los mismos intervalos que `UsageSessions.summarize`: una app está al frente desde que
su primera actividad vuelve hasta que la última se pausa; pantalla apagada, bloqueo o apagado
cierran todo. Sobre esos intervalos:

1. **Unir:** dos intervalos seguidos de la misma app con menos de **30 s** entre uno y otro son
   una sola sesión. Así se juntan el "intento" de medio segundo que la pausa de Still deja antes
   de entrar y la sesión real, o una hoja de compartir.
2. **Descartar:** una sesión de menos de **5 s** no cuenta. Así se descarta el intento que queda
   cuando la persona elige "Volver" (**HA-S1**).
3. **Día:** una sesión pertenece al día local en que empieza. No se parte a medianoche para
   contar sesiones; los segundos por día sí se siguen partiendo como hoy.
4. **Excluir** lo mismo que hoy: Still, `systemui`, Ajustes, launchers y paquetes sin ícono de
   inicio (`StillUsageInsights.kt:91-97`).

### 2.2 Sesión típica y fuente (D4, D5)

Para cada app elegida en Still:

```
sesionTipica(app) =
  base[app]        si la base existe y base[app].sesiones ≥ 5    → fuente "before"
  reciente[app]    si hay acceso y reciente[app].sesiones ≥ 5    → fuente "recent"
  config           en cualquier otro caso                        → fuente "default"
minutos = min(mediana en minutos, 30)      (config no se toca: ya tiene tope 60)
```

`reciente` = los últimos 7 días completos más hoy. Con acceso revocado, la base guardada sigue
sirviendo; `reciente` no existe.

### 2.3 Re-entrada (D6)

Cada app guarda un rastro de su última pausa contada: `{at, entered, followsSkip}`.

- **Nueva pausa contada** de la app en `t`: si el rastro existe, no terminó en entrar y
  `t − at ≤ 10 min`, la nueva pausa sigue a otra saltada (`followsSkip = true`). Después el rastro
  pasa a `{at: t, entered: false, followsSkip}`.
- **Entrar** a esa app: `entered = true`. Si `followsSkip`, suma 1 a `reentries` del día (total y
  por app).

Las pausas que no se cuentan (dentro de un acceso, duplicadas en 1,2 s en Android o 30 s en iOS,
de prueba) no tocan el rastro.

### 2.4 Tiempo devuelto de hoy

```
noEntradasEfectivas(app) = max(0, openAttempts − unlocks − reentries)     por app, hoy
minutosHoy = Σ_apps elegidas  noEntradasEfectivas(app) × minutos(app)
           + resto × config
resto = max(0, efectivasTotales − Σ efectivas de las apps elegidas)
```

`resto` cubre las apps que ya no están elegidas pero se pausaron hoy. En el iOS de `main` todas
las apps usan config, así que queda `max(0, notEntered − reentries) × config`.

**Ejemplo:** Instagram tenía mediana de 7 min antes de Still. Hoy tuvo 5 pausas, 1 entrada y 1
re-entrada: 5 − 1 − 1 = 3, y 3 × 7 = **21 min**. Con el valor fijo daban 4 × 2 = 8 min.

### 2.5 Antes y ahora (D3, D10)

- **Apps:** las que están elegidas hoy. Una app que no está en la base cuenta 0 antes.
- **Antes:** `Σ base[app].segundosPromedioPorDía`, sobre los días de la base.
- **Ahora:** promedio diario de esas apps en los días completos después del día del onboarding,
  los últimos 7 como máximo.
- **Se muestra** si la base existe, hay acceso ahora y hay ≥ 3 días completos en "ahora".

---

## 3. Android

### 3.1 Nativo

- **`UsageSessions.kt`** (Kotlin puro): separar el productor de intervalos que hoy vive dentro de
  `summarize`, para que `summarize` y la función nueva lo compartan, y agregar:
  - `sessions(events, zone, nowMillis, excluded): List<Session(packageName, startMillis, endMillis)>`,
    con las reglas de §2.1 (constantes `MERGE_GAP_MILLIS = 30_000`, `MIN_SESSION_MILLIS = 5_000`);
  - `appStats(sessions, days, zone): Map<pkg, AppStats(sessions, medianSeconds, secondsByDay)>`.
- **`UsageSessionsTest.kt`**: casos nuevos para el intento de 0,5 s que se descarta; intento +
  30 s de pausa + sesión que quedan en una sola sesión; brecha de 40 s que las deja en dos;
  pantalla apagada que corta; sesión que cruza medianoche y cuenta el día de inicio; mediana par
  e impar; los 8 tests actuales siguen pasando.
- **`StillUsageInsights.readUsageStats(context, fromDate, toDateExclusive?)`**: `queryEvents`
  desde las 00:00 de `fromDate` hasta el final de `toDateExclusive` o ahora. Devuelve
  `{firstEventAt, days: [{date, complete}], apps: [{packageName, sessions, medianSeconds, seconds[]}]}`
  para **todas** las apps con uso, no un top. `firstEventAt` dice desde qué día hay datos: los
  días anteriores no están disponibles, que no es lo mismo que "cero".
- **`StillRestrictionModule.getUsageStats(from, toExclusive)`**: mismo patrón que
  `getUsageSummary` (hilo aparte, `usage_access_denied`, `usage_read_failed`).
  `getUsageSummary` queda como está para la historia.
- **`syncSessionMinutes(map: {pkg: minutes})`** en el módulo: escribe
  `noBackupFilesDir/session-minutes.json` (D8). `InterventionActivity.impactSummary` lee
  `map[pkg] ?: config` y resta `app_reentries` (§2.4). `resetLocalData` borra el archivo.
- **Re-entrada** (§2.3):
  - rastro en `still_restrictions` con la clave `pause_trail:<pkg>` (JSON), escrito donde hoy
    sube `app_open_attempts` (`StillAccessibilityService.kt:109-125`);
  - la entrada se marca en `enterTarget` (`InterventionActivity.kt:495-510`), que sube
    `reentries:<día>` y `app_reentries:<día>:<pkg>`.

  Son contadores de Still, no datos de uso, así que pueden vivir en SharedPreferences.
- **Exponer** `reentries` en `getLocalWellbeing` (hoy e historial) y `reentriesToday` en
  `getSelectedAppsState`.
- **`native-config.test.ts`**: sumar que `getUsageStats` exista y que `session-minutes.json` use
  `noBackupFilesDir`, y mantener las reglas actuales. Ojo con los comentarios que digan
  "SharedPreferences" en `StillUsageInsights.kt`.

### 3.2 RN

- **`src/lib/saved-time.ts`** (puro, con tests):
  - `typicalMinutes(app, {baseline, recent, configMinutes})` → `{minutes, source}`
  - `effectiveNotEntered({openAttempts, unlocks, reentries})`
  - `returnedMinutesToday(perApp, totals, minutesByApp, configMinutes)`
  - `compareBeforeNow(baseline, recent, selected, onboardedAt, today)` → `null` si no se cumplen
    las condiciones de §2.5
  - esquemas zod `usageBaselineSchema` y `recentUsageSchema` (`version: 1`)
- **`src/state/saved-time-store.ts`**: claves del kv-store `usageBaseline`, `recentUsage` (con
  `computedAt`) y `onboardedAt` (ISO), con el mismo patrón que `state/onboarding-progress.ts`
  (`getJson`, `safeParse`, `null` si no valida).
- **`onboardedAt`**: `finish()` lo escribe cuando `mode === "onboarding"`
  (`onboarding-flow.tsx:424`), antes de `setOnboarded(true)`.
- **Captura de la base** (D7), una vez:
  - cuándo: al terminar el onboarding con acceso, o en el primer refresco con acceso si no hay
    base y sí hay `onboardedAt`;
  - rango: `getUsageStats(onboardedAt − 10 días, onboardedAt)`;
  - se queda con los días completos anteriores al día del onboarding que tienen datos
    (`≥ firstEventAt`): máximo 7, mínimo 3.
- **Refresco** (D11): en el foco de Hoy, `getUsageStats(hoy − 7, null)` → `recentUsage` →
  `syncSessionMinutes` para las apps elegidas.
- **Tipos:** `restriction-engine.ts` suma `getUsageStats?`, `syncSessionMinutes?` y `reentries`
  en los tipos de métricas; el stub devuelve vacío.

---

## 4. iOS en `main`

Solo la regla de re-entrada, para que la fórmula sea la misma en las dos plataformas:

- `DailyProductMetrics` suma `reentries`. Se decodifica con `decodeIfPresent`, con 0 por defecto,
  porque los JSON guardados no lo tienen.
- Rastro por app en el App Group, clave `shortcutIntervention.pauseTrail` =
  `[targetKey: {at, entered, followsSkip}]`:
  - se escribe en `ShortcutInterventionState.prepare` solo cuando la pausa se cuenta
    (`StillShortcutIntent.swift:267`);
  - se marca en `complete()` (`:312-316`), que sube `reentries` total y por app.
- `getLocalWellbeing` (`StillRestrictionEngine.swift:425-445`) devuelve `reentries`.
- Hoy en iOS: `max(0, notEntered − reentries) × config`.

---

## 5. iOS con Family Controls (rama apilada `feat/onboarding-ios-screen-time`, no mergear)

Primero mergear `main` en la rama apilada. Si hay conflictos de entitlements, gana `main`: hoy
trae avisos urgentes activos.

- **Catálogo:** campo opcional `bundleId` en `IOS_APP_CATALOG` para las 10 apps de
  `POPULAR_APP_IDS` (`ios-app-picker.ts:8-19`). Cada valor se verifica con
  `https://itunes.apple.com/lookup?id=<id de App Store>`, que devuelve `bundleId` [web]; no se
  escriben de memoria. Se sincroniza en `toNativeTargets` y en `ShortcutTarget` de Swift.
- **App Group:**
  - `stillOnboardedAt`, escrito por un setter nativo nuevo al terminar el onboarding;
  - ya existen `shortcutIntervention.targets`, `targetProductMetrics:shortcut:<b64>:<día>` (la
    extensión repite exactamente `base64(nombre.lowercased())`, no `normalize()`) y
    `estimatedMinutesPerAvoidedOpen`.
- **Extensión, dos contextos nuevos:**
  - `still.today.returned`:
    - dibuja el número de minutos de hoy y, por app, "~X min por sesión";
    - con la sesión típica de D12, sobre los 7 días antes de `stillOnboardedAt` si hay datos
      (**HI-S2**) y si no sobre los últimos 7 días completos;
    - multiplicada por las no entradas efectivas de hoy leídas del App Group (**HI-S1**).
  - `still.today.compare`: la tarjeta de §2.5, con la misma tipografía y los mismos colores que
    los contextos del onboarding.
- **Intervalo del filtro** (`StillActivityReportView.swift`):
  - para `still.today.*`: desde `min(onboardedAt − 7 d, hoy − 14 d)` hasta ahora, con segmentos
    diarios;
  - la extensión separa "antes" y "ahora" por fecha.
- **RN:** con flag e informe disponibles, Hoy reemplaza el número de minutos por
  `still.today.returned` (alto fijo) y agrega `still.today.compare`. Los conteos siguen en RN.
- **Si HI-S1 falla:** iOS se queda con config y sin tarjeta, y se anota en resultados.

---

## 6. Pantallas y textos

Todo con `localize()` en español e inglés y con la voz de `docs/brand/04-voice-and-tone.md`. La
app tutea ("usas"), no vosea.

**Hoy: explicación** (reemplaza `index.tsx:329-330`)

| Caso | Español | English |
|---|---|---|
| Alguna app con fuente `before` o `recent` | "No entraste {n veces}. Cada una cuenta lo que suele durar tu sesión en esa app." | "You didn't go in {n times}. Each one counts what your session in that app usually lasts." |
| Todo con `default` | "No entraste {n veces}. Estimamos {x} min por cada una." (como hoy) | "You didn't go in {n times}. We estimate {x} min for each." |
| `reentries > 0` (se agrega) | "Si volviste a entrar enseguida, esa vez no suma." | "If you went back in right away, that one doesn't count." |
| Android sin acceso (link) | "Calcular con mi uso" | "Use my real usage" |

**Hoy: detalle** ("Cómo lo calculamos", hoja como las de ui-clarity)

- Una fila por app con pausas hoy: "{App} · {k} veces · ~{m} min cada una · {total}".
- La fuente de cada fila: "antes de Still" / "últimos 7 días" / "estimado" (EN: "before Still" /
  "last 7 days" / "estimated").

**Tarjeta "Antes y ahora" / "Before and now"**

- "Antes de Still: {X} al día" · "Ahora: {Y} al día".
- La diferencia: "{Δ} menos al día" o "{Δ} más al día".
- Hasta 3 filas por app, ordenadas por tiempo antes.
- Nota al pie: "Apps que pausas. Antes: los {n} días previos a Still. Ahora: los últimos {m}
  días. Medido en este teléfono."
- EN: "Before Still: {X} a day" · "Now: {Y} a day" · "{Δ} less a day" / "{Δ} more a day" ·
  "Apps you pause. Before: the {n} days before Still. Now: the last {m} days. Measured on this
  phone."

**Divulgación de acceso de uso** (`usage-steps.tsx:74-75`, también la usa la ruta de D9)

- ES: "Con el acceso de uso, Still cuenta cuánto usas cada app, para mostrarte tu tiempo y
  estimar el que recuperas. Se calcula y se guarda en este teléfono, y no sale de aquí."
- EN: "With usage access, Still counts how much you use each app, to show you your time and
  estimate the time you get back. It's worked out and kept on this phone, and never leaves it."

**Pausa de Android:** el texto queda igual y el número cambia a §2.4 para esa app (minutos de
`session-minutes.json`, menos las re-entradas). Si el resultado es 0, no se muestra (hoy puede
decir "0 min").

**Impacto** (colectivo): no cambia (D1).

---

## 7. Privacidad y tiendas

- **Play Data safety:** no cambia. Nada sale del teléfono, y la analítica no recibe nombres de
  app ni minutos: no hay eventos nuevos.
- **Divulgación destacada:** el texto nuevo de §6 dice para qué se usa y que se guarda en el
  teléfono. La ruta de D9 la muestra antes de mandar a Ajustes.
- **`docs/store-compliance.md:39`:** reescribir. El acceso se pide en el onboarding o desde Hoy;
  sirve para la historia y para estimar el tiempo devuelto; se guarda solo en el teléfono (fuera
  de Auto Backup); no se manda.
- **`docs/onboarding-v2-plan.md`:** nota en D4, "Reemplazada por real-savings-estimate-plan.md
  D8". Actualizar también el comentario de `StillUsageInsights.kt:19-24` y el de
  `onboarding-flow.tsx:119`.
- **Apple:** la extensión no puede sacar datos (sandbox) [web]. Nada cambia en la ficha, más
  allá de lo que ya prepara la rama apilada.

---

## 8. Casos borde

- **Acceso revocado:** la base guardada sigue dando minutos; sin `recent`, la tarjeta se oculta.
- **App elegida después y ausente de la base:** usa `recent` o config.
- **Teléfono con pocos días** (arranque en frío, fabricante que guarda menos): base con 3 a 6
  días y la nota dice {n}; con menos de 3, no hay base.
- **"Borrar datos locales":** limpia la base, `onboardedAt`, `recentUsage` y
  `session-minutes.json`. El onboarding siguiente captura una base nueva con días que ya tuvieron
  Still. Se acepta: es una acción rara; se anota.
- **`/setup`** no recaptura la base ni pisa `onboardedAt`.
- **Pantalla dividida o PiP:** dos apps al frente cuentan las dos, como hoy.
- **Re-entrada que cruza medianoche:** cuenta en el día de la entrada.
- **Mediana mayor a 30 min:** tope. **Mediana muy chica** (WhatsApp): se usa tal cual; es
  honesto.
- **Semana con viaje o enfermedad:** la tarjeta lo muestra tal cual; la nota dice qué días
  compara.

---

## 9. Hipótesis

| # | Hipótesis | Fase | Si falla |
|---|---|---|---|
| HA-S1 | El intento que deja la pausa ("Volver") dura menos de 5 s en los eventos de la app | S1, AVD | Descartar el intervalo si el siguiente `RESUMED` es la pausa de Still en ≤ 1 s (leer los eventos de Still antes de excluirlos) |
| HA-S2 | El teléfono guarda ≥ 7 días de eventos (= HA6 del onboarding v2; AOSP: 10) | S3, Xiaomi (usuario) | La base usa los días que haya (≥ 3); si no, no hay base |
| HA-S3 | `queryEvents` de 10 días tarda < 1,5 s en un teléfono medio | S1, AVD + Xiaomi | Cachear `recentUsage` por día y leer solo desde el último cálculo |
| HA-S4 | Las medianas de apps sociales dan entre 0,5 y 30 min | S3, Xiaomi (usuario) | Revisar las reglas de §2.1 con los eventos reales antes de publicar |
| HI-S1 | La extensión de informe puede **leer** el App Group (= HI1) | S7, iPhone (usuario) | iOS sigue con config y sin tarjeta |
| HI-S2 | Tiempo en pantalla devuelve datos de 7 días antes del onboarding durante unas semanas | S7, iPhone | La sesión típica usa los últimos 7 días; la tarjeta se oculta cuando ya no hay "antes" |
| HI-S3 | `bundleIdentifier` o `localizedDisplayName` vienen con valor en la extensión y emparejan con las apps elegidas | S7, iPhone | Las apps sin pareja usan config |
| HI-S4 | `numberOfPickups` por app da ≥ 5 en una semana normal | S7, iPhone | Config para esa app |

---

## 10. Fases, gates y `/goal`

Una fase = un commit (mensaje en español, con el Co-Authored-By del repo). Gates:

- **Siempre:** `pnpm check`.
- **Kotlin:** `./gradlew :app:testDebugUnitTest` desde `apps/mobile/android` (con `ANDROID_HOME`)
  y `pnpm --filter mobile acceptance:shield` en el AVD `Still_QA_API_36`.
- **Swift:** build del simulador "Still QA" con `DEVELOPMENT_TEAM=JZ9HBXGNK9` en la línea de
  comandos (el pbxproj no se toca) y `pnpm --filter mobile acceptance:ios-shortcuts`.

**QA en el AVD:**
- Para resetear, borrar solo los datos de Still (`files/SQLite/ExpoSQLiteStorage*` y
  `still_restrictions.xml`); no usar `pm clear`, que trae de vuelta el menú del dev client.
- Mover el botón flotante del dev client, que tapa "Saltar".
- Usar `com.google.android.deskclock` y `com.google.android.contacts` como apps de prueba.
- Generar uso con `adb shell monkey -p <pkg> 1` y comparar con `dumpsys usagestats`.

| Fase | Contenido | Terminado cuando |
|---|---|---|
| **S1** | Android: sesiones y estadísticas (§3.1 sin re-entrada ni `syncSessionMinutes`), `getUsageStats`, tipos TS, `native-config.test.ts`. HA-S1, HA-S3. | JUnit cubre §2.1. En el AVD, las sesiones de una app de prueba coinciden con `dumpsys usagestats`. Una pausa + "Volver" no deja ninguna sesión. |
| **S2** | Re-entrada en Android y en iOS `main` (§2.3, §3.1, §4), `effectiveNotEntered` y fórmula de Hoy. | `acceptance:shield` cubre "Volver" y luego entrar antes de 10 min = 1 re-entrada. El build de iOS y `acceptance:ios-shortcuts` pasan. Tests de TS pasan. |
| **S3** | `saved-time.ts` y el store, `onboardedAt`, captura de la base, refresco, `syncSessionMinutes` y su lectura en la pausa. | Tests de TS de §2. En el AVD, después del onboarding con acceso, el kv-store tiene la base (inspeccionada) y `session-minutes.json` existe en `no_backup`. |
| **S4** | Hoy: explicación, detalle, link de D9 y ruta de divulgación; texto nuevo de divulgación; número de la pausa de Android. | Capturas en ES/EN de las tres fuentes y de la pausa en `docs/real-savings/`. |
| **S5** | Tarjeta "Antes y ahora" en Android. | Capturas con la base sembrada solo en el test o dev (subida y bajada). Oculta sin base o con menos de 3 días. |
| **S6** | Documentación: §7, nota en onboarding v2 D4, resultados en §12 de este plan. | `pnpm check`; §12 completo. |
| **S7** | Rama apilada: mergear `main`, §5 completo. **No se mergea.** | Compila en el simulador con firma de desarrollo; con el flag apagado, iOS se comporta igual que `main`; checklist para el iPhone en §13. |

### Prompt para `/goal`

```
/goal Implementar el tiempo devuelto con uso real siguiendo docs/real-savings-estimate-plan.md
en la rama feat/real-savings-estimate (worktree aparte si otra sesión usa el checkout). Las
decisiones D1–D13 están cerradas: no reabrirlas ni re-investigar lo que el plan ya resolvió.
Ejecutar S1→S6 en orden, un commit por fase, con los gates de §10 en cada una (pnpm check; en
Kotlin ./gradlew :app:testDebugUnitTest y acceptance:shield en el AVD Still_QA_API_36; en Swift
build firmado del simulador "Still QA" y acceptance:ios-shortcuts). Validar cada hipótesis de §9
en su fase y, si falla, aplicar su salida y anotarla en §12. S7 va en la rama apilada
feat/onboarding-ios-screen-time (mergear main primero) y no se mergea. Nada derivado del uso sale
del teléfono ni va a analítica; el servidor y la subida no cambian. Todo texto visible en inglés
y español con localize(), con la voz de docs/brand/04-voice-and-tone.md. Al terminar, completar
§12 con commits, hipótesis, desvíos y capturas en docs/real-savings/, y dejar en §13 lo que solo
puede hacer el usuario. No pushear ni mergear sin pedido explícito.
```

---

## 11. Fuentes

- Apple, DeviceActivity: `ApplicationActivity.numberOfPickups` ("the number of pickups made
  directly to the application"), `totalActivityDuration`, `DeviceActivityReportExtension`:
  https://developer.apple.com/documentation/deviceactivity/deviceactivitydata/applicationactivity
- Sandbox del informe (no puede mandar ni escribir datos fuera de la extensión):
  https://developer.apple.com/forums/thread/817516 · https://developer.apple.com/forums/thread/818174
- Android, `UsageStatsManager.queryEvents` ("events are only kept by the system for a few
  days"): https://developer.android.com/reference/android/app/usage/UsageStatsManager
- AOSP, retención de 10 días de los archivos diarios (`UsageStatsDatabase.prune`):
  https://github.com/aosp-mirror/platform_frameworks_base/blob/android14-release/services/usage/java/com/android/server/usage/UsageStatsDatabase.java
- Play, divulgación destacada y datos de usuario:
  https://support.google.com/googleplay/android-developer/answer/11150561
- App Store Lookup API (bundle ID por id de App Store): https://itunes.apple.com/lookup?id=389801252

---

## 12. Resultados de la implementación

_(Se completa al implementar: commits, hipótesis, desvíos, bugs, verificación, capturas.)_

---

## 13. Lo que solo puede hacer el usuario

1. **Xiaomi (Android 16/MIUI):**
   - build nuevo;
   - onboarding completo con acceso de uso;
   - revisar HA-S2 (cuántos días de base quedaron) y HA-S4 (comparar la sesión típica de tus
     apps con lo que sientes y con Bienestar digital);
   - a los 3 días, ver la tarjeta "Antes y ahora".
2. **Apple:** pedir Family Controls (Distribution) para `app.still.ios` y
   `app.still.ios.ScreenTimeReport` (onboarding v2 §15.5), si no está pedido.
3. **iPhone:** build de desarrollo de la rama apilada con `EXPO_PUBLIC_DEV_IOS_SCREEN_TIME=1` para
   HI-S1 a HI-S4.
4. **Publicar:** es decisión tuya (build de Play; iOS `main` solo cambia la re-entrada).

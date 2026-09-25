# Pausa solo con anuncio: sin pases guardados ni topes

Rama: `fix/ads-wait-before-pause` (worktree `../screen_time-ads-fix`). Escrito el
2026-09-24 a partir de dos pedidos del usuario:

1. En producción la pausa muchas veces muestra "Respira" en vez del anuncio, y a
   veces "Respira" y **después** "Ver anuncio". Regla pedida: *o muestra el
   anuncio o espera*; nunca respirar y luego ofrecer el anuncio. En iOS nunca
   aparece el anuncio.
2. "Quitemos el tope de anuncios, que el usuario vea tantos como quiera", "quita
   también *Pases diarios*" y "ya no existen los pases: solo el anuncio y el
   breath si el anuncio no carga. Quita el poder guardar pases".

## 1. Qué había (medido el 2026-09-24)

| Hecho | Evidencia |
|---|---|
| **iOS: AdMob no sirve ningún anuncio.** 24 pedidos (23 y 24/9), 0 servidos | Informe de red de AdMob (API), unidad `Unlock Token` iOS |
| Android: AdMob sirve todo (17/17 pedidos) pero solo se mostraron 8 | mismo informe, 24/9 |
| Las dos apps de AdMob están en `ACTION_REQUIRED`: sin vincular a una tienda (`manualAppInfo`), así que tienen "servicio de anuncios limitado" hasta pasar la revisión de preparación de AdMob | `accounts.apps.list`; [About app readiness](https://support.google.com/admob/answer/10564477) |
| El código de iOS llega a pedir el anuncio: build 0.2.0 creó 7 intents hoy, ninguno se reclamó | `reward_intents` por plataforma |
| Android decidía la pausa al abrirse el escudo: si el anuncio no había terminado de cargar (1–3 s con anuncios reales) mostraba "Respira"; al reabrir, ya cargado, "Ver anuncio" | `InterventionActivity.currentGate()` leía `isAdReady()` una sola vez |
| El anuncio cargado se descartaba a los 55 min sin recargar: la primera pausa después de una hora sin pausas siempre respiraba | `StillRewardedAdManager.isAdReady()` |
| Si una carga fallaba no había nuevo intento hasta la próxima pausa | `StillRewardedAdManager.preload()` |
| En iOS, una pausa abierta sobre un intento fallido (reintento cada 30 s) respiraba sin probar de nuevo | `RewardAdProvider` + `getInterventionOptions` |
| Topes que apagan el anuncio: `maxRewardedAdsPerUtcDay` (config 10; preferencia por usuario 0–30), `daily_pass_limit` (1–20, por defecto 3) y billetera llena (`maxRewardTokenBalance` 3) | `create_reward_intent`, `claim_reward_intent`, `create_unlock_session`, `syncRewardConfig` |
| Un tester Android tiene `daily_pass_limit = 1` y `max_rewarded_ads = 2` y ya usó 3 hoy: para él el anuncio no aparece por diseño | `user_preferences`, `unlock_sessions` |
| Al llegar a un tope, el nativo de Android queda con "anuncios no elegibles" hasta que se abre Still, aunque haya pasado la medianoche UTC | `KEY_ADS_ELIGIBLE` solo lo escribe React Native |
| El escudo de Screen Time de iOS (`StillShieldAction`, "recargar" → pestaña Pases → `unlock-ready`) es código heredado: el build no tiene el permiso `family-controls`; iOS usa solo Atajos | `ios/Still/Still.entitlements`, `enableShortcutMode()` |

## 2. Ya hecho en la rama (commit `40c9a8b`)

- Android: `StillRewardedAdManager` expone `AdState` (`READY`/`LOADING`/`NONE`) y
  `awaitLoad()`, carga en el acto cuando se llama desde el hilo principal y
  recarga el anuncio vencido en cuanto se consulta. `InterventionActivity`
  muestra "Preparando el anuncio…" hasta 12 s (igual que `REWARD_AD_LOAD_TIMEOUT_MS`)
  y recién después decide: anuncio o respirar. Una respiración empezada se
  guarda por app (`shield_pause_started_at:<pkg>`) y, si el escudo se vuelve a
  abrir antes de 75 s, se retoma (o pasa a su decisión) en vez de ofrecer el
  anuncio que llegó mientras tanto.
- iOS: `rewardStatusForGate()` + efecto en `ShortcutIntervention`: si la pausa
  abre sobre un intento fallido, pide uno nuevo y lo trata como "preparando".
- Tests: `shortcut-intervention.test.ts` (3 nuevos), `native-config.test.ts`
  actualizado. `vitest` 205/205, `tsc` y `:app:compileDebugKotlin` OK.

## 3. Decisiones (cerradas, no reabrir)

| # | Decisión |
|---|---|
| D1 | **La pausa ofrece solo el anuncio.** Pantalla: "Volver" (principal) y "Ver anuncio"; mientras carga, "Preparando el anuncio…" (hasta 12 s). Sin anuncio (no carga, sin conexión, anuncios apagados) queda la respiración de 15 s → 5 min. Una respiración empezada nunca se cambia por el anuncio (§2). **Cambio 2026-09-25 (usuario):** tras la respiración también se elige la duración con el mismo slider que tras el anuncio; ya no hay ventana fija de 5 min. |
| D2 | **No existen los pases.** No se guardan, no se usan, no se muestran. Ver el anuncio y no entrar no guarda nada. Se borra "Usar 1 pase de emergencia", la pestaña Pases y todo lo que proyecta una billetera local. |
| D3 | **Sin tope de anuncios**: fuera `maxRewardedAdsPerUtcDay` y la preferencia `max_rewarded_ads_per_utc_day` del servidor y de la app. Si algún día hace falta, se usa el tope de frecuencia de AdMob. |
| D4 | **Sin "Pases diarios"**: fuera `daily_pass_limit` del servidor y de Ajustes. |
| D5 | **Sin tope de billetera**: `create_reward_intent` y `claim_reward_intent` dejan de mirar `maxRewardTokenBalance`. Se mantienen: proveedor `admob`, dispositivo del usuario, pausa habilitada en `create_unlock_session` y el máximo de **5 intents pendientes** (antiabuso, D10 del plan anterior). |
| D6 | El libro (`token_ledger`) sigue como auditoría: reclamar el anuncio suma 1 y la entrada que nombra ese anuncio resta 1. **Nada gasta un saldo**: `create_unlock_session` sin `p_reward_intent_id` responde siempre `insufficient_rewarded_balance` (mismo código que ya conocen los builds viejos). Los saldos guardados existentes se pierden; no se convierten. |
| D7 | **Compatibilidad** (§4): `/wallet`, `/config` y `/preferences` mantienen su forma para los builds publicados, con valores que los dejan en "anuncios sin tope, sin pases". La migración no borra columnas ni claves de config. |
| D8 | Elegibilidad del anuncio en la app nueva = pausa habilitada (`isPauseFeatureEnabled`) **y** `config.rewardProvider === "admob"` (más onboarding y dispositivo). Deja de depender de `/wallet`; `canRequestReward` pasa a mirar solo la config. Android sincroniza esa misma elegibilidad (desaparece el problema del día UTC). |
| D9 | La app nueva **deja de usar `/wallet`**: se borran `wallet`, `walletHydrated`, `addProvisionalToken`, `addProvisionalReward`, `spendLocalWallet`, `projectPendingUnlocks` y el caché `wallet`. `_layout.tsx` espera otra señal de hidratación (config/estado listo). Los puentes nativos no cambian de firma: `syncWallet(0, <próxima medianoche UTC>, …)`. |
| D10 | Pestañas: **Hoy, Impacto, Ajustes**. Las rutas heredadas `recharge` y `unlock-ready`, y `openRecharge`/`checkPendingRecharge` de `_layout.tsx`, redirigen a Hoy. Las extensiones de Screen Time de iOS no se tocan (no están activas). |
| D11 | Ajustes: se borra la sección "02 / LÍMITES DE PASES" (Pases diarios, Máximo de anuncios, Guardar). La app nueva no llama `PUT /preferences` por esos campos; renumerar secciones. |
| D12 | `/admin`: el formulario de config deja de mostrar `maxRewardTokenBalance` y `maxRewardedAdsPerUtcDay`; los reenvía con el valor activo para que los builds viejos sigan parseando la config. |
| D13 | Textos: nada promete ni menciona pases. Base común: "Si no hay anuncio disponible, una pausa breve te deja entrar igual." (§5, fase 4). |

## 4. Compatibilidad con lo ya publicado

Publicados: APK Android 0.2.0 vc14 (landing), Play prueba cerrada vc4 (0.2.0, en
revisión), iOS 0.2.0 build 6 (en revisión de App Review).

| Endpoint | Qué responde desde la migración | Efecto en builds viejos |
|---|---|---|
| `GET /api/v1/wallet` | `rewardedBalance: 0`, `rewardedPassesRemainingToday: 20`, `rewardAdsRemainingToday: 30`, `unresolvedRewardClaims` real, `resetAt` | Nunca ofrecen pase (saldo 0); el anuncio sigue elegible (`canRequestReward` viejo: 0 < 3 y 30 > 0; Android: pases del día > 0) |
| `GET /api/v1/config` | Igual; `maxRewardTokenBalance` y `maxRewardedAdsPerUtcDay` siguen en el payload (no se aplican) | El esquema viejo sigue validando |
| `GET/PUT /api/v1/preferences` | Sigue aceptando y devolviendo `dailyPassLimit` y `maxRewardedAdsPerUtcDay`; el servidor los ignora | El Ajustes viejo guarda sin error |
| `POST /rewards/intents`, `/claim` | Sin topes de día ni billetera | Anuncios sin límite |
| `POST /unlock-sessions` | Con intent: OK. Sin intent: `insufficient_rewarded_balance` | Un build viejo que vea el anuncio y se vaya se proyecta un pase local; si lo usa, el servidor lo rechaza y el build muestra su aviso de error. Aceptado: son testers, se les pide actualizar |

La pestaña Pases de los builds viejos seguirá mostrando "0 / 3" y "Conseguir 1
pase"; ese anuncio se cobra pero no deja nada usable. Aceptado por la misma razón.

## 5. Fases

Cada fase termina con sus tests en verde y un commit en la rama. No hacer push
ni aplicar migraciones en prod (§6).

### Fase 1 — Base de datos y API

- Nueva migración `supabase/migrations/202609240001_ads_only_pause.sql`
  (`create or replace`, mismas firmas y grants):
  - `create_reward_intent(uuid, uuid, uuid, text, text, timestamptz, text)`: la
    versión de `202609230001_real_impact_stats.sql` sin `max_balance`,
    `max_daily`/`preferred_max_daily`/`daily_count` ni sus `raise`.
  - `claim_reward_intent(uuid, uuid, uuid, timestamptz)`: la de
    `202608230005_…` sin `wallet_balance_cap_reached` ni `daily_reward_limit_reached`.
  - `create_unlock_session(… 8 args)`: la de `202609230001_…` sin
    `daily_pass_limit`/`rewarded_used`; la rama sin intent solo hace
    `raise exception 'insufficient_rewarded_balance'`.
  - Revisar si `record_verified_ad_view` o `reconcile_stale_reward_intents`
    aplican algún tope; si lo hacen, quitarlo igual.
- `supabase/tests/*.sql`: reemplazar las aserciones de topes por: 12 intents +
  claims en el mismo día pasan; `wallet_balance_cap_reached` y
  `daily_reward_limit_reached` ya no ocurren; entrar sin intent falla con
  `insufficient_rewarded_balance` aunque haya saldo; entrar con el intent de un
  anuncio reclamado pasa sin límite diario. Probar contra prod con el arnés de
  `begin/rollback` (`supabase db query --linked`), no con Docker.
- `apps/web/app/api/v1/wallet/route.ts`: valores de §4 (dejar de consultar
  saldo/conteos que ya no se usan, salvo `unresolvedRewardClaims`).
- `apps/web/app/api/v1/rewards/intents/route.ts`, `[id]/claim/route.ts`,
  `unlock-sessions/route.ts`, `webhooks/admob/rewarded/route.ts`: dejar el
  mapeo de los códigos viejos solo donde un build viejo o una fila vieja puedan
  producirlos; quitar `daily_pass_limit_reached` si ya no se lanza.
- `apps/web/lib/user-preferences.ts` y `api/v1/preferences/route.ts`: siguen
  aceptando los campos (compatibilidad) pero no alimentan ningún tope.
- `apps/web/app/admin/page.tsx` + `actions.ts`: D12.
- `pnpm --filter web test`, `pnpm check`, `supabase db lint`.

### Fase 2 — Contratos y React Native

- `packages/contracts`: `canRequestReward(config)` solo con la config (D8);
  `walletSchema` se conserva para la API; `remoteConfigSchema` conserva las dos
  claves (payload compartido con builds viejos). Actualizar `domain.test.ts`.
- `src/lib/intervention-flow.ts`: `InterventionGate = { ad }`; fuera `pass`,
  `USE_PASS`, `earnedBy: "wallet"`, `keepsRewardOnLeave`; `isTimedPause` = `ad
  === "none"`. Reescribir `intervention-flow.test.ts`.
- `src/lib/shortcut-intervention.ts`: `getInterventionOptions` sin
  saldo/pases/topes (solo dispositivo, proveedor y estado del anuncio).
- `src/components/shortcut-intervention.tsx`: fuera la opción de pase, el
  `addProvisionalToken` al irse y la frase "el pase que ganaste se guarda".
- `src/state/app-state.tsx`, `offline-policy.ts`, `reward-ad-state.tsx`: D8–D9.
  `unlockShortcut` solo con anuncio recién visto (con `rewardIntentId`) o pausa.
- Borrar `app/(tabs)/(tokens)/`, su entrada en `app/(tabs)/_layout.tsx`
  (`Tabs` y `NativeTabs`), `app/unlock-ready.tsx`, las claves de i18n de pases;
  `app/recharge.tsx` y el recargo de `_layout.tsx` → Hoy (D10).
- `app/(tabs)/(settings)/index.tsx`: D11.
- `app/(onboarding)/index.tsx`: textos de D13.
- `e2e/*.yaml` que usan pases (`consume-token`, `recharge-*`,
  `assert-token`, `assert-zero-*`): borrar o reescribir.
- `pnpm --filter mobile test` y `tsc`.

### Fase 3 — Android nativo

- `InterventionActivity.kt`: fuera `passAvailable`, `EnterSource.SAVED_PASS`,
  el botón "Usar 1 pase de emergencia", la proyección de `KEY_REWARDED_BALANCE`
  y la frase del pase guardado; `Gate` = solo `AdOffer`. `nothingLeft` = `NONE`.
- `StillRestrictionModule.kt`: `syncWallet` sigue existiendo (firma igual) pero
  el saldo ya no se lee en ningún lado.
- `scripts/verify-shield-device.sh`, `native-config.test.ts`: sin pases.
- `./gradlew :app:compileDebugKotlin` (con `ANDROID_HOME`), y si hay un Android
  por `adb`, `pnpm --filter mobile acceptance:shield:device`.

### Fase 4 — Textos (web, landing, tienda)

- `apps/web/app/terms/page.tsx` (§5 "Anuncios y pases" → "Anuncios"),
  `privacy/page.tsx`, `soporte/page.tsx`, `investigacion/page.tsx`,
  `lib/landing-content.ts`, `components/landing/why-still.tsx`,
  `components/landing/phone.tsx` (sin "Usar 1 pase de emergencia").
- `docs/store-listing.md` (es y en). El texto de App Store Connect y Play
  Console lo cambia el usuario.
- `docs/real-impact-stats-plan.md`: nota arriba de D2–D3 que dice que este plan
  los reemplaza.

### Fase 5 — Verificación

- `pnpm check`, `pnpm build`, `supabase db lint`, tests pgTAP en `begin/rollback`
  contra prod.
- Simulador iOS (build de desarrollo, anuncios de prueba): pausa con anuncio →
  ver → elegir tiempo → entrar; cortar la red → "Preparando el anuncio…" →
  respirar; irse tras el anuncio no guarda nada; Ajustes sin límites; 3 pestañas.
- Android (emulador o `adb`): lo mismo en el escudo nativo, más reabrir la app
  bloqueada a mitad de la respiración → sigue respirando.
- Anotar resultados en §7 de este documento.

## 6. Pasos del usuario

1. **AdMob (la causa de que iOS nunca muestre anuncios):** cuando la app esté
   publicada en App Store, AdMob → Apps → Still (iOS) → Configuración de la app
   → vincular a la tienda; luego esperar la revisión de preparación (suele
   tardar un par de días). Lo mismo con Still (Android) cuando la ficha de
   Google Play sea pública. Sin esto, el servicio queda limitado y en iOS es 0.
2. Orden de salida: primero migración + API (Vercel desde `main`): los builds
   viejos siguen funcionando (§4). Después builds nuevos (Android vc15, iOS
   build 7).
3. iOS build 6 está en revisión: decidir si se deja pasar y se manda el 7 como
   actualización, o se retira y se manda el 7.
4. Actualizar la descripción en App Store Connect y Play Console con
   `docs/store-listing.md`.
5. Avisar a los testers que actualicen: los pases guardados desaparecen.

## 7. Resultados (2026-09-24)

Commits en la rama, sobre `main` 68a6bb2: `40c9a8b` (espera al anuncio, §2),
`49ecd77` (este plan), `7a11d37` (fase 1), `f2ff7e6` (fase 2), `edf2523`
(fase 3), `a05625c` (fase 4) y el de la fase 5 (subtítulo de Ajustes y esta
sección). Nada pusheado ni aplicado en prod.

### Verificado

- `pnpm check` (lint + typecheck + tests: contratos 30, móvil 196, web 68) y
  `pnpm build`: exit 0.
- pgTAP contra prod dentro de `begin/rollback`, con la migración
  `202609240001`: `production_invariants` 30/30, `real_impact_stats` 48/48,
  `admin_login` 8/8. `admob_refresh_token` 6/7: la prueba 1 falla igual sin la
  migración, porque prod ya tiene el token guardado en Vault y la prueba supone
  una base vacía. `production_invariants` ahora concilia primero los intents
  viejos que ya tenga la base (prod tenía 2), así no depende de datos reales.
- `supabase db lint --linked`: solo los avisos previos de parámetros sin usar
  (`p_started_at`, `p_earned_at`), que se conservan por compatibilidad.
- Simulador iOS ("Still QA", dev client, anuncios de prueba, contra un mock
  local de la API: no se escribió nada en prod): onboarding con los textos
  nuevos; 3 pestañas (Hoy, Impacto, Ajustes); Ajustes sin límites ("01 /
  PAUSAS" → "02 / CUENTA"); la app no llama `/wallet`. Pausa: "Ya no quiero
  entrar" + "Ver anuncio", sin pase. Anuncio de prueba → reclamo → elegir el
  tiempo, sin la frase del pase guardado → se prepara otro anuncio en el acto
  (sin tope). Irse después del anuncio → "Listo. Te quedaste fuera.", sin
  guardar nada. Sin anuncio (intents fallando): al abrir la pausa pide un
  anuncio nuevo y, cuando falla, respira. Con la respiración empezada, el
  anuncio quedó listo a los 30 s y la pantalla siguió respirando hasta
  "¿Sigues queriendo abrir Instagram? … 5 min".
- Emulador Android (`Still_QA_API_36`, APK debug de la rama): el escudo
  muestra "Go back / Watch ad" y el anuncio de prueba se abre al tocarlo. Sin
  red: el anuncio falla, respira (guarda `shield_pause_started_at`) y termina
  en "Do you still want to open Gmail? … 5 min". Con la respiración empezada se
  volvió a poner la red, YouTube cargó un anuncio y al reabrir Gmail siguió la
  pausa, sin "Watch ad". Después de "I don't want to go in anymore" la marca se
  borra y la siguiente apertura ofrece "Watch ad". Ninguna pantalla muestra un
  pase.
- `acceptance:shield` en este emulador falla en YouTube (no aparece a tiempo o
  cuenta dos intentos) **igual con el Kotlin de `main`**: es una carrera previa
  del entorno (YouTube y Gmail ponen pantallas propias encima del escudo:
  permiso de notificaciones, "Update available", "New in Gmail"), no de esta
  rama.
- No se pudo probar en el simulador el traspaso real de un atajo (la
  automatización "Al abrir" no corre en el simulador, y el atajo de prueba del
  simulador ejecuta la acción de la app vieja `com.still.screentime`); la
  pausa se abrió con `app.still.ios://intervention`. Que el reporte de la
  entrada nombre su anuncio lo cubre `unlockReportBody` con tests.

### Hallazgos

- **Los builds publicados (0.2.0) nunca mandaron `rewardIntentId`** al
  reportar una entrada: en prod, 0 de 14 entradas recientes nombran su anuncio
  (todas gastaron saldo). Con la migración esos reportes se rechazan
  (`insufficient_balance`) y los builds viejos los descartan en silencio: el
  usuario entra igual y el anuncio cuenta igual por SSV, pero esas entradas no
  quedan en `unlock_sessions` y el +1 de cada reclamo queda sin gastar en el
  libro (sin efecto: nada lee ese saldo). El build nuevo lo arregla
  (`unlockReportBody`).
- Términos y privacidad cambiaron de contenido; dicen "vigentes desde el 24 de
  septiembre de 2026": ajustar a la fecha real de publicación.
- Quedan sin tocar las extensiones heredadas de Screen Time de iOS
  (`StillShieldAction`, que todavía hablan de "recargar"): no están activas.

### Pendiente del usuario

1. Aplicar la migración `202609240001` en prod (`supabase db push --linked`)
   antes o junto con el despliegue de la API (Vercel desde `main`): las rutas
   nuevas ya no traducen los códigos de tope que la base vieja todavía lanza.
2. Revisar la rama, mergearla y pushear `main`.
3. Builds nuevos: Android vc15 (cambió el Kotlin) e iOS build 7 (solo JS);
   decidir qué hacer con el build 6 que está en revisión.
4. AdMob: vincular las dos apps a su tienda cuando estén publicadas (iOS: App
   Store; Android: ficha pública de Play) y esperar la revisión de
   preparación. Sin esto iOS sigue sin anuncios y cae en la respiración.
5. Actualizar las descripciones de App Store Connect y Play Console con
   `docs/store-listing.md`.
6. Avisar a los testers que actualicen: los pases guardados desaparecen, y en
   el build viejo "Conseguir 1 pase" ya no deja nada usable.
7. Probar en el iPhone físico el traspaso real del atajo y en el Xiaomi el
   escudo con anuncios reales.

## 8. Prompt para `/goal`

```
/goal Implementa docs/ads-only-pause-plan.md en la rama fix/ads-wait-before-pause
(worktree ../screen_time-ads-fix). Las decisiones D1–D13 y la compatibilidad de
§4 están cerradas: no las reabras ni reinvestigues. Haz las fases 1 a 5 en
orden, cada una con sus tests en verde y un commit en la rama. No hagas push ni
apliques migraciones en prod: los tests pgTAP corren contra prod solo dentro de
begin/rollback. Termina completando §7 con lo verificado y lo que quedó
pendiente para el usuario.
```

# Impacto real y pases sin emergencia

Rama: `feat/access-duration-slider-and-live-expiry`. Escrito el 2026-09-23 a partir de
un pedido del usuario: que los anuncios vistos, el fondo y las personas sean
reales, que cada anuncio estime lo que genera, que se cuenten personas distintas
y tiempo recuperado, y decidir qué hacer con los pases de emergencia.

## 1. Qué había (medido en la base de producción el 2026-09-23)

| Hecho | Evidencia |
|---|---|
| Los "pases de emergencia" eran 3 accesos **gratis por día** (`dailyEmergencyUnlocks=3`), no se ganaban con anuncios | config v3; `wallet/route.ts`; `create_unlock_session` |
| Se usaron: 5 sesiones `emergency` (1/9 ×3, 22/9 ×2), todas de testers | `unlock_sessions` |
| El pase normal ya cumplía lo pedido (se gana con un anuncio, máximo 3, entra sin anuncio)… | `maxRewardTokenBalance=3`, `use_rewarded_pass` |
| …pero **no se podía usar si había un anuncio cargado**: el shield ofrecía solo "Ver anuncio" | `InterventionActivity.currentGate()`, `getInterventionUnlockAction` |
| "Participantes" contaba votantes, no personas que aportaron | `lib/impact.ts` |
| "Anuncios vistos" contaba intents verificados dentro de la semana abierta, que era la del 24–30 de agosto (nunca se abrió otra): siempre 0 | `impact_weeks` tiene una sola fila |
| De 18 anuncios reclamados, 1 llegó verificado por AdMob (SSV). Los demás eran anuncios de prueba (sin SSV) y se revirtieron a las 26 h | `reward_intents` |
| El import de ingresos de AdMob se cortó el 6/9: el refresh token da `invalid_grant` y el job responde 500 | llamada al job en prod |
| En Android, si el shield no tenía un intent vigente (duran 15 min y solo se reponen con Still abierta), el anuncio se mostraba sin SSV: no se contaba, y el desbloqueo se reportaba como pase y podía gastar un pase guardado | `StillRewardedAdManager.show`, `enterTarget` |
| El tiempo recuperado solo subía "hoy" y solo al abrir Still: los días sin abrir la app se perdían | `app-state.tsx` |
| El servidor guardaba la duración de Ajustes, no la que el usuario eligió en el slider | `create_unlock_session` |

## 2. Decisiones

| # | Decisión |
|---|---|
| D1 | **Se quitan los accesos de emergencia** (gratis, diarios). No cumplen el modelo pedido y el pase ya lo cumple. Sin anuncio y sin pase queda la pausa de 15 s (5 min), que ya era el último recurso. |
| D2 | **Un solo concepto: el pase.** Se gana viendo un anuncio (en Pases, o viendo el anuncio en la pausa y decidiendo no entrar), tope `maxRewardTokenBalance`, y **siempre** se puede usar en la pausa sin ver un anuncio, aunque haya uno listo. |
| D3 | El shield muestra "Volver" (principal), "Ver anuncio" (secundaria, si hay anuncio) y, chico y en gris debajo, "Usar 1 pase de emergencia" (si hay pase). El pase nunca espera al anuncio pero nunca es la primera opción (pedido del usuario, 2026-09-23). Si no hay ninguno, pausa de 15 s. |
| D4 | **Anuncio visto = anuncio recompensado confirmado por AdMob (SSV)**, firmado por Google, con `transaction_id` único. Se registra en `ad_views` aunque no haya intent (Android sin buffer) o el intent haya vencido; los anuncios de prueba no mandan SSV y no cuentan. |
| D5 | **Valor de cada anuncio**, en este orden: (1) el evento de ingreso del SDK para esa impresión (ILRD: `valueMicros`, precisión `precise`/`estimated`/`publisher_provided`, USD, tope USD 0,10); (2) el eCPM observado en los informes de AdMob de los últimos 28 días (con ≥ 50 impresiones); (3) el eCPM por defecto de la configuración (`estimatedRewardedEcpmUsd`, 3 USD: rewarded Android en LatAm ronda 2–4 USD). Precisión `unknown` con valor 0 = anuncio de prueba, vale 0 y no cuenta. |
| D6 | **Fondo en vivo**: por cada día (zona `America/Los_Angeles`, la de los informes de AdMob) se usa el informe de AdMob si se importó ≥ 24 h después de cerrar el día; si no, el mayor entre el informe parcial y la suma de los anuncios estimados. Todo en micros (sin redondeo por día). Al confirmar el ingreso, el operador congela el monto (como antes). |
| D7 | **Personas** que aportaron = personas distintas con ≥ 1 anuncio verificado en la semana (`participants`). **Personas** que usaron Still = personas distintas con ≥ 1 pausa en la semana. Votantes pasan a `voters`. |
| D8 | **Tiempo recuperado** = (pausas − entradas) × `estimatedMinutesPerAvoidedOpen`, calculado en el servidor con la config activa. La app sube los 7 días de su historial en cada sincronización, así los días sin abrir Still no se pierden. |
| D9 | **Semanas automáticas**: `ensure_current_impact_week()` abre la semana actual (lunes–domingo, zona de AdMob) con los candidatos de la anterior y cierra la votación de las semanas vencidas. Corre en los jobs diarios y al leer el impacto. El operador sigue confirmando ingreso y donación. |
| D10 | Intents de anuncio duran **24 h** (antes 15 min) y el tope de intents activos sube a **5**, para que el shield de Android casi siempre tenga uno. Si igual no hay intent, el desbloqueo por anuncio **no se reporta** (no gasta un pase guardado). |
| D11 | Los reportes de desbloqueo que el servidor rechaza de forma definitiva (`invalid_unlock_source`, `insufficient_balance`, `daily_pass_limit`) se descartan en vez de reintentarse para siempre. Un desbloqueo por anuncio espera a que su recompensa se reclame antes de reportarse. |
| D12 | El servidor guarda la duración que el usuario eligió (60 s – 24 h), no la de Ajustes. |
| D13 | Montos menores a USD 100 se muestran con centavos. |
| D14 | La base de prod se puede modificar (el usuario la reseteará antes de publicar). La API desplegada vieja sigue funcionando con la migración nueva: los cambios son aditivos salvo el rechazo de `emergency`. |

## 3. Pasos externos (del usuario)

1. **Renovar el refresh token de AdMob Reporting** (`ADMOB_REFRESH_TOKEN` en Vercel y `.env.local`), con la pantalla de consentimiento en producción para que no venza a los 7 días. Sin esto, el fondo usa solo las estimaciones por anuncio.
2. **Activar "Impression-level ad revenue"** en AdMob (Configuración → Cuenta). Sin esto, el SDK no manda el valor por impresión y se usa el eCPM.
3. Desplegar la web/API en Vercel y generar builds nuevos de la app.

## 4. Qué cambió (2026-09-23)

### Base de datos — `supabase/migrations/202609230001_real_impact_stats.sql`

- `ad_views`: una fila por anuncio recompensado que AdMob confirmó (SSV), con o
  sin intent. Guarda el valor que informó el SDK (`paid_*`) y el valor que se usa
  (`estimated_value_micros`, `estimate_source`: `paid_event`, `observed_ecpm`,
  `default_ecpm`, `test_ad`). Un trigger calcula el valor y el día de AdMob
  (`report_date`, calendario de Los Ángeles). Si la persona borra su cuenta, la
  fila queda sin `user_id` y sigue contando.
- `record_verified_ad_view()` (webhook SSV, idempotente por `transaction_id`) y
  `record_ad_paid_value()` (reclamo; el primer valor gana).
- `revenue_daily.gross_revenue_micros`: el ingreso diario sin redondear a
  centavos.
- `impact_week_totals(uuid[])`: fondo en vivo, anuncios, personas que aportaron,
  personas que usaron Still, minutos recuperados y votantes, por semana.
  `impact_all_time_totals()`: los mismos totales desde el inicio y lo donado.
- `ensure_current_impact_week()`: abre la semana actual y cierra la votación de
  las vencidas (audita como `impact.week_opened_automatically`).
- `record_wellbeing_days()`: sube hasta 14 días por dispositivo, calcula los
  minutos con la config activa y nunca baja lo ya registrado.
- `create_unlock_session()`: solo `rewarded`, guarda la duración elegida y, si
  la visita la pagó un anuncio recién visto (`p_reward_intent_id`), gasta el pase
  de ese anuncio y nunca uno guardado.
- `create_reward_intent()`: hasta 5 intents esperando.
- Tests: `supabase/tests/real_impact_stats.sql` (49) y `production_invariants.sql`
  (25) pasan contra el esquema real de prod dentro de una transacción revertida.

### API y web

- Webhook SSV: registra cada anuncio que Google firma; el pase se concede aparte
  y un límite (billetera llena, límite diario, intent vencido) ya no rechaza el
  callback. Solo una firma inválida da 400; un fallo de base da 503 para que
  Google reintente.
- Reclamo: acepta `adValue` (ILRD) y lo guarda antes de reclamar.
- Intents: duran 24 h.
- Impacto actual e historial: fondo en vivo desde `impact_week_totals`,
  `participants` = personas que aportaron, más `voters`, `people`,
  `minutesReturned`, `estimatedRevenueMinor`, `reportedRevenueMinor` y `allTime`.
  La lectura abre la semana solo si la última ya terminó.
- Import de AdMob: días de Los Ángeles, micros, y ya no pisa el bruto semanal.
- Billetera y desbloqueos sin emergencia; bienestar acepta varios días.
- Admin: sin el campo de emergencia, con el eCPM por defecto, «Semanas por
  cerrar» con el ingreso prellenado y la lista de anuncios recientes con su valor.
- Tarjeta de impacto, inicio y página de impacto: centavos cuando el fondo es
  chico, anuncios vistos, personas que aportaron, tiempo recuperado y totales
  desde el inicio. Privacidad y términos ya no mencionan accesos de emergencia.

### App

- Pausa (iOS y Android): "Volver", "Ver anuncio" y, chico debajo, "Usar 1 pase
  de emergencia"; con ninguno, la pausa de 15 s.
- Pases: sin la sección de emergencia; el texto dice que el pase deja entrar sin
  ver un anuncio y hasta cuántos se guardan.
- Impacto: fondo con centavos, anuncios vistos, personas que aportaron y el
  bloque «Tiempo recuperado» (semana y desde el inicio). Hoy: fondo con centavos.
- Ajustes: los límites diarios vuelven a empezar cada día; los pases guardados
  se mantienen.
- Sincronización: sube los 7 días del historial; manda el valor del anuncio al
  reclamar; una visita pagada por un anuncio del shield espera a que ese anuncio
  se reclame; los rechazos definitivos (incluidas las emergencias que dejaron
  builds viejos) se descartan.
- Android nativo: `onPaidEventListener` en el shield, valor del anuncio en el
  outbox, la visita nombra su intent y un anuncio sin intent no se reporta.
- iOS nativo: billetera y puente `syncWallet` sin emergencia.

### Verificación

| Qué | Resultado |
|---|---|
| `pnpm check` | lint, tipos y tests OK: contratos 32, web 42, móvil 198 |
| pgTAP contra prod (transacción revertida) | 49/49 nuevos, 25/25 existentes |
| `./gradlew :app:compileDebugKotlin` | OK (solo advertencias de deprecación previas) |
| `xcodebuild` Debug para el simulador (app + extensiones) | OK |

## 5. Pendiente

1. **Aplicar la migración en prod**: `supabase db push --linked` (aplica también
   `202609200001`, que estaba pendiente). El comando quedó bloqueado por los
   permisos de la sesión.
2. Desplegar la web/API después de la migración (al revés, la API nueva falla).
3. ~~Renovar `ADMOB_REFRESH_TOKEN` y activar "Impression-level ad revenue" (§3).~~ Hecho el 23/9: el token vive en Supabase Vault (`pnpm admob:connect` desde `apps/web`) y el import trajo 14 días reales (0 impresiones: la app aún no está vinculada a Play en AdMob). Ingresos por impresión activado en AdMob.
4. Builds nuevos de la app. Los builds viejos siguen funcionando contra la API
   nueva salvo por los pases de emergencia, que el servidor ya no acepta.
5. Probar en dispositivo: pase y anuncio a la vez en la pausa, el valor del
   anuncio en `/admin` y el fondo moviéndose con un anuncio real.

# Reenvío de Still iOS a App Review (0.3.1)

Fecha: 2026-09-25 · Rama: `fix/ios-app-review` (desde `main` 6f57895) · Estado: plan, sin
implementar.

**Pedido del usuario:** "investigar por qué me rechazaron la versión" y hacer un plan "para poder
generar una versión con todas las features que tenemos y que nos lo puedan aprobar para iOS. En
Android no hemos tenido problemas".

Etiquetas de evidencia: **[ASC]** leído en App Store Connect (web o API), **[código]** leído en el
repo, **[prod]** leído en producción por endpoints públicos, **[web]** documentación de Apple.

---

## 1. Por qué rechazaron 0.2.0 (6)

- Envío `ad546c6a-f635-4884-ba68-bf48b18a6539` (23-09-2026), versión `f79f8af8-28fc-43d3-bfc8-786aaec89354`,
  estado `REJECTED`, envío `UNRESOLVED_ISSUES` [ASC].
- Mensaje de App Review del 25-09-2026: **Guideline 2.1 – Information Needed – New App Submission**
  [ASC]. La app se envió desde una cuenta de desarrollador "with a limited App Review history". No
  señalan ningún fallo. Piden **responder en App Store Connect y además copiar lo mismo en Notes**
  (App Review Information):
  1. Un vídeo grabado en un **dispositivo físico con el último sistema operativo**. Tiene que empezar
     abriendo la app y mostrar el uso típico, incluidos **registro, inicio de sesión y borrado de
     cuenta**, contenido de usuarios (con denuncia y bloqueo) y contenido pago, si los hay.
  2. El propósito de la app y su público: qué problema resuelve y qué valor da.
  3. Instrucciones para configurar y usar las funciones principales, con credenciales o archivos de
     ejemplo si hacen falta.
  4. La lista de servicios externos que usa la función principal: datos, autenticación, pagos, IA.
  5. Las diferencias por región, o la confirmación de que funciona igual en todas.
  6. Documentación, si opera en un sector regulado o usa material protegido de terceros.
- Los correos de Apple ("Your App Review Feedback", "There's an issue with your Still (iOS)
  submission") no traen el motivo: solo remiten a la página de App Review.
- Android no pasó por esto porque Google no pide esta información.

## 2. Riesgos para la segunda revisión

Cuando Apple tenga la información, va a revisar la app a fondo. Esto es lo que puede frenarla:

| # | Hallazgo | Norma | Evidencia | Acción |
|---|---|---|---|---|
| R1 | No hay enlace a la política de privacidad dentro de la app | 5.1.1(i): "within the app in an easily accessible manner" [web] | [código] ningún link en `apps/mobile` | C1 |
| R2 | El binario incluye `suspendToHome` (`NSSelectorFromString("suspend")`), aunque el flag está apagado | 2.5.1: "only use public APIs" [web]; 2.3.1 (funciones ocultas) | [código] `ios/StillNative/StillRestrictionEngine.swift:215-233` | C2 |
| R3 | El borrado de cuenta no revoca el token de Sign in with Apple | Requisito de Apple sobre el borrado de cuentas en apps con SIWA | [código] `apps/web/app/api/v1/privacy/delete/route.ts` | C3 |
| R4 | La ficha está desactualizada: las capturas muestran la pestaña «Pases» y la guía «Una sola automatización pausa todas tus apps»; la descripción habla de pases, de «Pausar antes de abrir» y de «anuncios opcionales» | 2.3.1 / 2.3.3 | [ASC] | M2, M3 |
| R5 | Las notas de revisión describen el flujo viejo (`Pause Before Opening`, «News») | 2.1 | [ASC] | M4 |
| R6 | `PrivacyInfo.xcprivacy` declara `NSPrivacyCollectedDataTypes` vacío | Coherencia con la etiqueta App Privacy | [código] | C4 |
| R7 | Si hay anuncio, la única forma de entrar a la app pausada es verlo (la respiración de 15 s solo aparece si el anuncio no carga) | 3.2.2(iii): "designed predominantly for the display of ads" [web]; 3.2.2(x) permite incentivar ver un anuncio | [código] `docs/ads-only-pause-plan.md` D1 | A1 |
| R8 | El fondo muestra ONG reales con su nombre: Cruz Roja Uruguaya, Fundación Pérez Scremini y Karumbé | 3.2.2(iv) (recaudar para ONG) / 5.2.1 (material de terceros) | [prod] `/api/v1/impact/current` | A2 |

**Ya comprobado y correcto:**
- `/api/v1/config` en producción: `iosRestrictionEnabled: true` e `iosHomeOnCancelEnabled: false` [prod].
- `/privacy`, `/soporte`, `/eliminar-cuenta` y `/app-ads.txt` responden 200 [prod].
- En iOS no se llama a `requestAuthorization` de Family Controls: solo la usan `android-setup.tsx` y
  `use-android-setup.ts` [código].
- En TestFlight, las builds 0.3.0 (10) y (12) están VALID, con `usesNonExemptEncryption: false` [ASC].
- La clasificación por edad tiene override 18+ (V2 18+), coherente con el aviso de 18+ de la app y de
  la descripción [ASC].
- `demoAccountRequired: false` es correcto: la sesión anónima se crea sola [ASC][código].

## 3. Decisiones cerradas (no reabrir)

| # | Decisión | Origen |
|---|---|---|
| **A1** | **La pausa no cambia.** Para entrar se ve un anuncio recompensado. Si no carga en 12 s, hay una respiración de 15 s que deja entrar 5 min. La ficha, las notas y la respuesta lo dicen tal cual, **sin describir el anuncio como "opcional"** cuando es el camino para entrar. Si Apple lo objeta por 3.2.2(iii), la siguiente build suma un camino sin anuncio. | Usuario, 2026-09-25 |
| **A2** | **ONG.** No hay permiso de las organizaciones. Notas y respuesta explican que los usuarios nunca pagan, que el desarrollador dona el 80 % del ingreso por anuncios por los canales públicos de cada ONG, que no hay afiliación ni aval y que el comprobante se publica. Pedir permiso queda como tarea aparte. | Usuario, 2026-09-25 |
| **A3** | **La revocación de Sign in with Apple entra en esta build.** | Usuario, 2026-09-25 |
| **A4** | **Se reutiliza el registro de versión rechazado.** Su número pasa de 0.2.0 a **0.3.1** y se le asigna la build nueva. La conversación sigue en el mismo envío. | Recomendación aceptada |
| **A5** | **0.3.1 en las dos plataformas,** porque el JS cambia en ambas. `pnpm deploy:apps` publica iOS en TestFlight y Android en internal → alpha. | Recomendación aceptada |
| **A6** | **Notas y respuesta en inglés.** El vídeo se graba con Still en inglés (Ajustes de iOS → Still → Idioma), en el iPhone del usuario con iOS 27. | Recomendación aceptada |
| **A7** | **Al revisor se le sugiere Calendar o Maps.** Están en todos los iPhone de todas las regiones; News no está disponible en muchos países. | Recomendación aceptada |
| **A8** | **La revocación pide confirmar otra vez con Apple al borrar la cuenta.** No se guardan tokens, y así cubre también las cuentas vinculadas antes de esta versión. Si la persona cancela, la cuenta se borra igual y se le dice cómo quitar Still de su Apple ID. | Recomendación aceptada |

## 4. Trabajo de código

Se trabaja en el worktree `../screen_time-app-review`, rama `fix/ios-app-review`. El checkout
principal lo usa otra sesión (`feat/real-savings-estimate`, con cambios de Android sin commitear).

### C1. Enlace a la política de privacidad dentro de la app (R1)

- `apps/mobile/app/(tabs)/(settings)/index.tsx`: en la sección de datos, cerca de «Privacidad de los
  anuncios» (~línea 504), agregar la fila «Política de privacidad / Privacy policy», que abre
  `<web>/privacy` con el mismo patrón de enlaces externos que ya use la pantalla. Opcional: «Soporte»,
  que abre `/soporte`.
- Usar la base de URL web que ya tenga la config de la app. No escribir la URL a mano.

### C2. Quitar `suspendToHome` (R2)

- Borrar el método en `apps/mobile/ios/StillNative/StillRestrictionEngine.swift:215-233` y su
  `RCT_EXTERN_METHOD` en `StillRestrictionEngine.m:18`.
- Quitar `suspendToHome` de `src/native/restriction-engine.ts` (interfaz ~134, stub ~229).
- En `src/lib/leave-to-home.ts`, quitar la rama `homeOnCancelEnabled`. La cadena queda así: atajo
  auxiliar → aviso manual.
- Limpiar también `src/native/use-leave-to-home.ts`, `src/lib/dev-config.ts` y la condición de
  `app/shortcut-repair.tsx:211`. Actualizar los tests.
- `packages/contracts` sigue aceptando `iosHomeOnCancelEnabled` porque los builds viejos lo leen; el
  cliente nuevo lo ignora. En `/admin` (`apps/web/app/admin/page.tsx`, `actions.ts`), marcar el
  interruptor «sin efecto desde 0.3.1» o sacarlo de la UI.
- Actualizar `docs/store-compliance.md` §«Leaving to the Home Screen».

### C3. Revocar Sign in with Apple al borrar la cuenta (R3, A3, A8)

**Móvil** (`app/(tabs)/(settings)/index.tsx:211-262`, `src/lib/identity.ts`):
- Nueva `appleAuthorizationForDeletion()`. Si `Platform.OS === "ios"` y `getLinkedIdentityProviders()`
  incluye `"apple"`, llama a `AppleAuthentication.signInAsync({ requestedScopes: [] })` y devuelve
  `credential.authorizationCode`. Si la persona cancela (`ERR_REQUEST_CANCELED`), devuelve `null`.
- El borrado manda `POST /api/v1/privacy/delete` con `{ appleAuthorizationCode }` cuando hay código.
- Si no se revocó, el mensaje final explica cómo quitar Still en Ajustes → Apple ID → Iniciar sesión
  con Apple.

**Servidor**, nuevo `apps/web/lib/apple-sign-in.ts`:
- `appleClientSecret()` firma un JWT ES256 con `node:crypto` y `dsaEncoding: "ieee-p1363"`, el mismo
  patrón que ya funciona con la clave de ASC. Campos: `iss` = `JZ9HBXGNK9`, `sub` = `app.still.ios`,
  `aud` = `https://appleid.apple.com`, `exp` ≤ 5 min, `kid` = Key ID.
- `revokeAppleAuthorization(code, expectedSub)`:
  1. Llama a `POST https://appleid.apple.com/auth/token` con `grant_type=authorization_code` y recibe
     `refresh_token` e `id_token`.
  2. Compara el `sub` del `id_token` (llega directo de Apple) con la identidad `apple` del usuario
     (`auth.admin.getUserById` → `identities`).
  3. Si coinciden, llama a `POST https://appleid.apple.com/auth/revoke` con
     `token_type_hint=refresh_token`.
- `apps/web/app/api/v1/privacy/delete/route.ts`:
  - El cuerpo es opcional, porque los builds viejos no mandan nada.
  - La revocación va **antes** de seudonimizar y borrar. Es best-effort: si falla, se registra y la
    cuenta se borra igual.
- Variables de entorno en Vercel (producción y preview): `APPLE_SIGN_IN_KEY_ID`,
  `APPLE_SIGN_IN_PRIVATE_KEY`, `APPLE_TEAM_ID` y `APPLE_SIGN_IN_CLIENT_ID=app.still.ios`, validadas
  donde la web valida sus env. Sin la clave, la cuenta se borra sin revocar y queda un aviso en el log.
- **Límite conocido:** en Android no se puede pedir el código de Apple. Si una cuenta con Apple
  vinculado se borra desde Android, no se revoca.

### C4. Manifiesto de privacidad (R6)

- Declarar en `NSPrivacyCollectedDataTypes` de `apps/mobile/ios/Still/PrivacyInfo.xcprivacy` (y en
  `privacyManifests` de `app.config.ts`, si ahí se genera) lo mismo que dice la etiqueta «App Privacy»
  de ASC. Primero hay que leer esa etiqueta en ASC.
- Lo esperado:
  - User ID y email opcional, para funcionalidad y vinculados.
  - Product Interaction y Crash/Performance, si PostHog o Sentry están activos en producción.
  - Los datos de anuncios que declare AdMob.
- Si la etiqueta y el código no coinciden, se corrige la etiqueta.

### C5. Versión y textos

- `apps/mobile/app.config.ts` → `0.3.1`. EAS pone el build number en remoto.
- `docs/store-listing.md`:
  - Descripción es-MX/en-US y texto promocional sin pases, con la acción «Pausar <app>» /
    «Pause <app>», con cómo se entra según A1 y con el aviso de 18+.
  - Las notas de revisión nuevas (§6).

### C6. Checks y publicación

1. Correr `pnpm check` y los tests de `apps/web` (vitest) y `apps/mobile`.
2. Merge a `main` y push. Vercel tiene que publicar la ruta de borrado **antes** de que la build llegue
   a revisión.
3. Correr `pnpm deploy:apps`: iOS 0.3.1 (N) va a TestFlight y Android 0.3.1 a internal → alpha.

## 5. Ficha en App Store Connect

Todo se hace por la API con la clave `A8PSU8WY52`, salvo lo que se indica. Cada escritura se
confirma antes con el usuario.

- **M1.** En el registro de versión `f79f8af8-…`, cambiar `versionString` de 0.2.0 a 0.3.1 (PATCH
  `appStoreVersions`) y asignar la build 0.3.1 (N). Plan B, si ASC no deja editar con el envío abierto:
  «Cancel Submission», editar y crear un envío nuevo. En ese caso la respuesta va en Notes y en el
  mensaje.
- **M2.** `appStoreVersionLocalizations` es-MX y en-US: descripción y texto promocional de C5.
- **M3.** Capturas reales de 0.3.1, sacadas del simulador:
  - Pantallas: la pausa (se lanza con `shortcuts://run-shortcut?name=…`), Hoy, el selector de apps, la
    guía «Pausar <app>», Impacto con datos reales y Ajustes.
  - En español para es-MX y en inglés para en-US, al tamaño que exige ASC (6.9" o 6.5").
  - Borrar los 6 PNG viejos del set `APP_IPHONE_65` de es-MX.
- **M4.** En `appStoreReviewDetail`, subir las notas nuevas (≤ 4000 caracteres) y el vídeo como
  `appStoreReviewAttachment`. Se mantienen `demoAccountRequired: false` y el contacto.
- **M5.** Revisar en la web: la etiqueta «App Privacy» (para C4) y el estado del trader DSA.

## 6. Contenido de la respuesta a App Review (en inglés al redactarla)

1. **Vídeo:** adjunto al mensaje y en App Review Information → Attachment.
2. **Propósito y público:** personas adultas (18+) que abren ciertas apps por reflejo. Still pone una
   pausa antes de las apps que eligen y muestra cuántas veces las abrieron hoy y cuánto tiempo
   recuperaron.
3. **Cómo usarla:**
   - No hace falta cuenta: la sesión anónima se crea sola.
   - Pasos: onboarding → confirmar 18+ → elegir apps (Calendar o Maps) → crear la automatización
     personal «When <app> is opened» con la acción ya lista «Pause <app>» → «Run Immediately» → abrir
     la app.
   - En la pausa: «I don't want to go in anymore» o «Watch ad». Después del anuncio se eligen los
     minutos y Still reabre la app por su URL scheme público. Si no hay anuncio en 12 s, una
     respiración de 15 s deja entrar 5 min.
   - Opcional: Ajustes → Cuenta → Sign in with Apple (o Google) → votar en Impacto.
   - Borrado: Ajustes → Tus datos → «Delete account and data», que además revoca Apple.
   - Las automatizaciones personales no corren en el Simulator: hace falta un dispositivo.
4. **Servicios externos:**
   - Supabase: auth anónima y base de datos.
   - API propia en Vercel (`/api/v1`).
   - Sign in with Apple, y Google Sign-In como opción.
   - Google AdMob: anuncios recompensados no personalizados; el consentimiento UMP solo aparece en
     EEA/UK/CH.
   - Apple Shortcuts/App Intents y APNs.
   - Sentry y PostHog, solo si C4 confirma que están activos en producción.
5. **Regiones:**
   - Las funciones son las mismas en todas las regiones, con la UI en español e inglés.
   - El consentimiento de Google solo aparece en EEA/UK/CH.
   - La disponibilidad de anuncios varía por región; sin anuncio, está la respiración de 15 s.
   - Las ONG candidatas son de Uruguay.
6. **Sector regulado o material de terceros:**
   - No es un sector regulado. No hay pagos, compras in-app ni donaciones de usuarios.
   - El fondo lo dona el desarrollador (A2).
   - Los nombres de otras apps aparecen solo como texto, para elegir cuáles pausar y para reabrirlas por
     sus URL schemes públicos.
   - Still no bloquea, no lee ni modifica otras apps, y no pide acceso a Screen Time.

## 7. Pasos del usuario

- **U1. Clave de Sign in with Apple** (antes de que C3 llegue a producción):
  1. developer.apple.com → Keys → «+» → Sign in with Apple → Configure → App ID `app.still.ios`.
  2. Descargar el `.p8` (se puede una sola vez) y dejarlo en `~/.appstoreconnect/private_keys/`.
  3. Pasar el Key ID.
  4. Cargar las env en Vercel con el comando que se le da (el modo automático no deja escribir
     secretos).
- **U2. QA y vídeo:** iPhone con iOS 27, 0.3.1 desde TestFlight, instalación limpia, Still en inglés,
  grabación de pantalla de 2–4 min. Guion:
  1. Abrir Still desde el inicio y hacer todo el onboarding.
  2. Elegir Calendar y crear la automatización con «Pause Calendar».
  3. Abrir Calendar → pausa → «I don't want to go in anymore».
  4. Abrir Calendar otra vez → «Watch ad» → elegir minutos → vuelve a Calendar.
  5. Mostrar Hoy e Impacto.
  6. Ajustes → Sign in with Apple → votar.
  7. Ajustes → «Privacy policy».
  8. «Delete account and data» → confirmar con Apple → cuenta borrada.
  9. Opcional: Ajustes de iOS → Apple ID → Iniciar sesión con Apple, donde Still ya no aparece.

  El archivo se pasa por AirDrop y se comprime a menos de ~50 MB.
- **U3. Enviar:** responder en la página de App Review con el texto listo y el vídeo, y pulsar
  «Resubmit to App Review». Lo puede hacer Claude en el navegador integrado con OK explícito en ese
  momento.

## 8. Verificación

- **Tests:**
  - `pnpm check`.
  - Vitest de `apps/web`:
    - código de Apple válido: se revoca;
    - `sub` distinto: no se revoca;
    - falla la revocación: la cuenta se borra igual;
    - cuerpo vacío (builds viejos): la cuenta se borra.
  - Tests móviles de `leave-to-home` sin suspend y del enlace de privacidad.
- **Binario:** `strings` sobre el `.ipa` de 0.3.1 ya no muestra el selector `suspend` propio.
- **Simulador** («Still QA», es-419 y en): Ajustes abre la política de privacidad, la pausa se lanza con
  el atajo y salen las capturas nuevas.
- **Dispositivo (U2):** tras borrar la cuenta con Apple vinculado, Still desaparece de «Iniciar sesión
  con Apple» en Ajustes de iOS, y los logs de Vercel muestran la revocación sin error.
- **API de ASC después de M1–M4:**
  - la versión es 0.3.1, con la build N;
  - las notas tienen menos de 4000 caracteres;
  - el adjunto y las capturas están `COMPLETE` en es-MX y en-US;
  - los textos son los nuevos.
- **Después de U3:** `reviewSubmissions` pasa de `UNRESOLVED_ISSUES` a `WAITING_FOR_REVIEW` y se sigue el
  estado. Apple suele responder en 24–48 h.

## 9. Prompt para /goal

> Ejecuta `docs/app-store-review-plan.md` (reenvío de Still iOS a App Review como 0.3.1). No reabras las
> decisiones A1–A8 ni vuelvas a investigar el rechazo (2.1 Information Needed, ya diagnosticado).
> Worktree `../screen_time-app-review`, rama `fix/ios-app-review` desde `main`. Haz C1–C6 con tests.
> Para en U1 (necesito la clave de Sign in with Apple) y en U2 (vídeo). Prepara M1–M4 por la API de
> ASC y pídeme OK antes de escribir en la ficha y antes de U3. Termina cuando `reviewSubmissions`
> esté en `WAITING_FOR_REVIEW` con la build 0.3.1, y anota los resultados en el doc.

## 10. Fuera de este plan

- Camino para entrar sin anuncio (solo si Apple lo pide, A1).
- Permiso de las ONG (A2).
- Política de privacidad en inglés y dominio propio (hoy es `*.vercel.app`).
- Logo de Instagram en los dibujos de la guía (riesgo bajo).
- Family Controls / `feat/onboarding-ios-screen-time`, que sigue sin mergear.
- Tiempo devuelto con uso real (`feat/real-savings-estimate`).

# Reenvío de Still iOS a App Review (0.3.1)

Fecha: 2026-09-25 · Rama: `fix/ios-app-review` (desde `main` 6f57895) · Estado: en ejecución.
Bloqueado por el dominio (§13); para retomar, el prompt de §14.

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

## 11. Textos finales

### 11.1 Respuesta a App Review (se pega en «Reply to App Review», con el vídeo adjunto)

```text
Thank you. Here is the information you asked for; the same text is in the Notes of App Review Information. Version 0.3.1 includes every feature. The attached recording (iPhone, iOS 27) starts by launching the app and includes Sign in with Apple and account deletion; its last part uses the Simulator to show the ad path (see 2d).

1. PURPOSE AND AUDIENCE
Still is for adults (18+) who open some apps on reflex and want a moment to decide. The user chooses apps; each time one of them opens, Still shows a short pause first. Still shows how many times each app was opened today and the time given back. It does not block, hide or restrict any app.

2. HOW TO REVIEW (physical device: Shortcuts personal automations do not run in the Simulator)
No login is needed: Still creates an anonymous session by itself.
a) Open Still, go through the onboarding and confirm you are 18+.
b) Choose Calendar or Maps (both are on every iPhone).
c) Follow the in-app guide: Shortcuts > Automation > + > App > Choose > Calendar > blue checkmark > Run Immediately > Next > Create New Shortcut > Search Actions: "Still" > tap "Calendar" under "Pause App" (the ready-made action "Pause Calendar") > blue checkmark. Back in Still, tap Test.
d) Open Calendar. Still comes to the front with "I don't want to go in anymore" or "Watch ad". The rewarded ad only starts after "Watch ad"; afterwards the user picks how long (1 minute to the rest of the day) and Still reopens Calendar through its public URL scheme. If no ad loads within 12 seconds, a 15-second breathing pause lets the user in for 5 minutes.
The target app is visible for a moment before Still appears: iOS runs the automation after the app opens.
Ads are not being served to the iOS app on real devices yet, so on a device "Watch ad" shows "Preparing the ad..." for up to 12 seconds and then the 15-second pause. The last part of the recording uses the iOS Simulator with the same build, where Google serves its test ads, to show the rewarded-ad path.
e) Optional account: Settings > Account > Sign in with Apple (or Google). It is only used to vote for the weekly project (Impact tab) and to recover the account on a new phone.
f) Account deletion: Settings > Your data > "Delete account and data". With an Apple ID linked, Apple asks to confirm and our server revokes the token (Sign in with Apple REST API) before deleting. The privacy policy is in Settings > Your data.

3. EXTERNAL SERVICES
Supabase (anonymous authentication and database); our own API on Vercel; Sign in with Apple; Google Sign-In (optional); Google AdMob (rewarded ads, non-personalized; Google's consent form in the EEA, UK and Switzerland); Apple Shortcuts / App Intents; Apple Push Notification service (reminder when the chosen time ends).

4. REGIONS
The app works the same in every region, in Spanish and English. Google's consent form only appears in the EEA, UK and Switzerland. Ad availability varies by region; with no ad, the 15-second pause applies. The candidate organizations of the weekly fund are in Uruguay.

5. MONEY, CHARITIES AND THIRD-PARTY MATERIAL
Not a regulated industry. There are no in-app purchases, payments or donations: users never pay. The developer allocates 80% of Still's ad revenue to a weekly donation that the developer makes through each organization's public donation channel; users vote on which organization receives it, and the receipt is published in the app. The organizations (Cruz Roja Uruguaya, Fundación Pérez Scremini, Karumbé) are shown by name with their public websites for transparency; they are not affiliated with Still and do not endorse it. Other apps' names appear only as text, so the user can choose which apps to pause and Still can reopen them through their public URL schemes. Still never reads, blocks or modifies other apps, does not request Screen Time (Family Controls) access, and keeps the chosen app names on the device.

There is no user-generated or paid content.
```

Las notas de App Review Information (≤ 4000 caracteres), la descripción y el texto promocional
están en `docs/store-listing.md`.

### 11.2 Guion del vídeo (U2)

iPhone con iOS 27, 0.3.1 instalada desde TestFlight (borrar la app antes), Still en inglés
(Ajustes → Still → Idioma → English), grabación de pantalla desde el Centro de control. Duración de
2 a 4 minutos, sin cortes:

1. Pantalla de inicio → tocar Still. El vídeo tiene que empezar abriendo la app.
2. Onboarding completo: historia, confirmar 18+, anuncios, elegir **Calendar**.
3. Guía de Atajos: crear la automatización «When Calendar is opened» con «Pause Calendar» y volver a
   Still → Test.
4. Abrir Calendar desde el inicio → aparece la pausa → «I don't want to go in anymore».
5. Abrir Calendar otra vez → «Watch ad» → «Preparing the ad…» → respiración de 15 s → «I want to go in» →
   vuelve Calendar. En iOS todavía no se sirven anuncios en dispositivos reales (25-09-2026), así
   que el camino con anuncio se muestra en un clip del simulador con la misma build (anuncio de
   prueba de Google → elegir tiempo), que Claude graba y agrega al final con un rótulo.
6. Volver a Still: Today e Impact.
7. Settings → Account → Sign in with Apple → Impact → votar.
8. Settings → Your data → Privacy policy (se abre la página) → cerrar.
9. Settings → Your data → Delete account and data → Delete permanently → confirmar con Apple →
   vuelve al onboarding.
10. Opcional: Ajustes de iOS → tu nombre → Iniciar sesión con Apple, donde Still ya no aparece.

Después: AirDrop del `.mov` a la Mac y pasar la ruta. Se comprime con
`ffmpeg -i in.mov -vf scale=-2:1280 -c:v libx264 -crf 28 -preset slow -an out.mp4` si pesa más de
~50 MB.

## 12. Resultados

| Paso | Estado | Detalle |
|---|---|---|
| C1 enlace a la privacidad | hecho | 3b90923; Ajustes → Tus datos → «Política de privacidad» |
| C2 sin `suspendToHome` | hecho | 976cda0; test que impide `NSSelectorFromString` |
| C3 revocación de Apple | hecho (código) | 95de93a; falta la clave (U1) para que revoque en producción |
| C4 manifiesto de privacidad | hecho | los 10 tipos de la etiqueta publicada, ninguno de rastreo |
| C5 versión y textos | hecho | 0.3.1; ficha y notas nuevas en `docs/store-listing.md` |
| C6 checks y publicación | hecho | `pnpm check` y `pnpm build` en verde (móvil 266, web 80, contracts 30 tests). `main` = 06c6de8 (fast-forward, push). `pnpm deploy:apps`: **iOS 0.3.1 (13)** en TestFlight (VALID) y **Android 0.3.1 (8)** en internal y enviada a revisión en alpha. |
| Verificación en simulador | hecho | Build Release local de 0.3.1 con env de producción (iPhone 17 Pro Max, iOS 26.0). El binario no contiene `suspendToHome` ni `suspend`. Ajustes → Tus datos → «Política de privacidad» abre `…vercel.app/privacy`. «Ya no quiero entrar» termina en la indicación manual. Onboarding completo en es-MX y en-US, pausa real con el atajo «Pausar Instagram» y anuncio de prueba → elección del tiempo. |
| M1–M4 en ASC | hecho (2026-09-25, con OK del usuario) | La versión `f79f8af8…` ahora es **0.3.1** con la build 13 (`PREPARE_FOR_SUBMISSION`; el envío `ad546c6a…` sigue en `UNRESOLVED_ISSUES` hasta U3). Descripción y promo nuevas en es-MX/en-US. Capturas `APP_IPHONE_67` (6.9") `COMPLETE`: es-MX 7, en-US 6; se borró el set 6.5" viejo. Notas: 3430 caracteres. Falta el adjunto del vídeo (U2). Capturas en `brand/product-screens/app-store-ios-0.3.1/`. Script: `scratchpad/asc/m-apply.mjs` (dry run por defecto). |
| U1 clave de Sign in with Apple | en curso (usuario) | En Vercel ya están `APPLE_TEAM_ID` y `APPLE_SIGN_IN_CLIENT_ID`. Falta registrar la clave, `APPLE_SIGN_IN_KEY_ID` y `APPLE_SIGN_IN_PRIVATE_KEY`. |
| Vídeo del iPhone (U2, parcial) | recibido | `~/Downloads/WhatsApp Video 2026-09-25 at 14.08.21.mp4` (2:50, 384×848 por la compresión de WhatsApp). El usuario pidió quitar los últimos 17 s y el audio (sonaba Spotify). Muestra el onboarding en inglés, la automatización «Pause Instagram», la pausa y la respiración (en el iPhone no hay anuncios), Hoy, Impacto y Ajustes. **Falta el login y el borrado de cuenta**, porque al borrar la cuenta salía «Your account wasn't deleted» (§13). |

## 13. Incidente: la redirección del dominio rompió la API de las apps publicadas (25-09-2026)

- **Síntoma:** en el iPhone, «Delete account and data» → «Your account wasn't deleted».
- **Causa:** en Vercel, el dominio `screen-time-monorepo-web.vercel.app` se configuró para redirigir (308) a `https://get-still.app`. Todas las builds publicadas llaman a la API en `…vercel.app` (`EXPO_PUBLIC_API_URL`). En una redirección a otro dominio, `fetch` descarta `Authorization`, así que **toda llamada autenticada** devolvía 401 «A valid bearer token is required»: borrar y exportar datos, anuncios, sesiones de acceso, votos y registro del dispositivo. Las llamadas sin sesión (`/api/v1/config`, impacto) funcionaban porque siguen la redirección sin problema.
- **Prueba:** con un usuario anónimo desechable, `/api/v1/preferences` y `/api/v1/privacy/delete` → 401 en `…vercel.app` y 200 en `get-still.app` (el borrado respondió `{"appleRevocation":"no_apple_identity"}`). `curl -sI https://screen-time-monorepo-web.vercel.app/api/v1/config` → `308`, `server: Vercel`, sin paso por el proxy de Next. La redirección no está en el código.
- **Arreglo:**
  1. **Usuario, en Vercel:** proyecto → Settings → Domains → `screen-time-monorepo-web.vercel.app` → Edit → sin redirección (servir Production). Con eso vuelven a funcionar todas las builds publicadas, incluida la 0.3.1 (13) en revisión, sin recompilar.
  2. **Código** (26c0a50, en `main`): `apps/web/proxy.ts` + `lib/canonical-host.ts` redirigen a `get-still.app` solo las páginas que lleguen por `*.vercel.app` en producción, nunca `/api/*`, `app-ads.txt` ni `.well-known`. Así se mantiene el SEO del dominio nuevo.
- **Google «didn't connect»:** Supabase devuelve bien la URL de vinculación y Google carga su pantalla de acceso. No se pudo reproducir sin una cuenta; hay que volver a probarlo en el iPhone después del paso 1.
- **Pendiente para builds futuras:** `EXPO_PUBLIC_API_URL=https://get-still.app` en EAS (producción), y las URLs de soporte, marketing y privacidad de ASC en `get-still.app`. El dominio `vercel.app` tiene que seguir sirviendo `/api` para las builds viejas.
- **Verificación, cuando el paso 1 esté hecho:**
  - `curl -sI https://screen-time-monorepo-web.vercel.app/api/v1/config` → 200.
  - La misma URL con `/privacy` → 308 a `get-still.app` (lo hace el proxy).
  - El script del usuario anónimo desechable (`signup` en Supabase + `POST /api/v1/privacy/delete` en `…vercel.app`) → 200.

## 14. Prompt para retomar

> Retoma `docs/app-store-review-plan.md` (worktree `../screen_time-app-review`, rama `fix/ios-app-review`).
> No reabras A1–A8. Estado: M1–M4 aplicados en ASC (0.3.1 build 13, capturas 6.9", notas); el envío
> `ad546c6a…` sigue en `UNRESOLVED_ISSUES`. Lee §12 y §13.
> 1. Verifica que Vercel ya no redirige la API (§13, «Verificación»). Si todavía da 308, para y
>    pídeme el cambio de dominio en Vercel.
> 2. Si ya cargué `APPLE_SIGN_IN_KEY_ID` y `APPLE_SIGN_IN_PRIVATE_KEY` en Vercel, redespliega
>    (push a `main`) y confirma que el deploy tomó las variables.
> 3. Pídeme el clip de login y borrado (Settings → Continue with Apple → Delete account and data →
>    Delete permanently → confirmar con Apple), sin audio, y que vuelva a probar Google.
> 4. Arma el vídeo: el de WhatsApp de Descargas sin los últimos 17 s + mi clip, todo sin audio
>    (`-an`). Si en el simulador vuelve a haber anuncios de prueba, suma un clip del camino con
>    anuncio con un rótulo que diga que es el simulador. Si no, quita de las notas la última frase del
>    párrafo de los anuncios. Comprime a menos de ~50 MB.
> 5. Pídeme OK y: actualiza las notas de ASC (`docs/store-listing.md`), sube el vídeo como
>    `appStoreReviewAttachment`, responde en App Review con §11.1 más el vídeo y pulsa «Resubmit to App
>    Review».
> 6. Termina cuando `reviewSubmissions` esté en `WAITING_FOR_REVIEW` con la build 0.3.1 (13) y anota
>    los resultados en §12.


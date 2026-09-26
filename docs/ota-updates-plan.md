# Actualizaciones OTA (sin versión nueva)

Fecha: 2026-09-25 · Rama: `feat/ota-updates` (en `main`) · Estado: **publicado en la build de tienda 0.3.5; faltan las pruebas en dispositivos (F5)**

## 1. Qué resuelve

Publicar cambios de JavaScript en las apps que la gente ya tiene, sin build de
tienda, sin revisión y sin subir la versión. Lo nativo (Kotlin, Swift,
librerías nativas, permisos) sigue necesitando build de tienda.

**Cuándo usar cada una:**

- `pnpm update:apps`, OTA: arreglos, textos, traducciones, estilos y ajustes
  dentro de funciones que las tiendas ya revisaron.
- `pnpm deploy:apps`, build de tienda con versión nueva: todo cambio nativo.
  También lo que las tiendas tienen que ver aunque sea JavaScript:
  - funciones o pantallas nuevas;
  - prender algo que estaba apagado;
  - la divulgación de Accesibilidad;
  - anuncios, permisos, o datos nuevos que se recolectan (por ejemplo, prender
    Sentry o PostHog).

**Reglas que respetamos** (Apple DPLA 3.3.1(B) y guía 2.5.2; Google Play,
Device and Network Abuse):

- El código interpretado se puede actualizar si no cambia el propósito de la
  app ni agrega funciones que esquiven la revisión.
- Mientras haya un envío en App Review, no mandamos OTA que toquen ese flujo.

## 2. Decisiones

| # | Decisión | Por qué |
|---|---|---|
| D1 | `runtimeVersion` = `VERSION` (texto fijo, igual a la versión) | Con `android/` e `ios/` en el repo (flujo bare), `runtimeversion:resolve` rechaza la política `appVersion`. La política `fingerprint` depende del `app.config` evaluado (variante y URLs) y de rutas de pnpm. Además, las builds `--local` no se registran en EAS, así que una huella desviada dejaría actualizaciones sin nadie que las reciba, sin avisar. Un texto es igual al compilar y al publicar |
| D2 | Guardián nativo en los scripts, no en el runtime | `ota-guard.mjs` calcula con `expo/fingerprint` la huella del código nativo: `android/` o `ios/` (con `Podfile.lock`), los módulos nativos y la versión de React Native. Deja fuera el `app.config`, los scripts de `package.json` y `eas.json`. Medido: es igual con cualquier variante o env, cambia con un `.kt` y no cambia con JS ni con `eas.json` |
| D3 | Etiquetas `store/<plataforma>/<versión>+<build>` | `deploy:apps` las crea en cada build de tienda local, con `runtime=`, `fingerprint=` y `commit=`. `update:apps` compara contra la más nueva de la versión actual |
| D4 | Canales: `production` (builds de tienda) y `preview`; ninguno en `development` | EAS escribe el canal en la copia temporal del build, también con `--local`. Nunca queda commiteado, así que un build local de QA no recibe OTA de producción |
| D5 | Al arrancar: buscar sin esperar a la red (`ON_LOAD`, espera 0) | Nunca se demora un arranque. La OTA se aplica en el siguiente arranque en frío |
| D6 | Hook `useOtaUpdates`: al volver, busca (cada hora, y siempre antes de aplicar) y aplica una OTA bajada solo en una pestaña, tras 5 min en segundo plano y en los 3 s siguientes a volver | En Android el proceso vive días junto al servicio de accesibilidad, y cerrar Still desde Recientes desmonta la pantalla sin un chequeo nuevo. Por eso el estado vive en el módulo, no en el árbol. Volver a preguntar antes de aplicar deja que un rollback o un arreglo más nuevo reemplace a la OTA bajada. Nunca aplica durante una pausa, la configuración, el selector o una pausa de Atajos pendiente. Tampoco con un navegador, inicio de sesión, hoja de Apple o borrado de cuenta en curso (`holdOtaReload`). Las hojas del sistema de iOS («inactive») no cuentan como tiempo fuera |
| D7 | Ajustes muestra «Versión 0.3.5 · de la tienda» o «· actualización xxxxxxxx» | Soporte y QA saben qué JavaScript corre cada teléfono |
| D8 | Sentry: etiquetas `expo-update-id`, `expo-channel` y `expo-runtime-version` | Hoy no hacen nada: no hay DSN en producción. Prender Sentry va por build de tienda, con los formularios de privacidad actualizados. Para simbolizar una OTA, agregar `metro.config.js` con `getSentryExpoConfig` y subir los mapas del export |

## 3. Cómo se usa

```bash
pnpm update:apps --check                 # guardián + typecheck + tests + export, sin publicar
pnpm update:apps --message "Arreglo de textos de la pausa"
pnpm update:apps android --rollout 10    # a un 10 % de los teléfonos
pnpm update:apps --rollback              # todos vuelven al JS de la build de tienda
pnpm update:apps --rollback --runtime 0.3.5   # lo mismo para una versión anterior
pnpm version:apps 0.3.6                  # sube la versión en app.config y en cada archivo nativo
```

**`update:apps` se niega si:**

- `EXPO_PUBLIC_API_URL` (env de producción de EAS) + `/api/v1/config` no
  responde 200 **sin redirección** (`apiUrlProblem` en `ota-guard.mjs`). Detrás
  de una redirección a otro host los teléfonos pierden el token y todo lo
  autenticado da 401 (app-store-review-plan §13);
- hay cambios sin commitear (incluidos los archivos sin seguimiento);
- HEAD no está en `main`;
- no hay build de tienda de la versión actual («no le llegaría a nadie»);
- HEAD no contiene el commit de esa build;
- los archivos nativos no están en la versión de `app.config.ts`;
- cambió código nativo desde esa build. La huella se calcula después de
  instalar desde el lockfile, porque mide los módulos nativos instalados. En
  ese caso lista los archivos (incluido el lockfile): hay que correr
  `pnpm version:apps <siguiente>`, commitear y correr `deploy:apps`.

**`deploy:apps`:**

- hace el mismo chequeo de la API antes de las llaves de las tiendas (también
  con `--check`);
- se niega si los archivos nativos no están en la versión de `app.config.ts`.
  La build los re-sincronizaría al vuelo y quedaría un binario con partes que
  no coinciden. Por eso la versión se sube con `version:apps`;
- antes de cada build y antes de etiquetar vuelve a comprobar el commit, que
  no haya cambios y la huella;
- revisa cada IPA/AAB: actualizaciones activas, runtime, canal `production`,
  `app.manifest` y, en iOS, la versión visible;
- `--cloud` también revisa y etiqueta;
- si falla una subida, conserva el artefacto y dice dónde está.

Antes de publicar corre typecheck y tests. Exporta con el entorno de
producción (`eas env:exec production`, `APP_VARIANT=production`,
`EXPO_NO_DOTENV=1`) y revisa que cada bundle contenga los hosts de
producción de la API y de Supabase. Buscar «localhost» no sirve: expo-router
lo deja como respaldo en todos los bundles de iOS.

**Volver atrás:**

- Error antes del primer render: `expo-updates` vuelve solo al bundle
  anterior.
- `--rollback`: `eas update:roll-back-to-embedded`, siempre compatible.
- Volver a una OTA anterior concreta: `eas update:republish --group <id>`.
- Una migración de datos se arregla hacia adelante, con otra OTA.
- Lo nativo no se arregla por OTA.

**Límites:**

- Solo las builds 0.3.5 en adelante reciben OTA.
- Cada build de tienda empieza un runtime nuevo: las OTA llegan a la última
  versión de tienda.
- TestFlight y App Store comparten el canal `production`, y lo mismo los
  tracks de Play.
- EAS Free: 1.000 usuarios al mes que bajan alguna OTA, y 100 GiB.

## 4. Fases

- [x] F1: `expo-updates` 57.0.23, con `expo-manifests` y
  `expo-updates-interface` deduplicados. Configuración nativa sincronizada
  (`configuration:syncnative`), `pod install`, canales en `eas.json` y versión
  0.3.5.
- [x] F2: `ota-policy.ts` con sus tests, el hook `useOtaUpdates`,
  `holdOtaReload` en el navegador externo y en el inicio de sesión, la línea
  de versión en Ajustes y las etiquetas de Sentry.
- [x] F3: `ota-guard.mjs`, `update-apps.mjs`, y `deploy-apps.mjs` local por
  defecto, con chequeo de artefactos y etiquetas de tienda. Tests de las partes
  puras. `native-config.test.ts` fija versión, runtime, URL y canales en cada
  archivo nativo.
- [x] F4: build de tienda 0.3.5 en los dos sistemas, etiquetas publicadas y
  `update:apps --check` en verde (resultados en §5).
- [ ] F5: en dispositivos reales, una OTA visible llega a TestFlight (iPhone,
  iOS 27) y a Play interno (Xiaomi), y Ajustes muestra el id. El rollback
  vuelve a «de la tienda». En Android, con Still en segundo plano 5 min o más,
  la OTA se aplica al volver a Hoy y la pausa nativa sigue funcionando.

## 5. Resultados

**Revisión adversarial** (dos rondas, antes de compilar):

- 13 defectos confirmados y arreglados, por ejemplo:
  - un `return` sin `await` en la recuperación de cuenta soltaba la marca y la
    excepción del navegador antes de tiempo;
  - el estado del hook se perdía al recrear la pantalla en Android;
  - la huella se calculaba antes de instalar;
  - subir solo `VERSION` desincronizaba los archivos nativos.
- La segunda ronda cerró cuatro carreras de severidad baja.

**Publicación de 0.3.5:**

| Plataforma | Build | Dónde | Etiqueta |
|---|---|---|---|
| iOS | 0.3.5 (18) | TestFlight, build local | `store/ios/0.3.5+18` (commit `cd9a99d`) |
| Android | 0.3.5 (16) | Play interno y enviada a revisión en alpha, build en la nube de EAS | `store/android/0.3.5+16` (commit `27adda6`) |

**Qué pasó con Android local:**

1. El lint de release se quedó sin Metaspace a 512m. Se subió a
   `-Xmx3072m -XX:MaxMetaspaceSize=1024m` en `gradle.properties`.
2. Un daemon de Gradle colgado bloqueó la caché.
3. El disco se llenó: 4 GB libres, 26 GB de swap.

Por eso se compiló en la nube con `deploy:apps android --cloud`, que también
revisó el AAB y lo etiquetó. Los versionCode 13 a 15 quedaron gastados en los
intentos locales.

**`pnpm update:apps --check` en `27adda6`:**

- «JavaScript only» en iOS (desde `+18`) y en Android (desde `+16`);
- typecheck y 324 tests en verde;
- el export llama a la API y a Supabase de producción.

**Primera OTA (prueba), 2026-09-26:**

- Mismo JavaScript que la build de tienda, desde `b56187a`, publicado con
  `pnpm update:apps --message "Prueba OTA: …"`.
- Grupo `c7962d5a-0b25-443b-9a70-b29db5d947c5`, canal `production`,
  runtime 0.3.5.
- Ids: iOS `01a0dbf0-ff3c-7444-…`, Android `01a0dbf0-ff3c-7027-…`.
- Un teléfono que la aplicó muestra en Ajustes «Versión 0.3.5 · actualización
  01a0dbf0».
- Queda por confirmar en dispositivos (F5).

**OTA de la API en get-still.app (2026-09-26):**

- `EXPO_PUBLIC_API_URL` de EAS (production y preview) pasó de
  `https://screen-time-monorepo-web.vercel.app` a `https://get-still.app`.
- Commits `78dd99c`, `7cfc5a5` y `c9ba5fb`, mergeados a `main`. Incluyen:
  - Borrar y descargar datos distinguen «sin conexión», «sesión rechazada»
    (401 o respuesta desde otro host) y «servidor».
  - Ajustes dice «SIN SINCRONIZAR» si hay red pero el servidor falló.
  - El onboarding ya no se traba en «Un momento…» después de borrar la cuenta.
  - Un solo inicio de sesión anónimo a la vez.
  - `expo/fetch` (el `fetch` global desde Expo 57) rechaza sin red con
    `FetchError` («fetch failed: …»), no con `TypeError`. Ahora cuenta como
    sin conexión.
- `pnpm update:apps`:
  - Guardián: API OK, «JavaScript only» desde `+18` y `+16`; el export llama a
    `get-still.app`.
  - Grupo `77dfc048-d345-4631-acf7-fac7d57cb409`, runtime 0.3.5.
  - Ids: iOS `01a0dc7e-7458-7c3f-…`, Android `01a0dc7e-7458-7bd6-…`.
  - Ajustes muestra «actualización 01a0dc7e».
- El Xiaomi (vc16 de Play) la bajó al abrir Still (`DownloadComplete`,
  `NEW_UPDATE_LOADED`); se aplica en el próximo arranque en frío.
- Verificado antes de publicar, con un build de release de ese commit en el
  emulador contra producción, usando la cuenta anónima que creó la app:
  - Ajustes «ACTUALIZADO».
  - «Descargar mis datos» abre el JSON.
  - «Eliminar cuenta y datos» vuelve al onboarding sin hoja de error, y en la
    base quedan 0 filas en `auth.users` y en `devices`.
  - Sin red: «Revisa tu conexión y vuelve a intentarlo.».
  - Después las cuentas de prueba se borraron desde la app.

**0.3.6 (2026-09-26):**

- **Builds de tienda** (local, `pnpm deploy:apps`, commit `8dfbf21`):
  - iOS 0.3.6 (19) en TestFlight, `store/ios/0.3.6+19`.
  - Android 0.3.6 (17) en Play interno y enviada a revisión en alpha,
    `store/android/0.3.6+17`.
  - La API de Play confirma internal = 17 y alpha = 17.
- **OTA** `34dc8d96-c329-4799-82c8-eb62fbcf30dc` (runtime 0.3.6, commit
  `4930aa5`):
  - En Xiaomi, el botón y el consejo del inicio automático abren la lista de
    Seguridad (`miui.intent.action.OP_AUTO_START`); HyperOS 3 no tiene ese
    interruptor en la información de la app.
  - Ids: iOS `01a0de83-8bcf-76b4-…`, Android `01a0de83-8bcf-758c-…`.
  - Ajustes muestra «actualización 01a0de83».

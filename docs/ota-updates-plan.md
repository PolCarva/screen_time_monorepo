# Actualizaciones OTA (sin versión nueva)

Fecha: 2026-09-25 · Rama: `feat/ota-updates` · Estado: **implementado; se estrena con la build de tienda 0.3.5**

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
| D6 | Hook `useOtaUpdates`: al volver, busca (como mucho cada hora) y aplica una OTA bajada solo en una pestaña, tras 5 min fuera | En Android el proceso vive días junto al servicio de accesibilidad. Nunca aplica durante una pausa, la configuración, el selector, una pausa de Atajos pendiente o un navegador o inicio de sesión abierto (`holdOtaReload`) |
| D7 | Ajustes muestra «Versión 0.3.5 · de la tienda» o «· actualización xxxxxxxx» | Soporte y QA saben qué JavaScript corre cada teléfono |
| D8 | Sentry: etiquetas `expo-update-id`, `expo-channel` y `expo-runtime-version` | Hoy no hacen nada: no hay DSN en producción. Prender Sentry va por build de tienda, con los formularios de privacidad actualizados. Para simbolizar una OTA, agregar `metro.config.js` con `getSentryExpoConfig` y subir los mapas del export |

## 3. Cómo se usa

```bash
pnpm update:apps --check                 # guardián + typecheck + tests + export, sin publicar
pnpm update:apps --message "Arreglo de textos de la pausa"
pnpm update:apps android --rollout 10    # a un 10 % de los teléfonos
pnpm update:apps --rollback              # todos vuelven al JS de la build de tienda
```

**`update:apps` se niega si:**

- hay cambios sin commitear (incluidos los archivos sin seguimiento);
- HEAD no está en `main`;
- no hay build de tienda de la versión actual («no le llegaría a nadie»);
- HEAD no contiene el commit de esa build;
- cambió código nativo desde esa build. En ese caso lista los archivos: hay
  que subir `VERSION` y correr `deploy:apps`.

Antes de publicar corre typecheck y tests. Exporta con el entorno de
producción (`eas env:exec production`, `APP_VARIANT=production`,
`EXPO_NO_DOTENV=1`) y revisa que el bundle no llame a `localhost:3000`,
`10.0.2.2` ni `127.0.0.1`.

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
- [ ] F4: build de tienda 0.3.5 en los dos sistemas, etiquetas publicadas y
  `update:apps --check` en verde (resultados en §5).
- [ ] F5: en dispositivos reales, una OTA visible llega a TestFlight (iPhone,
  iOS 27) y a Play interno (Xiaomi), y Ajustes muestra el id. El rollback
  vuelve a «de la tienda». En Android, con Still en segundo plano 5 min o más,
  la OTA se aplica al volver a Hoy y la pausa nativa sigue funcionando.

## 5. Resultados

Se completa al publicar 0.3.5.

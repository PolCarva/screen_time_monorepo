import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  AppState,
  Linking,
  Platform,
  StyleSheet,
  View,
} from "react-native";

import { FieldApertureMark } from "@/components/field-aperture-mark";
import { PrimaryButton } from "@/components/primary-button";
import { Screen } from "@/components/screen";
import type { GuideImageId } from "@/components/shortcut-guide-assets";
import { ShortcutGuideImage } from "@/components/shortcut-guide-image";
import {
  ShortcutStepVisual,
  type ShortcutStepVisualVariant,
} from "@/components/shortcut-step-visual";
import { Body, Eyebrow, Heading, Mono } from "@/components/typography";
import { localize } from "@/i18n";
import {
  type GuideLink,
  IOS_SHORTCUT_IMPORT_URL,
  SHORTCUTS_APP_URL,
  SHORTCUTS_CREATE_AUTOMATION_URL,
  type SetupStepId,
  type SetupTier,
  guideLinkUrl,
  guideSteps,
  probeResult,
  resolveSetupTier,
} from "@/lib/ios-shortcut-setup";
import { isPauseFeatureEnabled } from "@/lib/restriction-mode";
import {
  type ShortcutTarget,
  activeTargets,
  catalogSchemeFor,
  returnShortcutName,
} from "@/lib/shortcut-targets";
import { getJson, setJson } from "@/lib/storage";
import { restrictionEngine } from "@/native/restriction-engine";
import { useAppState } from "@/state/app-state";
import { useShortcutTargets } from "@/state/shortcut-targets";
import { colors, spacing } from "@/theme/tokens";

const PREFER_PER_APP_KEY = "iosSetupPreferPerApp";

type StepCopy = {
  title: string;
  body: string;
  /** Drawn mock-up, only for the tiers that have no real captures yet. */
  visual?: ShortcutStepVisualVariant;
  visualLabel: string;
};

function stepCopy(
  id: SetupStepId,
  appName: string,
  schemelessName: string,
): StepCopy {
  switch (id) {
    case "import_add":
      return {
        visual: "import",
        title: localize("Add the shortcut", "Añade el atajo"),
        body: localize(
          "Tap “Add to Shortcuts” below, then “Add Shortcut”. It already contains everything Still needs.",
          "Toca «Añadir a Atajos» aquí abajo y luego «Añadir atajo». Ya trae todo lo que Still necesita.",
        ),
        visualLabel: localize(
          "Image of the Add Shortcut sheet for Still - Pausa.",
          "Imagen de la hoja Añadir atajo para Still - Pausa.",
        ),
      };
    case "import_choose_apps":
      return {
        visual: "trigger-multi",
        title: localize("Choose the same apps", "Elige las mismas apps"),
        body: localize(
          "In the shortcut, tap the app list next to “When” and pick the apps you chose in Still.",
          "En el atajo, toca la lista de apps junto a «Cuando» y marca las apps que elegiste en Still.",
        ),
        visualLabel: localize(
          "Image of an automation trigger listing your chosen apps.",
          "Imagen de un disparador de automatización con tus apps elegidas.",
        ),
      };
    case "import_enable":
      return {
        visual: "toggle",
        title: localize("Turn it on", "Actívalo"),
        body: localize(
          "iOS adds shared automations switched off. Flip the switch at the top of the shortcut, then come back to Still.",
          "iOS añade las automatizaciones compartidas apagadas. Activa el interruptor de arriba del atajo y vuelve a Still.",
        ),
        visualLabel: localize(
          "Image of the automation switch turned on.",
          "Imagen del interruptor de la automatización activado.",
        ),
      };
    case "select_all_apps":
      return {
        title: localize("Check every app you want", "Marca todas las apps que quieras"),
        body: localize(
          "This is the list of the apps really installed on your iPhone. Check as many as you like (the picture shows one), then tap the blue check mark. Nothing to type: each app shows up in Still by itself the first time you open it.",
          "Esta es la lista de las apps realmente instaladas en tu iPhone. Marca todas las que quieras (la imagen muestra una) y toca el check azul. No hay que escribir nada: cada app aparece sola en Still la primera vez que la abras.",
        ),
        visualLabel: localize(
          "Shortcuts' Choose App list with an app checked and the confirm button highlighted.",
          "Lista Choose App de Atajos con una app marcada y el botón de confirmar resaltado.",
        ),
      };
    case "add_current_app":
      return {
        title: localize("Add “Get Current App”", "Añade «Get Current App»"),
        body: localize(
          "Tap “Search Actions”, type Get Current App and tap it. It tells Still which of your apps was opened.",
          "Toca «Search Actions», escribe Get Current App y tócala. Le dice a Still cuál de tus apps se abrió.",
        ),
        visualLabel: localize(
          "Shortcuts' action search with Get Current App typed and its result highlighted.",
          "Búsqueda de acciones de Atajos con Get Current App escrito y su resultado resaltado.",
        ),
      };
    case "open_variables":
      return {
        title: localize("Tap “App name”, then “Variables…”", "Toca «App name» y luego «Variables…»"),
        body: localize(
          "Do not pick an app from the list here. Tap “Variables…” at the top of the menu.",
          "Aquí no elijas una app de la lista. Toca «Variables…», arriba del menú.",
        ),
        visualLabel: localize(
          "Still's action with its App name menu open and Variables highlighted.",
          "Acción de Still con el menú App name abierto y Variables resaltado.",
        ),
      };
    case "pick_current_app":
      return {
        title: localize("Choose “Current App”", "Elige «Current App»"),
        body: localize(
          "It is the last item, with the purple icon.",
          "Es el último elemento, con el icono morado.",
        ),
        visualLabel: localize(
          "The variables menu with Current App highlighted.",
          "Menú de variables con Current App resaltado.",
        ),
      };
    case "check_result":
      return {
        title: localize("Check it and save", "Compruébalo y guarda"),
        body: localize(
          "It must look exactly like this: “Get Current app” and, below it, “Pause before opening Current App”. Then tap the blue check mark at the top right and come back to Still.",
          "Debe verse exactamente así: «Get Current app» y, debajo, «Pause before opening Current App». Después toca el check azul de arriba a la derecha y vuelve a Still.",
        ),
        visualLabel: localize(
          "The finished automation: Get Current App followed by Pause before opening Current App.",
          "La automatización terminada: Get Current App seguido de Pause before opening Current App.",
        ),
      };
    case "pick_app_trigger":
      return {
        title: localize("Find “App”", "Busca «App»"),
        body: localize(
          "Tap the picture: Shortcuts opens on this list. Type App in the search bar at the bottom, then tap the App row.",
          "Toca la imagen: Atajos se abre en esta lista. Escribe App en el buscador de abajo y toca la fila App.",
        ),
        visualLabel: localize(
          "Shortcuts' Personal Automation list with App typed in the search bar and the App row highlighted.",
          "Lista Automatización personal de Atajos con App escrito en el buscador y la fila App resaltada.",
        ),
      };
    case "tap_choose":
      return {
        title: localize("Tap “Choose”", "Toca «Choose»"),
        body: localize(
          "It is the blue word on the right of the App row.",
          "Es la palabra azul a la derecha de la fila App.",
        ),
        visualLabel: localize(
          "Shortcuts' When screen with the blue Choose button highlighted.",
          "Pantalla When de Atajos con el botón azul Choose resaltado.",
        ),
      };
    case "select_app":
      return {
        title: localize(`Check ${appName}`, `Marca ${appName}`),
        body: localize(
          `Tap ${appName} in the list${appName === "News" ? "" : " (the picture shows News as an example)"}, then the blue check mark at the top right. Only one app per automation.`,
          `Toca ${appName} en la lista${appName === "News" ? "" : " (la imagen muestra News como ejemplo)"} y luego el check azul de arriba a la derecha. Solo una app por automatización.`,
        ),
        visualLabel: localize(
          "Shortcuts' Choose App list with one app checked and the confirm button highlighted.",
          "Lista Choose App de Atajos con una app marcada y el botón de confirmar resaltado.",
        ),
      };
    case "run_immediately":
      return {
        title: localize("Run Immediately", "Run Immediately"),
        body: localize(
          "Tap “Run Immediately”, make sure “Notify When Run” stays off, then tap Next. Leave “Is Opened” checked.",
          "Toca «Run Immediately», deja «Notify When Run» apagado y toca Next. Deja «Is Opened» marcado.",
        ),
        visualLabel: localize(
          "Shortcuts' run options with Run Immediately, the Notify When Run switch and Next highlighted in order.",
          "Opciones de ejecución de Atajos con Run Immediately, el interruptor Notify When Run y Next resaltados en orden.",
        ),
      };
    case "create_new_shortcut":
      return {
        title: localize("Create New Shortcut", "Create New Shortcut"),
        body: localize(
          "Tap the first tile. Do not pick anything from the lists below it.",
          "Toca el primer recuadro. No elijas nada de las listas de abajo.",
        ),
        visualLabel: localize(
          "Shortcuts' Get Started row with the Create New Shortcut tile highlighted.",
          "Fila Get Started de Atajos con el recuadro Create New Shortcut resaltado.",
        ),
      };
    case "search_actions":
      return {
        title: localize("Search for Still", "Busca Still"),
        body: localize(
          "Tap “Search Actions” and type Still.",
          "Toca «Search Actions» y escribe Still.",
        ),
        visualLabel: localize(
          "Shortcuts' editor with the Search Actions bar highlighted.",
          "Editor de Atajos con la barra Search Actions resaltada.",
        ),
      };
    case "add_still_action":
      return {
        title: localize("Pause Before Opening", "Pause Before Opening"),
        body: localize(
          "Tap “Pause Before Opening”. This is the step that connects the app to Still; an automation that says “No actions” is missing it.",
          "Toca «Pause Before Opening». Este es el paso que conecta la app con Still; si una automatización dice «No actions», le falta esto.",
        ),
        visualLabel: localize(
          "Shortcuts' search results for Still with the Pause Before Opening action highlighted.",
          "Resultados de búsqueda de Still en Atajos con la acción Pause Before Opening resaltada.",
        ),
      };
    case "pick_app_name":
      return {
        title: localize(`Pick ${appName}`, `Elige ${appName}`),
        body: localize(
          `Tap the blue “App name” and choose ${appName} from the list. It shows the apps you chose in Still, so there is nothing to type.`,
          `Toca el «App name» azul y elige ${appName} en la lista. Muestra las apps que elegiste en Still, así que no hay que escribir nada.`,
        ),
        visualLabel: localize(
          "Still's action with its App name list open and the first app highlighted.",
          "Acción de Still con la lista App name abierta y la primera app resaltada.",
        ),
      };
    case "save_automation":
      return {
        title: localize("Save it", "Guárdala"),
        body: localize(
          "Tap the blue check mark at the top right, then come back to Still and test it below.",
          "Toca el check azul de arriba a la derecha, vuelve a Still y pruébala aquí abajo.",
        ),
        visualLabel: localize(
          "The finished automation with the blue check mark highlighted.",
          "La automatización terminada con el check azul resaltado.",
        ),
      };
    case "return_open_app":
      return {
        title: localize(
          `A way back to ${schemelessName}`,
          `Un camino de vuelta a ${schemelessName}`,
        ),
        body: localize(
          `Optional. Still cannot reopen ${schemelessName} by itself: without this, after the ad it sends you to the Home Screen and you open ${schemelessName} yourself, with no pause. With this small shortcut it opens for you. Tap the picture to start a new shortcut, then tap “Open App”.`,
          `Opcional. Still no puede reabrir ${schemelessName} por sí solo: sin esto, tras el anuncio te lleva a la pantalla de inicio y abres ${schemelessName} tú, ya sin pausa. Con este atajo pequeño se abre sola. Toca la imagen para empezar un atajo nuevo y luego toca «Open App».`,
        ),
        visualLabel: localize(
          "Shortcuts' action list with Open App highlighted.",
          "Lista de acciones de Atajos con Open App resaltada.",
        ),
      };
    case "return_choose_app":
      return {
        title: localize(`Choose ${schemelessName}`, `Elige ${schemelessName}`),
        body: localize(
          `Tap the blue “App” and pick ${schemelessName}. Then tap the shortcut's name at the top.`,
          `Toca el «App» azul y elige ${schemelessName}. Después toca el nombre del atajo, arriba.`,
        ),
        visualLabel: localize(
          "The Open App action with the App field and the shortcut's name highlighted in order.",
          "Acción Open App con el campo App y el nombre del atajo resaltados en orden.",
        ),
      };
    case "return_rename":
      return {
        title: localize("Name it exactly", "Ponle el nombre exacto"),
        body: localize(
          `Tap Rename and type exactly “${returnShortcutName(schemelessName)}”. The first time it runs, iOS asks whether the shortcut may output an app: choose “Always Allow”.`,
          `Toca Rename y escribe exactamente «${returnShortcutName(schemelessName)}». La primera vez que se ejecute, iOS preguntará si el atajo puede devolver una app: elige «Always Allow».`,
        ),
        visualLabel: localize(
          "The shortcut's menu with Rename highlighted.",
          "Menú del atajo con Rename resaltado.",
        ),
      };
  }
}

function linkLabel(link: GuideLink) {
  switch (link) {
    case "create_automation":
      return localize(
        "Tap to open this exact screen in Shortcuts",
        "Toca para abrir esta misma pantalla en Atajos",
      );
    case "create_shortcut":
      return localize(
        "Tap to start a new shortcut in Shortcuts",
        "Toca para empezar un atajo nuevo en Atajos",
      );
    case "automations":
      return localize(
        "Tap to open your automations in Shortcuts",
        "Toca para abrir tus automatizaciones en Atajos",
      );
    case "resume":
      return localize(
        "Tap to go back to Shortcuts where you left off",
        "Toca para volver a Atajos donde lo dejaste",
      );
  }
}

function tierLede(tier: SetupTier) {
  switch (tier) {
    case "import":
      return localize(
        "One shortcut, added with a tap. Shortcuts tells Still when you open one of your apps.",
        "Un solo atajo, añadido con un toque. Atajos avisa a Still cuando abres una de tus apps.",
      );
    case "single_automation":
      return localize(
        "One automation covers every app, and you pick them from the real apps on your iPhone inside Shortcuts. Every step below is a real picture with the button to tap marked; tap a picture to jump there, and use “◀ Still” at the top left of Shortcuts to come back.",
        "Una sola automatización cubre todas las apps, y las eliges entre las apps reales de tu iPhone dentro de Atajos. Cada paso de abajo es una foto real con el botón marcado; toca una foto para saltar allí y usa «◀ Still», arriba a la izquierda en Atajos, para volver.",
      );
    case "per_app":
      return localize(
        "Each app gets one automation. Every step below is a real picture of Shortcuts with the button to tap marked; tap a picture to jump there, and use “◀ Still” at the top left of Shortcuts to come back.",
        "Cada app lleva una automatización. Cada paso de abajo es una foto real de Atajos con el botón marcado; toca una foto para saltar allí y usa «◀ Still», arriba a la izquierda en Atajos, para volver.",
      );
  }
}

export default function ShortcutSetupScreen() {
  const { tested, onboarding } = useLocalSearchParams<{
    tested?: string;
    onboarding?: string;
  }>();
  const { targets, health, refresh, disableScheme, restoreScheme } =
    useShortcutTargets();
  const { config } = useAppState();
  const pausesEnabled = isPauseFeatureEnabled(Platform.OS, config);
  const [probe, setProbe] = useState<{ id: string; startedAt: number } | null>(
    null,
  );
  const [now, setNow] = useState(() => Date.now());

  const chosen = activeTargets(targets);
  const schemeless = chosen.filter((target) => !target.urlScheme);
  const [preferPerApp, setPreferPerApp] = useState(false);
  useEffect(() => {
    void getJson<boolean>(PREFER_PER_APP_KEY, false)
      .then(setPreferPerApp)
      .catch(() => undefined);
  }, []);
  const bestTier = resolveSetupTier({ iosVersion: Platform.Version });
  const tier = resolveSetupTier({ iosVersion: Platform.Version, preferPerApp });
  const steps = guideSteps(tier, {
    needsReturnShortcut: schemeless.length > 0,
  });
  const exampleName = chosen[0]?.name ?? "YouTube";
  const schemelessName = schemeless[0]?.name ?? exampleName;

  useEffect(() => {
    // Coming back from Shortcuts or from the app under test: look again.
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      setNow(Date.now());
      void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const probing = probe
    ? probeResult({
        startedAt: probe.startedAt,
        lastTriggeredAt: health[probe.id]?.lastTriggeredAt,
        now,
      })
    : null;

  useEffect(() => {
    if (probing !== "waiting") return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [probing]);

  async function open(url: string) {
    try {
      await Linking.openURL(url);
      return;
    } catch {
      // Two of the jump links are undocumented; plain Shortcuts is the fallback.
    }
    try {
      if (url !== SHORTCUTS_APP_URL) {
        await Linking.openURL(SHORTCUTS_APP_URL);
        return;
      }
    } catch {
      // Fall through to the manual instruction.
    }
    Alert.alert(
      localize("Could not open Shortcuts", "No se pudo abrir Atajos"),
      localize(
        "Open Apple's Shortcuts app and select Automation.",
        "Abre la app Atajos de Apple y elige Automatización.",
      ),
    );
  }

  async function test(target: ShortcutTarget) {
    await restrictionEngine
      .beginShortcutSetupProbe(target.name)
      .catch(() => undefined);
    setProbe({ id: target.id, startedAt: Date.now() });
    setNow(Date.now());
    // A test also retries a scheme that was switched off earlier, so one
    // transient failure does not cost the direct return forever.
    const scheme = target.urlScheme ?? catalogSchemeFor(target);
    if (scheme) {
      try {
        await Linking.openURL(scheme);
        if (!target.urlScheme) await restoreScheme(target.id);
        return;
      } catch {
        // This scheme does not open here: return through the shortcut instead.
        if (target.urlScheme) await disableScheme(target.id);
      }
    }
    Alert.alert(
      localize(`Now open ${target.name}`, `Ahora abre ${target.name}`),
      localize(
        `Go to your Home Screen and open ${target.name}. If the automation works, Still comes back by itself.`,
        `Ve a tu pantalla de inicio y abre ${target.name}. Si la automatización funciona, Still vuelve solo.`,
      ),
    );
  }

  function status(target: ShortcutTarget) {
    if (probe?.id === target.id && probing === "waiting")
      return {
        tone: "pending" as const,
        label: localize("Waiting for the automation…", "Esperando a la automatización…"),
      };
    if (probe?.id === target.id && probing === "not_detected")
      return {
        tone: "failed" as const,
        label: localize(
          "Still did not see the automation run.",
          "Still no vio ejecutarse la automatización.",
        ),
      };
    if (health[target.id]?.verifiedAt)
      return {
        tone: "ok" as const,
        label: localize("Connected", "Conectada"),
      };
    return {
      tone: "idle" as const,
      label: localize("Not tested yet", "Sin probar todavía"),
    };
  }

  const connected = chosen.filter((target) => health[target.id]?.verifiedAt);

  return (
    <Screen contentContainerStyle={styles.screen}>
      <View style={styles.topline}>
        <FieldApertureMark size={34} />
        <Eyebrow>{localize("IOS / SHORTCUTS", "IOS / ATAJOS")}</Eyebrow>
      </View>

      <View style={styles.header}>
        <Heading style={styles.title}>
          {localize("Connect Shortcuts.", "Conecta Atajos.")}
        </Heading>
        <Body style={styles.lede}>{tierLede(tier)}</Body>
      </View>

      {pausesEnabled ? null : (
        <View accessibilityLiveRegion="polite" style={styles.note}>
          <Eyebrow>{localize("PAUSED", "EN PAUSA")}</Eyebrow>
          <Body style={styles.stepBody}>
            {localize(
              "Pauses are temporarily switched off for iPhone, so a test cannot succeed right now. You can still prepare the automation; it starts working when pauses are back.",
              "Las pausas están apagadas temporalmente en iPhone, así que ahora una prueba no puede funcionar. Puedes dejar lista la automatización; empezará a funcionar cuando vuelvan las pausas.",
            )}
          </Body>
        </View>
      )}

      {tested ? (
        <View accessibilityLiveRegion="polite" style={styles.banner}>
          <Eyebrow style={styles.bannerLabel}>
            {localize("CONNECTED", "CONECTADA")}
          </Eyebrow>
          <Body style={styles.bannerBody}>
            {localize(
              `${tested} now pauses in Still before it opens.`,
              `${tested} ahora hace una pausa en Still antes de abrirse.`,
            )}
          </Body>
        </View>
      ) : null}

      {chosen.length === 0 && tier === "per_app" ? (
        <View style={styles.note}>
          <Eyebrow>{localize("FIRST", "PRIMERO")}</Eyebrow>
          <Body style={styles.stepBody}>
            {localize(
              "Choose the apps you want Still to pause.",
              "Elige las apps que quieres que Still pause.",
            )}
          </Body>
          <PrimaryButton
            onPress={() => router.push("/ios-apps")}
            variant="signal"
          >
            {localize("Choose apps", "Elegir apps")}
          </PrimaryButton>
        </View>
      ) : (
        <>
          <View style={styles.steps}>
            {steps.map((step, index) => {
              const copy = stepCopy(step.id, exampleName, schemelessName);
              return (
                <View key={step.id} style={styles.step}>
                  <View style={styles.stepHeading}>
                    <Mono>{String(index + 1).padStart(2, "0")}</Mono>
                    <Heading style={styles.stepTitle}>{copy.title}</Heading>
                  </View>
                  <Body style={styles.stepBody}>{copy.body}</Body>
                  {step.image ? (
                    <ShortcutGuideImage
                      accessibilityLabel={copy.visualLabel}
                      actionLabel={linkLabel(step.link)}
                      image={step.image as GuideImageId}
                      onPress={() => void open(guideLinkUrl(step.link))}
                    />
                  ) : copy.visual ? (
                    <ShortcutStepVisual
                      accessibilityLabel={copy.visualLabel}
                      appName={exampleName}
                      appNames={chosen.map((target) => target.name)}
                      variant={copy.visual}
                    />
                  ) : null}
                </View>
              );
            })}
          </View>

          <View style={styles.actions}>
            {tier === "import" ? (
              <PrimaryButton
                onPress={() => void open(IOS_SHORTCUT_IMPORT_URL)}
                variant="signal"
              >
                {localize("Add to Shortcuts", "Añadir a Atajos")}
              </PrimaryButton>
            ) : (
              <PrimaryButton
                onPress={() => void open(SHORTCUTS_CREATE_AUTOMATION_URL)}
                variant="signal"
              >
                {localize("Start a new automation", "Empezar una automatización")}
              </PrimaryButton>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <Eyebrow>{localize("TRY IT", "PRUÉBALO")}</Eyebrow>
              <Mono>
                {connected.length}/{chosen.length}
              </Mono>
            </View>
            <Body style={styles.stepBody}>
              {localize(
                "iOS cannot tell Still whether an automation exists, so the only proof is opening the app. A test never counts as an opening and never shows an ad.",
                "iOS no puede decirle a Still si una automatización existe, así que la única prueba es abrir la app. Una prueba nunca cuenta como apertura ni muestra anuncios.",
              )}
            </Body>
            {chosen.length === 0 ? (
              <Body style={styles.stepBody}>
                {localize(
                  "Nothing to test yet. Once the automation is saved, open one of the apps you checked: it appears here by itself.",
                  "Todavía no hay nada que probar. Cuando guardes la automatización, abre una de las apps que marcaste: aparecerá aquí sola.",
                )}
              </Body>
            ) : null}
            {chosen.map((target) => {
              const state = status(target);
              return (
                <View key={target.id} style={styles.testRow}>
                  <View style={styles.testCopy}>
                    <Body style={styles.testName}>{target.name}</Body>
                    <Body
                      accessibilityLiveRegion="polite"
                      style={[
                        styles.testStatus,
                        state.tone === "ok" && styles.ok,
                        state.tone === "failed" && styles.failed,
                      ]}
                    >
                      {state.label}
                    </Body>
                  </View>
                  {state.tone === "failed" ? (
                    <PrimaryButton
                      onPress={() => router.push("/shortcut-repair")}
                      variant="secondary"
                    >
                      {localize("Repair", "Reparar")}
                    </PrimaryButton>
                  ) : (
                    <PrimaryButton
                      disabled={state.tone === "pending" || !pausesEnabled}
                      onPress={() => void test(target)}
                      variant={state.tone === "ok" ? "quiet" : "secondary"}
                    >
                      {state.tone === "ok"
                        ? localize("Test again", "Probar otra vez")
                        : localize("Test", "Probar")}
                    </PrimaryButton>
                  )}
                </View>
              );
            })}
          </View>
        </>
      )}

      <View style={styles.note}>
        <Eyebrow>{localize("GOOD TO KNOW", "CONVIENE SABER")}</Eyebrow>
        <Body style={styles.stepBody}>
          {localize(
            "The app you open appears for an instant before Still: iOS starts it first and runs the automation right after. After restarting your iPhone, automations take about two minutes to wake up.",
            "La app que abres se ve un instante antes que Still: iOS la inicia primero y ejecuta la automatización justo después. Tras reiniciar el iPhone, las automatizaciones tardan unos dos minutos en despertar.",
          )}
        </Body>
        <Body style={styles.stepBody}>
          {localize(
            "Still has to come to the front because iOS does not allow an ad inside an automation.",
            "Still tiene que pasar al frente porque iOS no permite mostrar un anuncio dentro de una automatización.",
          )}
        </Body>
      </View>

      <View style={styles.actions}>
        {bestTier === "single_automation" ? (
          <PrimaryButton
            onPress={() => {
              setPreferPerApp(!preferPerApp);
              void setJson(PREFER_PER_APP_KEY, !preferPerApp);
            }}
            variant="quiet"
          >
            {preferPerApp
              ? localize(
                  "Use one automation for all apps",
                  "Usar una sola automatización para todas",
                )
              : localize(
                  "It didn't work? Set up one app at a time",
                  "¿No funcionó? Configurar una app a la vez",
                )}
          </PrimaryButton>
        ) : null}
        <PrimaryButton
          onPress={() => router.push("/ios-apps")}
          variant="secondary"
        >
          {localize("Edit apps", "Editar apps")}
        </PrimaryButton>
        <PrimaryButton
          onPress={() => router.push("/shortcut-repair")}
          variant="quiet"
        >
          {localize("Something is not working", "Algo no funciona")}
        </PrimaryButton>
        <PrimaryButton
          onPress={() =>
            router.replace(onboarding ? "/(tabs)/(today)" : "/(tabs)/(settings)")
          }
          variant="quiet"
        >
          {localize("Done", "Listo")}
        </PrimaryButton>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { minHeight: 760, gap: spacing.xl },
  topline: {
    minHeight: 58,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  header: { gap: spacing.lg },
  title: { fontSize: 30, lineHeight: 33 },
  lede: { color: colors.graphiteSoft },
  banner: {
    padding: spacing.lg,
    gap: spacing.xs,
    backgroundColor: colors.graphite,
  },
  bannerLabel: { color: colors.mineralLight },
  bannerBody: { color: colors.chalk },
  steps: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.fog },
  step: {
    paddingVertical: spacing.lg,
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
  },
  stepHeading: { flexDirection: "row", alignItems: "baseline", gap: spacing.md },
  stepTitle: { fontSize: 18, lineHeight: 22 },
  stepBody: { color: colors.graphiteSoft, fontSize: 14, lineHeight: 21 },
  section: { gap: spacing.md },
  sectionHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  testRow: {
    minHeight: 64,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
  },
  testCopy: { flex: 1, gap: 2 },
  testName: { fontSize: 16 },
  testStatus: { color: colors.graphiteSoft, fontSize: 12, lineHeight: 17 },
  ok: { color: colors.success },
  failed: { color: colors.danger },
  note: {
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.chalkRaised,
  },
  actions: { gap: spacing.md },
});

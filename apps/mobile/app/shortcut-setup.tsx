import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { AppState, Linking, Platform, StyleSheet, View } from "react-native";

import { FieldApertureMark } from "@/components/field-aperture-mark";
import { EXAMPLE_APP, FAKE_APP } from "@/components/guide/app-icons";
import { GuideCard } from "@/components/guide/guide-card";
import { SHORTCUTS_SCREENS } from "@/components/guide/ios-shortcuts-screens";
import { PrimaryButton } from "@/components/primary-button";
import { Screen } from "@/components/screen";
import { gotItAction, useStillSheet } from "@/components/still-sheet";
import {
  ShortcutStepVisual,
  type ShortcutStepVisualVariant,
} from "@/components/shortcut-step-visual";
import { Body, Eyebrow, Heading, Mono } from "@/components/typography";
import { localize, sys } from "@/i18n";
import {
  type GuideLink,
  type GuideStep,
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
import { offerShortcutsInstall } from "@/lib/shortcuts-app";
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

/** A Shortcuts label quoted the way each language quotes: “Next”, «Siguiente». */
function q(label: string) {
  return localize(`“${label}”`, `«${label}»`);
}

/**
 * One step = one action. The title is the button to tap, quoted exactly as
 * Shortcuts shows it on this phone; the example is always Instagram (or Tilo,
 * the made-up app of the custom-app steps). docs/ui-clarity-plan.md §4.5.
 */
function stepCopy(id: SetupStepId): StepCopy {
  const example = EXAMPLE_APP.name;
  const fake = FAKE_APP.name;
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
    case "pick_app_trigger":
      return {
        title: localize(`Find ${q(sys("app"))}`, `Busca ${q(sys("app"))}`),
        body: localize(
          `Tap the picture to open Shortcuts. Type ${sys("app")} in the search bar and tap ${sys("app")}.`,
          `Toca la imagen para abrir Atajos. Escribe ${sys("app")} en el buscador y toca ${sys("app")}.`,
        ),
        visualLabel: localize(
          `${sys("personalAutomation")} in Shortcuts, with ${sys("app")} typed in the search bar and the ${sys("app")} row marked.`,
          `${sys("personalAutomation")} en Atajos, con ${sys("app")} escrito en el buscador y la fila ${sys("app")} marcada.`,
        ),
      };
    case "tap_choose":
      return {
        title: localize(`Tap ${q(sys("choose"))}`, `Toca ${q(sys("choose"))}`),
        body: localize(
          `It's to the right of ${sys("app")}.`,
          `Está a la derecha de ${sys("app")}.`,
        ),
        visualLabel: localize(
          `The ${sys("when")} screen with ${sys("choose")} marked.`,
          `La pantalla ${sys("when")} con ${sys("choose")} marcado.`,
        ),
      };
    case "select_all_apps":
      return {
        title: localize("Check your apps", "Marca tus apps"),
        body: localize(
          `Check the apps you want to pause (${example} in the picture) and tap the blue ✓.`,
          `Marca las apps que quieres pausar (en la imagen, ${example}) y toca el ✓ azul.`,
        ),
        visualLabel: localize(
          `${sys("chooseApp")} with ${example} checked and the blue check mark marked.`,
          `${sys("chooseApp")} con ${example} marcada y el ✓ azul marcado.`,
        ),
      };
    case "select_app":
      return {
        title: localize("Check the app", "Marca la app"),
        body: localize(
          `Check the app you want to pause (${example} in the picture) and tap the blue ✓.`,
          `Marca la app que quieres pausar (en la imagen, ${example}) y toca el ✓ azul.`,
        ),
        visualLabel: localize(
          `${sys("chooseApp")} with ${example} checked and the blue check mark marked.`,
          `${sys("chooseApp")} con ${example} marcada y el ✓ azul marcado.`,
        ),
      };
    case "run_immediately":
      return {
        title: localize(
          `Tap ${q(sys("runImmediately"))}`,
          `Toca ${q(sys("runImmediately"))}`,
        ),
        body: localize(
          `Leave ${q(sys("notifyWhenRun"))} off and tap ${q(sys("next"))}.`,
          `Deja ${q(sys("notifyWhenRun"))} apagado y toca ${q(sys("next"))}.`,
        ),
        visualLabel: localize(
          `${sys("runImmediately")}, the ${sys("notifyWhenRun")} switch and ${sys("next")}, marked in order.`,
          `${sys("runImmediately")}, el interruptor ${sys("notifyWhenRun")} y ${sys("next")}, marcados en orden.`,
        ),
      };
    case "create_new_shortcut":
      return {
        title: localize(
          `Tap ${q(sys("createNewShortcut"))}`,
          `Toca ${q(sys("createNewShortcut"))}`,
        ),
        body: localize("It's the first tile.", "Es el primer recuadro."),
        visualLabel: localize(
          `The ${sys("createNewShortcut")} tile marked.`,
          `El recuadro ${sys("createNewShortcut")} marcado.`,
        ),
      };
    case "add_current_app":
      return {
        title: localize(
          `Tap ${q(sys("getCurrentAppAction"))}`,
          `Toca ${q(sys("getCurrentAppAction"))}`,
        ),
        body: localize(
          `Type it in ${q(sys("searchActions"))} and tap the result.`,
          `Escríbelo en ${q(sys("searchActions"))} y toca el resultado.`,
        ),
        visualLabel: localize(
          `${sys("getCurrentAppAction")} typed in the action search, with its result marked.`,
          `${sys("getCurrentAppAction")} escrito en la búsqueda de acciones, con su resultado marcado.`,
        ),
      };
    case "search_actions":
      return {
        title: localize("Search for Still", "Busca Still"),
        body: localize(
          `Tap ${q(sys("searchActions"))} and type Still.`,
          `Toca ${q(sys("searchActions"))} y escribe Still.`,
        ),
        visualLabel: localize(
          `The editor with ${sys("searchActions")} marked.`,
          `El editor con ${sys("searchActions")} marcado.`,
        ),
      };
    case "add_still_action":
      return {
        title: localize(`Tap ${q(sys("stillAction"))}`, `Toca ${q(sys("stillAction"))}`),
        body: localize("It's Still's action.", "Es la acción de Still."),
        visualLabel: localize(
          `Search results for Still with ${sys("stillAction")} marked.`,
          `Resultados de búsqueda de Still con ${sys("stillAction")} marcada.`,
        ),
      };
    case "open_variables":
      return {
        title: localize(
          `Tap ${q(sys("appNameParam"))}, then ${q(sys("variables"))}`,
          `Toca ${q(sys("appNameParam"))} y luego ${q(sys("variables"))}`,
        ),
        body: localize(
          `${q(sys("variables"))} is at the top of the menu.`,
          `${q(sys("variables"))} está arriba del menú.`,
        ),
        visualLabel: localize(
          `Still's action with its ${sys("appNameParam")} menu open and ${sys("variables")} marked.`,
          `La acción de Still con el menú ${sys("appNameParam")} abierto y ${sys("variables")} marcado.`,
        ),
      };
    case "pick_current_app":
      return {
        title: localize(`Tap ${q(sys("currentApp"))}`, `Toca ${q(sys("currentApp"))}`),
        body: localize("It's the last option.", "Es la última opción."),
        visualLabel: localize(
          `The variables menu with ${sys("currentApp")} marked.`,
          `El menú de variables con ${sys("currentApp")} marcado.`,
        ),
      };
    case "check_result":
      return {
        title: localize("Check and save", "Revisa y guarda"),
        body: localize(
          "It should look like this. Tap the blue ✓ and come back to Still.",
          "Tiene que verse así. Toca el ✓ azul y vuelve a Still.",
        ),
        visualLabel: localize(
          `The finished automation: ${sys("getScopeApp", { scope: sys("currentScope") })}, then ${sys("stillSummaryPrefix")} ${sys("currentApp")}.`,
          `La automatización terminada: ${sys("getScopeApp", { scope: sys("currentScope") })} y después ${sys("stillSummaryPrefix")} ${sys("currentApp")}.`,
        ),
      };
    case "pick_app_name":
      return {
        title: localize("Choose the app", "Elige la app"),
        body: localize(
          `Tap ${q(sys("appNameParam"))} and choose the same app (${example} in the picture).`,
          `Toca ${q(sys("appNameParam"))} y elige la misma app (en la imagen, ${example}).`,
        ),
        visualLabel: localize(
          `Still's action with its ${sys("appNameParam")} list open and ${example} marked.`,
          `La acción de Still con la lista ${sys("appNameParam")} abierta y ${example} marcada.`,
        ),
      };
    case "save_automation":
      return {
        title: localize("Save", "Guarda"),
        body: localize(
          "Tap the blue ✓ and come back to Still to test it.",
          "Toca el ✓ azul y vuelve a Still para probarla.",
        ),
        visualLabel: localize(
          "The finished automation with the blue check mark marked.",
          "La automatización terminada con el ✓ azul marcado.",
        ),
      };
    case "return_open_app":
      return {
        title: localize(
          `Create a shortcut with ${q(sys("openApp"))}`,
          `Crea un atajo con ${q(sys("openApp"))}`,
        ),
        body: localize(
          `Tap the picture to create a new shortcut and tap ${q(sys("openApp"))}.`,
          `Toca la imagen para crear un atajo nuevo y toca ${q(sys("openApp"))}.`,
        ),
        visualLabel: localize(
          `The action list with ${sys("openApp")} marked.`,
          `La lista de acciones con ${sys("openApp")} marcada.`,
        ),
      };
    case "return_choose_app":
      return {
        title: localize("Choose the app", "Elige la app"),
        body: localize(
          `Tap the blue ${q(sys("app"))} and choose ${fake}. Then tap the shortcut's name at the top.`,
          `Toca ${q(sys("app"))} (azul) y elige ${fake}. Después toca el nombre del atajo, arriba.`,
        ),
        visualLabel: localize(
          `The ${sys("openApp")} action with ${sys("app")} and the shortcut's name marked in order.`,
          `La acción ${sys("openApp")} con ${sys("app")} y el nombre del atajo marcados en orden.`,
        ),
      };
    case "return_rename":
      return {
        title: localize("Give it the exact name", "Ponle el nombre exacto"),
        body: localize(
          `Tap ${q(sys("rename"))} and type the name from the list below. The first time it runs, tap ${q(sys("alwaysAllow"))}.`,
          `Toca ${q(sys("rename"))} y escribe el nombre de la lista de abajo. La primera vez que se use, toca ${q(sys("alwaysAllow"))}.`,
        ),
        visualLabel: localize(
          `The shortcut's menu with ${sys("rename")} marked.`,
          `El menú del atajo con ${sys("rename")} marcado.`,
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
        "One automation pauses all your apps. Tap each picture to go to that screen in Shortcuts, and come back with “◀ Still” at the top left.",
        "Una sola automatización pausa todas tus apps. Toca cada imagen para ir a esa pantalla de Atajos y vuelve con «◀ Still», arriba a la izquierda.",
      );
    case "per_app":
      return localize(
        `Create one automation for each app. The example uses ${EXAMPLE_APP.name}.`,
        `Crea una automatización para cada app. El ejemplo usa ${EXAMPLE_APP.name}.`,
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
  const sheet = useStillSheet();
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
  const allSteps = guideSteps(tier, {
    needsReturnShortcut: schemeless.length > 0,
  });
  // The custom-app steps (Tilo) get their own section after the test.
  const steps = allSteps.filter((step) => !step.id.startsWith("return_"));
  const returnSteps = allSteps.filter((step) => step.id.startsWith("return_"));
  const exampleName = chosen[0]?.name ?? EXAMPLE_APP.name;

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
      // Shortcuts itself does not open: it was removed from this iPhone.
    }
    await offerShortcutsInstall(sheet);
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
    void sheet.show({
      title: localize(`Now open ${target.name}`, `Ahora abre ${target.name}`),
      message: localize(
        `Go to your Home Screen and open ${target.name}. If you see Still's pause, it is connected.`,
        `Ve a tu pantalla de inicio y abre ${target.name}. Si ves la pausa de Still, quedó conectada.`,
      ),
      actions: [gotItAction()],
    });
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
          "The pause didn't show up.",
          "La pausa no apareció.",
        ),
      };
    if (health[target.id]?.verifiedAt)
      return {
        tone: "ok" as const,
        label: localize("Connected", "Conectada"),
      };
    return {
      tone: "idle" as const,
      label: localize("Not tested yet", "Falta probar"),
    };
  }

  const connected = chosen.filter((target) => health[target.id]?.verifiedAt);

  async function copyShortcutName(target: ShortcutTarget) {
    await Clipboard.setStringAsync(returnShortcutName(target.name));
    sheet.toast({
      message: localize("Name copied.", "Nombre copiado."),
      tone: "success",
    });
  }

  function renderStep(step: GuideStep, index: number) {
    const copy = stepCopy(step.id);
    const Drawn = step.screen ? SHORTCUTS_SCREENS[step.screen] : null;
    return (
      <View key={step.id} style={styles.step}>
        <View style={styles.stepHeading}>
          <Mono>{String(index + 1).padStart(2, "0")}</Mono>
          <Heading style={styles.stepTitle}>{copy.title}</Heading>
        </View>
        <Body style={styles.stepBody}>{copy.body}</Body>
        {Drawn ? (
          <GuideCard
            accessibilityLabel={copy.visualLabel}
            actionLabel={linkLabel(step.link)}
            onPress={() => void open(guideLinkUrl(step.link))}
          >
            <Drawn />
          </GuideCard>
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
  }

  return (
    <Screen contentContainerStyle={styles.screen}>
      <View style={styles.topline}>
        <FieldApertureMark size={34} />
        <Eyebrow>{localize("SHORTCUTS", "ATAJOS")}</Eyebrow>
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
              "Pauses on iPhone are coming back soon. You can get the automation ready now.",
              "Las pausas en iPhone vuelven pronto. Puedes dejar lista la automatización.",
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
          <View style={styles.steps}>{steps.map(renderStep)}</View>

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
                "Tap Test and open the app. If you see Still's pause, it is connected.",
                "Toca Probar y abre la app. Si ves la pausa de Still, quedó conectada.",
              )}
            </Body>
            {chosen.length === 0 ? (
              <Body style={styles.stepBody}>
                {localize(
                  "Once the automation is saved, open one of the apps you checked: it appears here to test.",
                  "Cuando guardes la automatización, abre una de las apps que marcaste: aparecerá aquí para probarla.",
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

          {returnSteps.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionIntro}>
                <Heading style={styles.stepTitle}>
                  {localize(
                    "So Still can open your other apps",
                    "Para que Still abra tus otras apps",
                  )}
                </Heading>
                <Body style={styles.stepBody}>
                  {localize(
                    `Some apps need a shortcut so Still can open them after the ad. Follow the example with ${FAKE_APP.name} and repeat it for each app in the list.`,
                    `Algunas apps necesitan un atajo para que Still las abra después del anuncio. Mira el ejemplo con ${FAKE_APP.name} y repítelo con cada app de la lista.`,
                  )}
                </Body>
              </View>
              <View style={styles.steps}>{returnSteps.map(renderStep)}</View>
              <Eyebrow>{localize("YOUR APPS", "TUS APPS")}</Eyebrow>
              {schemeless.map((target) => (
                <View key={target.id} style={styles.testRow}>
                  <View style={styles.testCopy}>
                    <Body style={styles.testName}>{target.name}</Body>
                    <Mono>{returnShortcutName(target.name)}</Mono>
                  </View>
                  <PrimaryButton
                    accessibilityLabel={localize(
                      `Copy “${returnShortcutName(target.name)}”`,
                      `Copiar «${returnShortcutName(target.name)}»`,
                    )}
                    onPress={() => void copyShortcutName(target)}
                    variant="secondary"
                  >
                    {localize("Copy", "Copiar")}
                  </PrimaryButton>
                </View>
              ))}
            </View>
          ) : null}
        </>
      )}

      <View style={styles.note}>
        <Eyebrow>{localize("GOOD TO KNOW", "CONVIENE SABER")}</Eyebrow>
        <Body style={styles.stepBody}>
          {localize(
            "You'll see the app for an instant before the pause: that's normal. After restarting your iPhone, the pause takes about two minutes to come back.",
            "Verás la app un instante antes que la pausa: es normal. Después de reiniciar el iPhone, la pausa tarda unos dos minutos en volver.",
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
                  "Set up one app at a time",
                  "Configurar una app a la vez",
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
          {localize("The pause doesn't show up", "¿No aparece la pausa?")}
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
  sectionIntro: { gap: spacing.sm },
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

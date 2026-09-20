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
import {
  ShortcutStepVisual,
  type ShortcutStepVisualVariant,
} from "@/components/shortcut-step-visual";
import { Body, Eyebrow, Heading, Mono } from "@/components/typography";
import { localize } from "@/i18n";
import {
  IOS_SHORTCUT_IMPORT_URL,
  SHORTCUTS_APP_URL,
  SHORTCUTS_CREATE_URL,
  type SetupStepId,
  type SetupTier,
  probeResult,
  resolveSetupTier,
  setupSteps,
} from "@/lib/ios-shortcut-setup";
import {
  type ShortcutTarget,
  activeTargets,
  returnShortcutName,
} from "@/lib/shortcut-targets";
import { restrictionEngine } from "@/native/restriction-engine";
import { useShortcutTargets } from "@/state/shortcut-targets";
import { colors, spacing } from "@/theme/tokens";

type StepCopy = {
  title: string;
  body: string;
  visual: ShortcutStepVisualVariant;
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
          "Image of the Add Shortcut sheet for Still · Pausa.",
          "Imagen de la hoja Añadir atajo para Still · Pausa.",
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
    case "automation_new":
      return {
        visual: "trigger",
        title: localize("Create an automation", "Crea una automatización"),
        body: localize(
          "In Shortcuts, open the Automation tab, tap + and choose “App”.",
          "En Atajos, abre la pestaña Automatización, toca + y elige «App».",
        ),
        visualLabel: localize(
          `Image of a personal automation that runs when ${appName} is opened.`,
          `Imagen de una automatización personal que se ejecuta al abrir ${appName}.`,
        ),
      };
    case "automation_pick_apps":
      return {
        visual: "trigger-multi",
        title: localize("Pick all your apps", "Marca todas tus apps"),
        body: localize(
          "Select every app you chose in Still and keep “Is Opened” checked. One automation covers them all.",
          "Marca todas las apps que elegiste en Still y deja «Se abre» seleccionado. Una sola automatización las cubre todas.",
        ),
        visualLabel: localize(
          "Image of an automation trigger listing your chosen apps.",
          "Imagen de un disparador de automatización con tus apps elegidas.",
        ),
      };
    case "automation_pick_one_app":
      return {
        visual: "trigger",
        title: localize(`Pick ${appName}`, `Elige ${appName}`),
        body: localize(
          `Select only ${appName} and keep “Is Opened” checked. Repeat these steps for each app.`,
          `Marca solo ${appName} y deja «Se abre» seleccionado. Repite estos pasos con cada app.`,
        ),
        visualLabel: localize(
          `Image of a personal automation that runs when ${appName} is opened.`,
          `Imagen de una automatización personal que se ejecuta al abrir ${appName}.`,
        ),
      };
    case "automation_run_immediately":
      return {
        visual: "trigger",
        title: localize("Run Immediately", "Ejecutar inmediatamente"),
        body: localize(
          "Choose “Run Immediately” and turn off “Notify When Run”, then tap Next.",
          "Elige «Ejecutar inmediatamente», apaga «Notificar al ejecutar» y toca Siguiente.",
        ),
        visualLabel: localize(
          "Image of an automation set to Run Immediately.",
          "Imagen de una automatización configurada para ejecutarse inmediatamente.",
        ),
      };
    case "action_current_app":
      return {
        visual: "current-app",
        title: localize("Add “Get Current App”", "Añade «Obtener app actual»"),
        body: localize(
          "Create a new shortcut for the automation and search for “Get Current App”. It tells Still which app you opened.",
          "Crea un atajo nuevo para la automatización y busca «Obtener app actual». Le dice a Still qué app abriste.",
        ),
        visualLabel: localize(
          "Image of the Get Current App action.",
          "Imagen de la acción Obtener app actual.",
        ),
      };
    case "action_pause_current":
      return {
        visual: "pause-current",
        title: localize("Add Still's action", "Añade la acción de Still"),
        body: localize(
          "Search for “Still”, add “Pause Before Opening”, and set App name to the “Current App” variable.",
          "Busca «Still», añade «Pause Before Opening» y pon en Nombre de app la variable «App actual».",
        ),
        visualLabel: localize(
          "Image of Still's action using the Current App variable.",
          "Imagen de la acción de Still usando la variable App actual.",
        ),
      };
    case "action_pause_named":
      return {
        visual: "pause",
        title: localize("Add Still's action", "Añade la acción de Still"),
        body: localize(
          `Search for “Still”, add “Pause Before Opening”, and pick ${appName} from the list. Nothing to type.`,
          `Busca «Still», añade «Pause Before Opening» y elige ${appName} en la lista. No hay que escribir nada.`,
        ),
        visualLabel: localize(
          `Image of Still's Pause Before Opening action with App name set to ${appName}.`,
          `Imagen de la acción Pausa antes de abrir de Still con Nombre de app en ${appName}.`,
        ),
      };
    case "return_shortcut":
      return {
        visual: "return",
        title: localize("Create the return shortcut", "Crea el atajo de retorno"),
        body: localize(
          `Still cannot reopen ${schemelessName} by itself. Create a shortcut named exactly “${returnShortcutName(schemelessName)}” with one action: Open App → ${schemelessName}.`,
          `Still no puede reabrir ${schemelessName} por sí solo. Crea un atajo llamado exactamente «${returnShortcutName(schemelessName)}» con una sola acción: Abrir app → ${schemelessName}.`,
        ),
        visualLabel: localize(
          `Image of a shortcut named ${returnShortcutName(schemelessName)} with one Open App action.`,
          `Imagen de un atajo llamado ${returnShortcutName(schemelessName)} con una acción Abrir app.`,
        ),
      };
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
        "One automation covers every app. It takes about two minutes and stays on this iPhone.",
        "Una sola automatización cubre todas las apps. Lleva unos dos minutos y se queda en este iPhone.",
      );
    case "per_app":
      return localize(
        "Each app gets a short automation. It takes about a minute per app and stays on this iPhone.",
        "Cada app lleva una automatización breve. Lleva cerca de un minuto por app y se queda en este iPhone.",
      );
  }
}

export default function ShortcutSetupScreen() {
  const { tested, onboarding } = useLocalSearchParams<{
    tested?: string;
    onboarding?: string;
  }>();
  const { targets, health, refresh, disableScheme } = useShortcutTargets();
  const [probe, setProbe] = useState<{ id: string; startedAt: number } | null>(
    null,
  );
  const [now, setNow] = useState(() => Date.now());

  const chosen = activeTargets(targets);
  const schemeless = chosen.filter((target) => !target.urlScheme);
  const tier = resolveSetupTier({ iosVersion: Platform.Version });
  const steps = setupSteps(tier, {
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
    } catch {
      Alert.alert(
        localize("Could not open Shortcuts", "No se pudo abrir Atajos"),
        localize(
          "Open Apple's Shortcuts app and select Automation.",
          "Abre la app Atajos de Apple y elige Automatización.",
        ),
      );
    }
  }

  async function test(target: ShortcutTarget) {
    await restrictionEngine
      .beginShortcutSetupProbe(target.name)
      .catch(() => undefined);
    setProbe({ id: target.id, startedAt: Date.now() });
    setNow(Date.now());
    if (target.urlScheme) {
      try {
        await Linking.openURL(target.urlScheme);
        return;
      } catch {
        // This scheme does not open here: return through the shortcut instead.
        await disableScheme(target.id);
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

      {chosen.length === 0 ? (
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
            {steps.map((id, index) => {
              const copy = stepCopy(id, exampleName, schemelessName);
              return (
                <View key={id} style={styles.step}>
                  <Mono>{String(index + 1).padStart(2, "0")}</Mono>
                  <View style={styles.stepCopy}>
                    <Heading style={styles.stepTitle}>{copy.title}</Heading>
                    <Body style={styles.stepBody}>{copy.body}</Body>
                    <ShortcutStepVisual
                      accessibilityLabel={copy.visualLabel}
                      appName={
                        id === "return_shortcut" ? schemelessName : exampleName
                      }
                      appNames={chosen.map((target) => target.name)}
                      variant={copy.visual}
                    />
                  </View>
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
                onPress={() => void open(SHORTCUTS_APP_URL)}
                variant="signal"
              >
                {localize("Open Shortcuts", "Abrir Atajos")}
              </PrimaryButton>
            )}
            {schemeless.length > 0 ? (
              <PrimaryButton
                onPress={() => void open(SHORTCUTS_CREATE_URL)}
                variant="secondary"
              >
                {localize("Create return shortcut", "Crear atajo de retorno")}
              </PrimaryButton>
            ) : null}
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
                      disabled={state.tone === "pending"}
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
    flexDirection: "row",
    gap: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
  },
  stepCopy: { flex: 1, gap: spacing.sm },
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

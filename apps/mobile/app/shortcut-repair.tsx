import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Linking, Platform, StyleSheet, Switch, View } from "react-native";

import { FieldApertureMark } from "@/components/field-aperture-mark";
import { PrimaryButton } from "@/components/primary-button";
import { Screen } from "@/components/screen";
import { Body, Eyebrow, Heading, Mono } from "@/components/typography";
import { localize } from "@/i18n";
import {
  IOS_HOME_SHORTCUT_IMPORT_URL,
  IOS_SHORTCUT_IMPORT_URL,
  PAUSE_SHORTCUT_NAME,
  type RepairCauseId,
  SHORTCUTS_APP_URL,
  SHORTCUTS_CREATE_URL,
  type SetupTier,
  isTrustedImportUrl,
  repairCauses,
  resolveSetupTier,
  shortcutsOpenUrl,
} from "@/lib/ios-shortcut-setup";
import { HOME_SHORTCUT_NAME } from "@/lib/leave-to-home";
import {
  getHomeShortcutInstalled,
  setHomeShortcutInstalled,
} from "@/native/use-leave-to-home";
import { useAppState } from "@/state/app-state";
import { colors, spacing } from "@/theme/tokens";

type CauseCopy = {
  title: string;
  body: string;
  action?: { label: string; url: string };
};

function causeCopy(id: RepairCauseId, tier: SetupTier): CauseCopy {
  const editUrl =
    tier === "import" ? shortcutsOpenUrl(PAUSE_SHORTCUT_NAME) : SHORTCUTS_APP_URL;
  const edit = {
    label:
      tier === "import"
        ? localize("Open the shortcut", "Abrir el atajo")
        : localize("Open Shortcuts", "Abrir Atajos"),
    url: editUrl,
  };
  switch (id) {
    case "toggle_off":
      return {
        title: localize("The automation is switched off", "La automatización está apagada"),
        body: localize(
          "In Shortcuts → Automation, make sure the switch next to your Still automation is on. Shared automations arrive switched off.",
          "En Atajos → Automatización, comprueba que el interruptor junto a tu automatización de Still esté activado. Las automatizaciones compartidas llegan apagadas.",
        ),
        action: edit,
      };
    case "app_missing_in_trigger":
      return {
        title: localize("The app is not in the trigger", "La app no está en el disparador"),
        body: localize(
          "Open the automation, tap the app list next to “When”, and check every app you chose in Still.",
          "Abre la automatización, toca la lista de apps junto a «Cuando» y marca todas las apps que elegiste en Still.",
        ),
        action: edit,
      };
    case "not_run_immediately":
      return {
        title: localize("It asks before running", "Pregunta antes de ejecutarse"),
        body: localize(
          "Open the automation and choose “Run Immediately”. With “Run After Confirmation” iOS only shows a notification and the app opens without a pause.",
          "Abre la automatización y elige «Ejecutar inmediatamente». Con «Ejecutar tras confirmar», iOS solo muestra una notificación y la app se abre sin pausa.",
        ),
        action: edit,
      };
    case "wrong_app_in_action":
      return {
        title: localize(
          "Still's action names another app",
          "La acción de Still nombra otra app",
        ),
        body: localize(
          "Inside the automation, tap “Pause Before Opening” and pick the same app as the trigger from the list.",
          "Dentro de la automatización, toca «Pause Before Opening» y elige en la lista la misma app que en el disparador.",
        ),
        action: edit,
      };
    case "shortcut_deleted":
      return {
        title: localize("The automation was deleted", "La automatización se borró"),
        body: localize(
          "If you cannot find it in Shortcuts → Automation, set it up again. Your apps and counters in Still are kept.",
          "Si no la encuentras en Atajos → Automatización, configúrala de nuevo. Tus apps y contadores en Still se conservan.",
        ),
        action:
          tier === "import" && isTrustedImportUrl(IOS_SHORTCUT_IMPORT_URL)
            ? {
                label: localize("Add it again", "Añadirla de nuevo"),
                url: IOS_SHORTCUT_IMPORT_URL,
              }
            : undefined,
      };
    case "just_rebooted":
      return {
        title: localize("The iPhone just restarted", "El iPhone acaba de reiniciarse"),
        body: localize(
          "iOS does not run automations for about two minutes after a restart. Wait a moment and test again.",
          "iOS no ejecuta automatizaciones durante unos dos minutos tras reiniciar. Espera un momento y prueba de nuevo.",
        ),
      };
  }
}

export default function ShortcutRepairScreen() {
  const { config } = useAppState();
  const tier = resolveSetupTier({ iosVersion: Platform.Version });
  const [homeShortcut, setHomeShortcut] = useState(false);

  useEffect(() => {
    void getHomeShortcutInstalled()
      .then(setHomeShortcut)
      .catch(() => undefined);
  }, []);

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

  return (
    <Screen contentContainerStyle={styles.screen}>
      <View style={styles.topline}>
        <FieldApertureMark size={34} />
        <Eyebrow>{localize("IOS / REPAIR", "IOS / REPARAR")}</Eyebrow>
      </View>

      <View style={styles.header}>
        <Heading style={styles.title}>
          {localize("Let's get the pause back.", "Recuperemos la pausa.")}
        </Heading>
        <Body style={styles.lede}>
          {localize(
            "iOS does not let Still look inside Shortcuts, so go through these in order. Stop at the first one that applies, then test again.",
            "iOS no deja que Still mire dentro de Atajos, así que revisa esto en orden. Detente en lo primero que aplique y vuelve a probar.",
          )}
        </Body>
      </View>

      <View style={styles.steps}>
        {repairCauses(tier).map((id, index) => {
          const copy = causeCopy(id, tier);
          return (
            <View key={id} style={styles.step}>
              <Mono>{String(index + 1).padStart(2, "0")}</Mono>
              <View style={styles.stepCopy}>
                <Heading style={styles.stepTitle}>{copy.title}</Heading>
                <Body style={styles.stepBody}>{copy.body}</Body>
                {copy.action ? (
                  <PrimaryButton
                    onPress={() => void open(copy.action!.url)}
                    variant="secondary"
                  >
                    {copy.action.label}
                  </PrimaryButton>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>

      {config.iosHomeOnCancelEnabled ? null : (
        <View style={styles.note}>
          <Eyebrow>
            {localize("OPTIONAL · GO HOME", "OPCIONAL · IR AL INICIO")}
          </Eyebrow>
          <Body style={styles.stepBody}>
            {localize(
              `When you choose not to open an app, Still can send you to your Home Screen with a one-action shortcut. Create a shortcut named exactly “${HOME_SHORTCUT_NAME}” with the action “Go to Home Screen”, then turn this on.`,
              `Cuando eliges no abrir una app, Still puede llevarte a tu pantalla de inicio con un atajo de una sola acción. Crea un atajo llamado exactamente «${HOME_SHORTCUT_NAME}» con la acción «Ir a la pantalla de inicio» y activa esto.`,
            )}
          </Body>
          <PrimaryButton
            onPress={() =>
              void open(
                isTrustedImportUrl(IOS_HOME_SHORTCUT_IMPORT_URL)
                  ? IOS_HOME_SHORTCUT_IMPORT_URL
                  : SHORTCUTS_CREATE_URL,
              )
            }
            variant="secondary"
          >
            {localize("Create the shortcut", "Crear el atajo")}
          </PrimaryButton>
          <View style={styles.switchRow}>
            <Body style={styles.switchLabel}>
              {localize("I created it", "Ya lo creé")}
            </Body>
            <Switch
              accessibilityLabel={localize(
                "I created the Go Home shortcut",
                "Ya creé el atajo para ir al inicio",
              )}
              onValueChange={(value) => {
                setHomeShortcut(value);
                void setHomeShortcutInstalled(value);
              }}
              value={homeShortcut}
            />
          </View>
        </View>
      )}

      <View style={styles.actions}>
        <PrimaryButton
          onPress={() => router.replace("/shortcut-setup")}
          variant="signal"
        >
          {localize("Test again", "Probar de nuevo")}
        </PrimaryButton>
        <PrimaryButton onPress={() => router.back()} variant="quiet">
          {localize("Back", "Volver")}
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
  note: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.chalkRaised,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  switchLabel: { flex: 1 },
  actions: { gap: spacing.md },
});

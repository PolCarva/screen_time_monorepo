import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Platform, StyleSheet, Switch, View } from "react-native";

import { FieldApertureMark } from "@/components/field-aperture-mark";
import { PrimaryButton } from "@/components/primary-button";
import { Screen } from "@/components/screen";
import { useStillSheet } from "@/components/still-sheet";
import { Body, Eyebrow, Heading, Mono } from "@/components/typography";
import { localize, sys } from "@/i18n";
import {
  IOS_HOME_SHORTCUT_IMPORT_URL,
  IOS_SHORTCUT_IMPORT_URL,
  PAUSE_SHORTCUT_NAME,
  type RepairCauseId,
  SHORTCUTS_APP_URL,
  SHORTCUTS_AUTOMATIONS_URL,
  SHORTCUTS_CREATE_URL,
  type SetupTier,
  isTrustedImportUrl,
  repairCauses,
  resolveSetupTier,
  shortcutsOpenUrl,
} from "@/lib/ios-shortcut-setup";
import { HOME_SHORTCUT_NAME } from "@/lib/leave-to-home";
import { offerShortcutsInstall } from "@/lib/shortcuts-app";
import {
  getHomeShortcutInstalled,
  setHomeShortcutInstalled,
} from "@/native/use-leave-to-home";
import { useAppState } from "@/state/app-state";
import { colors, spacing } from "@/theme/tokens";

type CauseCopy = {
  title: string;
  body: string;
  action?: { label: string; url?: string; route?: "/shortcut-setup" };
};

function causeCopy(id: RepairCauseId, tier: SetupTier): CauseCopy {
  // The import tier has one named shortcut to open; otherwise the closest
  // iOS allows is the Automation tab, where the user taps their automation.
  const editUrl =
    tier === "import"
      ? shortcutsOpenUrl(PAUSE_SHORTCUT_NAME)
      : SHORTCUTS_AUTOMATIONS_URL;
  const edit = {
    label:
      tier === "import"
        ? localize("Open the shortcut", "Abrir el atajo")
        : localize("Open my automations", "Abrir mis automatizaciones"),
    url: editUrl,
  };
  switch (id) {
    case "toggle_off":
      return {
        title: localize("Turn the automation on", "Enciende la automatización"),
        body: localize(
          `In Shortcuts → ${sys("automation")}, turn on the switch of your Still automation.`,
          `En Atajos → ${sys("automation")}, activa el interruptor de tu automatización de Still.`,
        ),
        action: edit,
      };
    case "app_missing_in_trigger":
      return {
        title: localize(
          "Check the app in the automation",
          "Marca la app en la automatización",
        ),
        body: localize(
          `Open the automation, tap the app list next to “${sys("when")}” and check every app you chose in Still.`,
          `Abre la automatización, toca la lista de apps junto a «${sys("when")}» y marca todas las apps que elegiste en Still.`,
        ),
        action: edit,
      };
    case "not_run_immediately":
      return {
        title: localize(
          `Choose “${sys("runImmediately")}”`,
          `Elige «${sys("runImmediately")}»`,
        ),
        body: localize(
          `Open the automation and tap “${sys("runImmediately")}” so the pause shows up by itself.`,
          `Abre la automatización y toca «${sys("runImmediately")}» para que la pausa aparezca sola.`,
        ),
        action: edit,
      };
    case "wrong_app_in_action":
      return {
        title: localize(
          `It says “${sys("noActions")}” or shows another app`,
          `Dice «${sys("noActions")}» o muestra otra app`,
        ),
        body: localize(
          `Under the app it should read “${sys("stillAction")}”. If it says “${sys("noActions")}”, open it and follow the guide from “${sys("createNewShortcut")}”. If the action is there, tap it and choose the same app.`,
          `Bajo la app tiene que decir «${sys("stillAction")}». Si dice «${sys("noActions")}», ábrela y sigue la guía desde «${sys("createNewShortcut")}». Si la acción está, tócala y elige la misma app.`,
        ),
        action: edit,
      };
    case "shortcut_deleted":
      return {
        title: localize(
          "Create the automation again",
          "Vuelve a crear la automatización",
        ),
        body: localize(
          `If it isn't in Shortcuts → ${sys("automation")}, create it again. Your apps and your numbers in Still are kept.`,
          `Si no está en Atajos → ${sys("automation")}, créala de nuevo. Tus apps y tus números en Still se conservan.`,
        ),
        action:
          tier === "import" && isTrustedImportUrl(IOS_SHORTCUT_IMPORT_URL)
            ? {
                label: localize("Add it again", "Añadirla de nuevo"),
                url: IOS_SHORTCUT_IMPORT_URL,
              }
            : {
                label: localize("See the guide", "Ver la guía"),
                route: "/shortcut-setup",
              },
      };
    case "just_rebooted":
      return {
        title: localize(
          "Did you just restart your iPhone?",
          "¿Reiniciaste el iPhone?",
        ),
        body: localize(
          "After a restart, the pause takes about two minutes to come back. Wait a moment and test again.",
          "Después de reiniciar, la pausa tarda unos dos minutos en volver. Espera un momento y prueba de nuevo.",
        ),
      };
  }
}

export default function ShortcutRepairScreen() {
  const { config } = useAppState();
  const sheet = useStillSheet();
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
      return;
    } catch {
      // The Automation-tab link is undocumented; plain Shortcuts is the fallback.
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

  return (
    <Screen contentContainerStyle={styles.screen}>
      <View style={styles.topline}>
        <FieldApertureMark size={34} />
        <Eyebrow>{localize("REPAIR", "REPARAR")}</Eyebrow>
      </View>

      <View style={styles.header}>
        <Heading style={styles.title}>
          {localize("Let's get the pause back.", "Recuperemos la pausa.")}
        </Heading>
        <Body style={styles.lede}>
          {localize(
            "Go through these in order and test again as soon as you fix something.",
            "Revisa esto en orden y vuelve a probar en cuanto arregles algo.",
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
                    onPress={() => {
                      const action = copy.action!;
                      if (action.route) router.push(action.route);
                      else if (action.url) void open(action.url);
                    }}
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

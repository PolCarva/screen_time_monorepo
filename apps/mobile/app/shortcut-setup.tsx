import { router } from "expo-router";
import { Alert, Linking, StyleSheet, View } from "react-native";

import { FieldApertureMark } from "@/components/field-aperture-mark";
import { PrimaryButton } from "@/components/primary-button";
import { Screen } from "@/components/screen";
import {
  ShortcutStepVisual,
  type ShortcutStepVisualVariant,
} from "@/components/shortcut-step-visual";
import { Body, Eyebrow, Heading, Mono } from "@/components/typography";
import { localize } from "@/i18n";
import { colors, spacing } from "@/theme/tokens";

const exampleAppName = "YouTube";
const exampleShortcutName = `Still · ${exampleAppName}`;

const steps = [
  {
    visual: "return" satisfies ShortcutStepVisualVariant,
    visualLabel: localize(
      "Image showing a shortcut named Still · YouTube with one Open App action set to YouTube.",
      "Imagen de un atajo llamado Still · YouTube con una acción Abrir app configurada en YouTube.",
    ),
    title: localize("Create the return shortcut", "Crea el atajo de retorno"),
    body: localize(
      `Create a shortcut named exactly “${exampleShortcutName}”. Give it one action: Open App → ${exampleAppName}.`,
      `Crea un atajo llamado exactamente “${exampleShortcutName}”. Dale una sola acción: Abrir app → ${exampleAppName}.`,
    ),
  },
  {
    visual: "trigger" satisfies ShortcutStepVisualVariant,
    visualLabel: localize(
      "Image showing a personal automation that runs immediately when YouTube is opened.",
      "Imagen de una automatización personal que se ejecuta inmediatamente cuando se abre YouTube.",
    ),
    title: localize("Choose the trigger", "Elige el disparador"),
    body: localize(
      "Create a personal automation: App → YouTube → Is Opened → Run Immediately.",
      "Crea una automatización personal: App → YouTube → Se abre → Ejecutar inmediatamente.",
    ),
  },
  {
    visual: "pause" satisfies ShortcutStepVisualVariant,
    visualLabel: localize(
      "Image showing Still's Pause Before Opening action with App name set to YouTube.",
      "Imagen de la acción Pausa antes de abrir de Still con Nombre de app configurado en YouTube.",
    ),
    title: localize("Add Still's action", "Añade la acción de Still"),
    body: localize(
      `Add “Pause Before Opening” and enter only “${exampleAppName}”. Still derives “${exampleShortcutName}” automatically.`,
      `Añade “Pause Before Opening” y escribe solo “${exampleAppName}”. Still deriva “${exampleShortcutName}” automáticamente.`,
    ),
  },
] as const;

export default function ShortcutSetupScreen() {
  async function openShortcuts(url: "shortcuts://create-shortcut" | "shortcuts://") {
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
        <Eyebrow>{localize("IOS / SHORTCUTS", "IOS / ATAJOS")}</Eyebrow>
      </View>

      <View style={styles.header}>
        <Heading style={styles.title}>
          {localize(
            "Return to the app you meant to open.",
            "Vuelve a la app que querías abrir.",
          )}
        </Heading>
        <Body style={styles.lede}>
          {localize(
            "Shortcuts detects the app locally. Still opens only for the decision and returns you after the ad or pass.",
            "Atajos detecta la app localmente. Still se abre solo para la decisión y te devuelve después del anuncio o pase.",
          )}
        </Body>
      </View>

      <View style={styles.steps}>
        {steps.map((step, index) => (
          <View key={step.title} style={styles.step}>
            <Mono>{String(index + 1).padStart(2, "0")}</Mono>
            <View style={styles.stepCopy}>
              <Heading style={styles.stepTitle}>{step.title}</Heading>
              <Body style={styles.stepBody}>{step.body}</Body>
              <ShortcutStepVisual
                accessibilityLabel={step.visualLabel}
                variant={step.visual}
              />
            </View>
          </View>
        ))}
      </View>

      <View style={styles.note}>
        <Eyebrow>
          {localize("WHY STILL OPENS", "POR QUÉ SE ABRE STILL")}
        </Eyebrow>
        <Body style={styles.stepBody}>
          {localize(
            "iOS does not allow an ad to appear inside an automation. Still must briefly come to the foreground to show the opt-in ad and record the result safely.",
            "iOS no permite mostrar un anuncio dentro de una automatización. Still debe pasar brevemente al frente para mostrar el anuncio voluntario y registrar el resultado de forma segura.",
          )}
        </Body>
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          onPress={() => void openShortcuts("shortcuts://create-shortcut")}
          variant="signal"
        >
          {localize("Create return shortcut", "Crear atajo de retorno")}
        </PrimaryButton>
        <PrimaryButton
          onPress={() => void openShortcuts("shortcuts://")}
          variant="secondary"
        >
          {localize("Continue in Shortcuts", "Continuar en Atajos")}
        </PrimaryButton>
        <PrimaryButton
          onPress={() => router.replace("/(tabs)/(settings)")}
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
    gap: spacing.sm,
    backgroundColor: colors.chalkRaised,
  },
  actions: { gap: spacing.md },
});

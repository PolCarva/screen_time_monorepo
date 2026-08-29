import { router } from "expo-router";
import { useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { AttentionField } from "@/components/attention-field";
import { FieldApertureMark } from "@/components/field-aperture-mark";
import { PrimaryButton } from "@/components/primary-button";
import { Screen } from "@/components/screen";
import { Body, Display, Eyebrow, Mono } from "@/components/typography";
import { localize } from "@/i18n";
import { restrictionEngine } from "@/native/restriction-engine";
import { useAppState } from "@/state/app-state";
import { colors, fonts, radius, spacing } from "@/theme/tokens";

const steps = [
  {
    label: localize("01 / THE MOMENT", "01 / EL MOMENTO"),
    title: localize("Notice the second\nbefore you enter.", "Nota el segundo\nantes de entrar."),
    body: localize("Still appears before the apps you choose. It makes an automatic opening visible without deciding for you.", "Still aparece antes de las apps que eliges. Hace visible una apertura automática sin decidir por ti."),
    action: localize("Continue", "Continuar"),
    mode: "intervention" as const,
  },
  {
    label: localize("02 / THE CHOICE", "02 / LA ELECCIÓN"),
    title: localize("Go back, or enter\nfor 10 minutes.", "Vuelve, o entra\npor 10 minutos."),
    body: localize("Going back is one tap. A pass keeps the app open for a clear amount of time, then the pause returns.", "Volver requiere un toque. Un pase mantiene la app abierta durante un tiempo claro y luego vuelve la pausa."),
    action: localize("Continue", "Continuar"),
    mode: "progress" as const,
  },
  {
    label: localize("03 / ON DEVICE", "03 / EN EL DISPOSITIVO"),
    title: localize("App names and detail\nstay on your phone.", "Los nombres y el detalle\nse quedan en tu teléfono."),
    body: localize("Still shares general counts for passes and impact. It does not send your app selection or detailed activity history.", "Still comparte conteos generales para pases e impacto. No envía tu selección de apps ni el historial detallado."),
    action: localize("Continue", "Continuar"),
    mode: "progress" as const,
  },
  {
    label: localize("04 / SETUP", "04 / CONFIGURACIÓN"),
    title: localize("Choose where the\npause should appear.", "Elige dónde debería\naparecer la pausa."),
    body: localize("Authorize Still and select the apps you tend to open automatically. You can change the selection later.", "Autoriza Still y selecciona las apps que tiendes a abrir automáticamente. Puedes cambiar la selección después."),
    action: localize("Choose apps", "Elegir apps"),
    mode: "progress" as const,
  },
] as const;

const samples = [
  [12, 18, 8, 26, 17, 31, 21],
  [8, 12, 14, 18, 22, 27, 33],
  [21, 18, 17, 14, 12, 9, 7],
  [0, 0, 0, 0, 0, 0, 0],
];

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const { setOnboarded } = useAppState();
  const current = steps[step]!;

  async function next() {
    if (step < steps.length - 1) {
      setStep((value) => value + 1);
      return;
    }
    if (!adult) return;
    setBusy(true);
    try {
      const restrictionStatus = await restrictionEngine.requestAuthorization();
      if (restrictionStatus !== "authorized") {
        Alert.alert(localize("Allow the pause", "Autoriza la pausa"), localize("Enable Still in Settings, return, and try again.", "Activa Still en Ajustes, vuelve e inténtalo otra vez."));
        return;
      }
      const wellbeingStatus = await restrictionEngine.requestWellbeingAuthorization();
      if (Platform.OS === "android" && wellbeingStatus !== "authorized") {
        Alert.alert(localize("Allow device activity", "Autoriza la actividad"), localize("Enable Usage Access, return, and try again.", "Activa el acceso de uso, vuelve e inténtalo otra vez."));
        return;
      }
      const selection = await restrictionEngine.presentAppPicker();
      if (selection.count > 0) await restrictionEngine.applyRestrictions(selection);
      await setOnboarded(true);
      router.replace("/(tabs)/(today)");
    } catch {
      Alert.alert(localize("Setup paused", "Configuración en pausa"), localize("Nothing changed. Try again whenever you are ready.", "Nada cambió. Inténtalo de nuevo cuando quieras."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen contentContainerStyle={styles.screen}>
      <View style={styles.top}>
        <FieldApertureMark size={34} />
        <Pressable accessibilityRole="button" hitSlop={12} onPress={() => setStep(steps.length - 1)}>
          <Text style={styles.skip}>{localize("Skip", "Saltar")}</Text>
        </Pressable>
      </View>

      <Animated.View key={`field-${step}`} entering={FadeIn.duration(200)} style={styles.field}>
        <View style={styles.fieldTop}>
          <Eyebrow>{current.label}</Eyebrow>
          <Mono>{String(step + 1).padStart(2, "0")} / 04</Mono>
        </View>
        <AttentionField
          accessibilityLabel={localize("A visual example of the attention field.", "Un ejemplo visual del campo de atención.")}
          mode={current.mode}
          values={samples[step]}
          animate={step === 0}
        />
      </Animated.View>

      <Animated.View key={`copy-${step}`} entering={FadeIn.duration(200)} style={styles.copy}>
        <Display>{current.title}</Display>
        <Body style={styles.body}>{current.body}</Body>
      </Animated.View>

      {step === steps.length - 1 ? (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: adult }}
          onPress={() => setAdult((value) => !value)}
          style={({ pressed }) => [styles.checkRow, pressed && styles.pressed]}
        >
          <View style={[styles.check, adult && styles.checkOn]}>{adult ? <Text style={styles.tick}>✓</Text> : null}</View>
          <Body style={styles.checkLabel}>{localize("I confirm that I am 18 or older.", "Confirmo que tengo 18 años o más.")}</Body>
        </Pressable>
      ) : null}

      <View style={styles.footer}>
        <View accessible accessibilityLabel={`${step + 1} / ${steps.length}`} style={styles.progress}>
          {steps.map((_, index) => <View key={index} style={[styles.progressSegment, index <= step && styles.progressSegmentActive, index === step && styles.progressSegmentCurrent]} />)}
        </View>
        <PrimaryButton onPress={next} disabled={busy || (step === steps.length - 1 && !adult)}>
          {busy ? localize("Opening settings…", "Abriendo ajustes…") : current.action}
        </PrimaryButton>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, minHeight: 760, justifyContent: "space-between" },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  skip: { color: colors.graphiteSoft, fontFamily: fonts.brandMedium, fontSize: 13 },
  field: { minHeight: 210, paddingVertical: spacing.lg, justifyContent: "space-between", borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.fog },
  fieldTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  copy: { gap: spacing.lg },
  body: { maxWidth: 520, color: colors.graphiteSoft },
  checkRow: { minHeight: 68, padding: spacing.md, flexDirection: "row", gap: spacing.md, alignItems: "center", borderWidth: 1, borderColor: colors.mineralLight, borderRadius: radius.control },
  check: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.graphite, borderRadius: radius.sm },
  checkOn: { backgroundColor: colors.mineral },
  tick: { color: colors.chalk, fontFamily: fonts.brandBold },
  checkLabel: { flex: 1, fontSize: 14, lineHeight: 20 },
  pressed: { opacity: 0.62 },
  footer: { gap: spacing.lg },
  progress: { height: 5, flexDirection: "row", gap: spacing.xs },
  progressSegment: { flex: 1, borderRadius: radius.xs, backgroundColor: colors.fog },
  progressSegmentActive: { backgroundColor: colors.mineralLight },
  progressSegmentCurrent: { backgroundColor: colors.mineral },
});

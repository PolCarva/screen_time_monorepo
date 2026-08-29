import { router } from "expo-router";
import { useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { IntervalMark } from "@/components/interval-mark";
import { PrimaryButton } from "@/components/primary-button";
import { Screen } from "@/components/screen";
import { Body, Display, Eyebrow, Mono } from "@/components/typography";
import { localize } from "@/i18n";
import { restrictionEngine } from "@/native/restriction-engine";
import { useAppState } from "@/state/app-state";
import { colors, fonts, radius, spacing } from "@/theme/tokens";

const steps = [
  {
    eyebrow: localize("01 / A PAUSE", "01 / UNA PAUSA"),
    title: localize("One second is\nyours again.", "Un segundo vuelve\na ser tuyo."),
    body: localize(
      "Still appears before the apps you choose. It doesn’t decide for you—it makes the decision visible.",
      "Still aparece antes de las apps que eliges. No decide por ti: hace visible el momento de decidir.",
    ),
    action: localize("See how it works", "Ver cómo funciona"),
    marker: "00:01",
    before: localize("OPEN", "ABRIR"),
    after: localize("CHOOSE", "ELEGIR"),
  },
  {
    eyebrow: localize("02 / TWO PATHS", "02 / DOS CAMINOS"),
    title: localize("Leaving is the\nshort path.", "Salir es el\ncamino corto."),
    body: localize(
      "Not going in takes one tap. If you continue, one pass opens the app for 10 minutes.",
      "No entrar requiere un toque. Si decides seguir, un pase abre la app durante 10 minutos.",
    ),
    action: localize("Got it", "Entendido"),
    marker: "01 TAP",
    before: localize("NOT NOW", "NO ENTRAR"),
    after: localize("10 MIN", "10 MIN"),
  },
  {
    eyebrow: localize("03 / ON THIS DEVICE", "03 / EN TU DISPOSITIVO"),
    title: localize("The names\nstay here.", "Los nombres\nse quedan aquí."),
    body: localize(
      "Your selected apps and detailed history stay on your phone. Still only shares general counts.",
      "Las apps elegidas y tu historial detallado permanecen en el teléfono. Still comparte solo conteos generales.",
    ),
    action: localize("Continue", "Continuar"),
    marker: localize("LOCAL", "LOCAL"),
    before: localize("APP NAMES", "NOMBRES"),
    after: localize("COUNTS", "CONTEOS"),
  },
  {
    eyebrow: localize("04 / CHOOSE THE CUT", "04 / ELEGIR EL CORTE"),
    title: localize("Where should\nStill pause?", "¿Dónde quieres\nuna pausa?"),
    body: localize(
      "Confirm you’re 18 or older, authorize Still, and choose the apps you tend to open on reflex.",
      "Confirma que tienes 18 años, autoriza Still y elige las apps que abres por reflejo.",
    ),
    action: localize("Choose apps", "Elegir apps"),
    marker: localize("SET", "LISTO"),
    before: localize("REFLEX", "REFLEJO"),
    after: localize("PAUSE", "PAUSA"),
  },
] as const;

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const { setOnboarded } = useAppState();
  const current = steps[step]!;

  async function next() {
    if (step < steps.length - 1) {
      setStep((currentStep) => currentStep + 1);
      return;
    }
    if (!adult) return;
    setBusy(true);
    try {
      const restrictionStatus = await restrictionEngine.requestAuthorization();
      if (restrictionStatus !== "authorized") {
        Alert.alert(
          localize("Allow pauses", "Autoriza las pausas"),
          localize(
            "Enable Still in Settings, return, and try again.",
            "Activa Still en Ajustes, vuelve aquí e inténtalo otra vez.",
          ),
        );
        return;
      }
      const wellbeingStatus = await restrictionEngine.requestWellbeingAuthorization();
      if (Platform.OS === "android" && wellbeingStatus !== "authorized") {
        Alert.alert(
          localize("Allow wellbeing stats", "Autoriza las estadísticas"),
          localize(
            "Enable Usage Access, return, and try again.",
            "Activa el acceso de uso, vuelve aquí e inténtalo otra vez.",
          ),
        );
        return;
      }
      const selection = await restrictionEngine.presentAppPicker();
      if (selection.count > 0) await restrictionEngine.applyRestrictions(selection);
      await setOnboarded(true);
      router.replace("/(tabs)/(today)");
    } catch {
      Alert.alert(
        localize("Setup paused", "Configuración en pausa"),
        localize(
          "Nothing changed. You can try again whenever you’re ready.",
          "Nada cambió. Puedes intentarlo de nuevo cuando quieras.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen contentContainerStyle={styles.screen}>
      <View style={styles.top}>
        <Eyebrow>{current.eyebrow}</Eyebrow>
        <Pressable
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => setStep(steps.length - 1)}
        >
          <Text style={styles.skip}>{localize("Skip", "Saltar")}</Text>
        </Pressable>
      </View>

      <Animated.View key={`art-${step}`} entering={FadeIn.duration(220)} style={styles.art}>
        <View style={styles.artLabels}>
          <Mono>{current.before}</Mono>
          <Mono>{current.after}</Mono>
        </View>
        <IntervalMark label={current.marker} />
        <Mono style={styles.stepCount}>{String(step + 1).padStart(2, "0")}</Mono>
      </Animated.View>

      <Animated.View key={`copy-${step}`} entering={FadeIn.duration(220)} style={styles.copy}>
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
          <View style={[styles.check, adult && styles.checkOn]}>
            {adult ? <Text style={styles.tick}>✓</Text> : null}
          </View>
          <Body style={styles.checkLabel}>
            {localize("I confirm that I’m 18 or older.", "Confirmo que tengo 18 años o más.")}
          </Body>
        </Pressable>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.progress} accessibilityLabel={`${step + 1} / ${steps.length}`}>
          {steps.map((_, index) => (
            <View key={index} style={[styles.progressSegment, index <= step && styles.progressSegmentActive]} />
          ))}
        </View>
        <PrimaryButton onPress={next} disabled={busy || (step === steps.length - 1 && !adult)} variant={step === 0 ? "signal" : "primary"}>
          {busy ? localize("Opening settings…", "Abriendo ajustes…") : current.action}
        </PrimaryButton>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, minHeight: 760, justifyContent: "space-between" },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  skip: { color: colors.muted, fontFamily: fonts.brandMedium, fontSize: 13 },
  art: {
    minHeight: 205,
    paddingVertical: spacing.lg,
    justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.ink,
  },
  artLabels: { flexDirection: "row", justifyContent: "space-between" },
  stepCount: {
    alignSelf: "flex-end",
    color: colors.ruleStrong,
    fontFamily: fonts.monoMedium,
    fontSize: 46,
    lineHeight: 48,
    letterSpacing: -2,
  },
  copy: { gap: spacing.lg },
  body: { maxWidth: 520, color: colors.muted },
  checkRow: {
    minHeight: 68,
    padding: spacing.md,
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.ruleStrong,
    borderRadius: radius.control,
    borderCurve: "continuous",
  },
  check: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.ink,
    borderRadius: 4,
  },
  checkOn: { backgroundColor: colors.impact },
  tick: { color: colors.ink, fontFamily: fonts.brandBold },
  checkLabel: { flex: 1, fontSize: 14, lineHeight: 20 },
  pressed: { opacity: 0.72 },
  footer: { gap: spacing.lg },
  progress: { height: 3, flexDirection: "row", gap: spacing.xs },
  progressSegment: { flex: 1, backgroundColor: colors.rule },
  progressSegmentActive: { backgroundColor: colors.signal },
});

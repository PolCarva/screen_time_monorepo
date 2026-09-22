import { router } from "expo-router";
import { useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { AttentionField } from "@/components/attention-field";
import { FieldApertureMark } from "@/components/field-aperture-mark";
import { PrimaryButton } from "@/components/primary-button";
import { Screen } from "@/components/screen";
import {
  closeAction,
  retryAction,
  useStillSheet,
} from "@/components/still-sheet";
import { Body, Display, Eyebrow, Mono } from "@/components/typography";
import { localize } from "@/i18n";
import { isPauseFeatureEnabled } from "@/lib/restriction-mode";
import { restrictionEngine } from "@/native/restriction-engine";
import { useAppState } from "@/state/app-state";
import { colors, fonts, radius, spacing } from "@/theme/tokens";

const steps = [
  {
    label: localize("01 / THE MOMENT", "01 / EL MOMENTO"),
    title: localize(
      "Notice the second\nbefore you enter.",
      "Nota el segundo\nantes de entrar.",
    ),
    body: localize(
      "Before you open an app you chose, Still gives you a second to decide.",
      "Antes de abrir una app que elegiste, Still te da un segundo para decidir.",
    ),
    action: localize("Continue", "Continuar"),
    mode: "intervention" as const,
  },
  {
    label: localize("02 / THE CHOICE", "02 / LA ELECCIÓN"),
    title: localize(
      "Go back, or enter\nfor a clear window.",
      "Vuelve, o entra\npor un tiempo claro.",
    ),
    body: localize(
      "Going back is one tap. A pass keeps the app open for as long as you choose, from 1 minute to the rest of the day, and the pause returns the moment that time is up.",
      "Volver requiere un toque. Un pase mantiene la app abierta durante el tiempo que elijas, de 1 minuto al resto del día, y la pausa vuelve en el momento en que ese tiempo se cumple.",
    ),
    action: localize("Continue", "Continuar"),
    mode: "progress" as const,
  },
  {
    label: localize("03 / ON YOUR PHONE", "03 / EN TU TELÉFONO"),
    title: localize(
      "App names and detail\nstay on your phone.",
      "Los nombres y el detalle\nse quedan en tu teléfono.",
    ),
    body: localize(
      "Your apps and your history stay on your phone. Still only shares general counts for your passes and the fund.",
      "Tus apps y tu historial se quedan en tu teléfono. Solo compartimos conteos generales para tus pases y el fondo.",
    ),
    action: localize("Continue", "Continuar"),
    mode: "progress" as const,
  },
  {
    label: localize("04 / SETUP", "04 / CONFIGURACIÓN"),
    title: localize(
      "Choose where the\npause should appear.",
      "Elige dónde debería\naparecer la pausa.",
    ),
    body: localize(
      "Turn on Still and choose the apps you open without thinking. You can change them anytime.",
      "Activa Still y elige las apps que abres sin pensar. Puedes cambiarlas cuando quieras.",
    ),
    action: localize("Choose apps", "Elegir apps"),
    mode: "progress" as const,
  },
] as const;

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const { config, setOnboarded } = useAppState();
  const sheet = useStillSheet();
  const current = steps[step]!;
  const restrictionsEnabled = isPauseFeatureEnabled(Platform.OS, config);
  const currentTitle =
    step === steps.length - 1 && !restrictionsEnabled
      ? localize(
          "Pauses are\ncoming back soon.",
          "Las pausas\nvuelven pronto.",
        )
      : step === steps.length - 1 && Platform.OS === "ios"
        ? localize("Choose your\napps.", "Elige tus\napps.")
        : step === 1
          ? localize(
              "Go back, or enter\nfor as long as you choose.",
              "Vuelve, o entra\ndurante el tiempo que elijas.",
            )
          : current.title;
  const currentBody =
    step === steps.length - 1 && !restrictionsEnabled
      ? localize(
          "Finish now; when they're back, Still walks you through turning them on.",
          "Termina ahora; cuando vuelvan, Still te guía para activarlas.",
        )
      : step === steps.length - 1 && Platform.OS === "ios"
        ? localize(
            "Pick the apps here, then connect Apple's Shortcuts so it tells Still when you open them. Everything stays on this iPhone.",
            "Elige las apps aquí y luego conecta Atajos de Apple para que avise a Still cuando las abras. Todo se queda en este iPhone.",
          )
        : current.body;
  const currentAction =
    step === steps.length - 1 && !restrictionsEnabled
      ? localize("Finish setup", "Terminar configuración")
      : step === steps.length - 1 && Platform.OS === "ios"
        ? localize("Choose apps", "Elegir apps")
        : current.action;

  async function next() {
    if (step < steps.length - 1) {
      setStep((value) => value + 1);
      return;
    }
    if (!adult) return;
    setBusy(true);
    try {
      if (!restrictionsEnabled) {
        await setOnboarded(true);
        router.replace("/(tabs)/(today)");
        return;
      }
      if (Platform.OS === "ios") {
        await restrictionEngine.enableShortcutMode();
        await setOnboarded(true);
        router.replace({ pathname: "/ios-apps", params: { onboarding: "1" } });
        return;
      }
      await setOnboarded(true);
      router.replace("/android-setup");
    } catch {
      void sheet.show({
        title: localize("We couldn't continue", "No pudimos continuar"),
        message: localize("Try again.", "Vuelve a intentarlo."),
        actions: [retryAction(() => next()), closeAction()],
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen contentContainerStyle={styles.screen}>
      <View style={styles.top}>
        <FieldApertureMark size={34} />
        <Pressable
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => setStep(steps.length - 1)}
        >
          <Text style={styles.skip}>{localize("Skip", "Saltar")}</Text>
        </Pressable>
      </View>

      <Animated.View
        key={`field-${step}`}
        entering={FadeIn.duration(200)}
        style={styles.field}
      >
        <View style={styles.fieldTop}>
          <Eyebrow>{current.label}</Eyebrow>
          <Mono>{String(step + 1).padStart(2, "0")} / 04</Mono>
        </View>
        <AttentionField
          accessibilityLabel={localize(
            "A visual example of the attention field.",
            "Un ejemplo visual del campo de atención.",
          )}
          mode={current.mode}
          values={[]}
          animate={step === 0}
        />
      </Animated.View>

      <Animated.View
        key={`copy-${step}`}
        entering={FadeIn.duration(200)}
        style={styles.copy}
      >
        <Display>{currentTitle}</Display>
        <Body style={styles.body}>{currentBody}</Body>
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
            {localize(
              "I confirm that I am 18 or older.",
              "Confirmo que tengo 18 años o más.",
            )}
          </Body>
        </Pressable>
      ) : null}

      <View style={styles.footer}>
        <View
          accessible
          accessibilityLabel={`${step + 1} / ${steps.length}`}
          style={styles.progress}
        >
          {steps.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressSegment,
                index <= step && styles.progressSegmentActive,
                index === step && styles.progressSegmentCurrent,
              ]}
            />
          ))}
        </View>
        <PrimaryButton
          onPress={next}
          disabled={busy || (step === steps.length - 1 && !adult)}
        >
          {busy
            ? localize("Opening settings…", "Abriendo ajustes…")
            : currentAction}
        </PrimaryButton>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, minHeight: 760, justifyContent: "space-between" },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  skip: {
    color: colors.graphiteSoft,
    fontFamily: fonts.brandMedium,
    fontSize: 13,
  },
  field: {
    minHeight: 210,
    paddingVertical: spacing.lg,
    justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
  },
  fieldTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  copy: { gap: spacing.lg },
  body: { maxWidth: 520, color: colors.graphiteSoft },
  checkRow: {
    minHeight: 68,
    padding: spacing.md,
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.mineralLight,
    borderRadius: radius.control,
  },
  check: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.graphite,
    borderRadius: radius.sm,
  },
  checkOn: { backgroundColor: colors.mineral },
  tick: { color: colors.chalk, fontFamily: fonts.brandBold },
  checkLabel: { flex: 1, fontSize: 14, lineHeight: 20 },
  pressed: { opacity: 0.62 },
  footer: { gap: spacing.lg },
  progress: { height: 5, flexDirection: "row", gap: spacing.xs },
  progressSegment: {
    flex: 1,
    borderRadius: radius.xs,
    backgroundColor: colors.fog,
  },
  progressSegmentActive: { backgroundColor: colors.mineralLight },
  progressSegmentCurrent: { backgroundColor: colors.mineral },
});

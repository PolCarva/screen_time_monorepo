import { router } from "expo-router";
import { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AttentionField } from "@/components/attention-field";
import { FieldApertureMark } from "@/components/field-aperture-mark";
import {
  CheckFill,
  GrowFill,
  PressableScale,
  Reveal,
  rise,
  slideIn,
} from "@/components/motion";
import { PrimaryButton } from "@/components/primary-button";
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
import { colors, fonts, motion, radius, spacing, type } from "@/theme/tokens";

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
      "Going back is one tap. Watching an ad keeps the app open for as long as you choose, from 1 minute to the rest of the day, and the pause returns the moment that time is up. If no ad is available, a short pause still lets you in.",
      "Volver requiere un toque. Ver un anuncio mantiene la app abierta durante el tiempo que elijas, de 1 minuto al resto del día, y la pausa vuelve en el momento en que ese tiempo se cumple. Si no hay anuncio disponible, una pausa breve te deja entrar igual.",
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
      "Your apps and your history stay on your phone. Still only shares general counts for the ads you watch and the fund.",
      "Tus apps y tu historial se quedan en tu teléfono. Solo compartimos conteos generales de los anuncios que ves y del fondo.",
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

/**
 * How much room the phone leaves between its system bars. The four steps must
 * fit without scrolling, so smaller phones get a smaller title and field.
 */
type Density = "regular" | "compact" | "tight";

function densityFor(room: number): Density {
  if (room < 700) return "tight";
  if (room < 820) return "compact";
  return "regular";
}

const titleSizes = {
  regular: type.display,
  compact: { fontSize: 36, lineHeight: 38, letterSpacing: -1.4 },
  tight: { fontSize: 31, lineHeight: 33, letterSpacing: -1.1 },
} as const;

/** Recursive SemiBold's average glyph width, as a share of the font size. */
const GLYPH_WIDTH = 0.57;

/**
 * The titles break where they read best on a wide phone. On a narrower one a
 * line that no longer fits would wrap and leave a word alone, so the breaks
 * are kept only while every line still fits; otherwise the title flows.
 */
function fitBreaks(title: string, fontSize: number, width: number) {
  const lines = title.split("\n");
  const fits = lines.every(
    (line) => line.length * fontSize * GLYPH_WIDTH <= width,
  );
  return fits ? title : lines.join(" ");
}

function StepProgress({ step, total }: { step: number; total: number }) {
  return (
    <View
      accessible
      accessibilityLabel={`${step + 1} / ${total}`}
      style={styles.progress}
    >
      {Array.from({ length: total }, (_, index) => (
        <View key={index} style={styles.progressSegment}>
          <GrowFill
            color={index === step ? colors.mineral : colors.mineralLight}
            duration={motion.reveal}
            value={index <= step ? 1 : 0}
          />
        </View>
      ))}
    </View>
  );
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const density = densityFor(height - insets.top - insets.bottom);
  const textWidth = width - insets.left - insets.right - spacing.lg * 2;
  const [step, setStep] = useState(0);
  // False until the first step change: the first step arrives with the rest of
  // the screen, the next ones slide in on their own.
  const [moved, setMoved] = useState(false);
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const { config, setOnboarded } = useAppState();
  const sheet = useStillSheet();
  const current = steps[step]!;
  const lastStep = step === steps.length - 1;
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

  function goTo(next: number) {
    setMoved(true);
    setStep(next);
  }

  async function next() {
    if (step < steps.length - 1) {
      goTo(step + 1);
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

  const compact = density !== "regular";

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top + (compact ? spacing.sm : spacing.lg),
          paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.sm,
          paddingLeft: insets.left + spacing.lg,
          paddingRight: insets.right + spacing.lg,
        },
      ]}
    >
      <Reveal index={0} style={styles.top}>
        <FieldApertureMark size={compact ? 30 : 34} />
        {lastStep ? null : (
          <Animated.View entering={FadeIn.duration(motion.standard)}>
            <Pressable
              accessibilityRole="button"
              hitSlop={12}
              onPress={() => goTo(steps.length - 1)}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text style={styles.skip}>{localize("Skip", "Saltar")}</Text>
            </Pressable>
          </Animated.View>
        )}
      </Reveal>

      {/* Scrolls only on a very small screen or with very large text; on
          every common phone the whole step fits between the bars. */}
      <ScrollView
        bounces={false}
        contentContainerStyle={[
          styles.bodyContent,
          compact && styles.bodyContentCompact,
        ]}
        contentInsetAdjustmentBehavior="never"
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <Reveal
          index={1}
          style={[styles.field, compact && styles.fieldCompact]}
        >
          <View style={styles.fieldTop}>
            <Animated.View
              entering={moved ? slideIn(1) : undefined}
              key={`label-${step}`}
            >
              <Eyebrow>{current.label}</Eyebrow>
            </Animated.View>
            <Animated.View
              entering={moved ? rise(40, 8) : undefined}
              key={`count-${step}`}
            >
              <Mono>{String(step + 1).padStart(2, "0")} / 04</Mono>
            </Animated.View>
          </View>
          <Animated.View
            entering={moved ? FadeIn.duration(motion.reveal) : undefined}
            key={`art-${current.mode}`}
          >
            <AttentionField
              accessibilityLabel={localize(
                "A visual example of the attention field.",
                "Un ejemplo visual del campo de atención.",
              )}
              animate={step === 0}
              compact={density === "tight"}
              mode={current.mode}
              values={[]}
            />
          </Animated.View>
        </Reveal>

        <Reveal index={2} style={styles.copyGroup}>
          <Animated.View
            entering={moved ? slideIn(1, 40) : undefined}
            key={`copy-${step}`}
            style={[styles.copy, compact && styles.copyCompact]}
          >
            <Display style={titleSizes[density]} textBreakStrategy="balanced">
              {fitBreaks(currentTitle, titleSizes[density].fontSize, textWidth)}
            </Display>
            <Body style={[styles.bodyText, density === "tight" && styles.bodyTight]}>
              {currentBody}
            </Body>
          </Animated.View>

          {lastStep ? (
            <Animated.View entering={rise(140)}>
              <PressableScale
                accessibilityRole="checkbox"
                accessibilityState={{ checked: adult }}
                onPress={() => setAdult((value) => !value)}
                scaleTo={0.985}
                style={[styles.checkRow, compact && styles.checkRowCompact]}
              >
                <View style={[styles.check, adult && styles.checkOn]}>
                  <CheckFill checked={adult} color={colors.mineral}>
                    <Text style={styles.tick}>✓</Text>
                  </CheckFill>
                </View>
                <Body style={styles.checkLabel}>
                  {localize(
                    "I confirm that I am 18 or older.",
                    "Confirmo que tengo 18 años o más.",
                  )}
                </Body>
              </PressableScale>
            </Animated.View>
          ) : null}
        </Reveal>
      </ScrollView>

      <Reveal index={3} style={[styles.footer, compact && styles.footerCompact]}>
        <StepProgress step={step} total={steps.length} />
        <PrimaryButton
          onPress={next}
          disabled={busy || (lastStep && !adult)}
        >
          {busy
            ? localize("Opening settings…", "Abriendo ajustes…")
            : currentAction}
        </PrimaryButton>
      </Reveal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  top: {
    minHeight: 34,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  skip: {
    color: colors.graphiteSoft,
    fontFamily: fonts.brandMedium,
    fontSize: 13,
  },
  pressed: { opacity: 0.5 },
  scroll: { flex: 1 },
  bodyContent: {
    flexGrow: 1,
    justifyContent: "space-between",
    gap: spacing.xl,
    paddingVertical: spacing.xl,
  },
  bodyContentCompact: { gap: spacing.lg, paddingVertical: spacing.lg },
  field: {
    paddingVertical: spacing.lg,
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
  },
  fieldCompact: { paddingVertical: spacing.md, gap: spacing.sm },
  fieldTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  copyGroup: { gap: spacing.lg },
  copy: { gap: spacing.lg },
  copyCompact: { gap: spacing.md },
  bodyText: { maxWidth: 520, color: colors.graphiteSoft },
  bodyTight: { fontSize: 15, lineHeight: 22 },
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
  checkRowCompact: { minHeight: 58, paddingVertical: spacing.sm },
  check: {
    width: 28,
    height: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.graphite,
    borderRadius: radius.sm,
  },
  checkOn: { borderColor: colors.mineral },
  tick: { color: colors.chalk, fontFamily: fonts.brandBold },
  checkLabel: { flex: 1, fontSize: 14, lineHeight: 20 },
  footer: { gap: spacing.lg },
  footerCompact: { gap: spacing.md },
  progress: { height: 5, flexDirection: "row", gap: spacing.xs },
  progressSegment: {
    flex: 1,
    overflow: "hidden",
    borderRadius: radius.xs,
    backgroundColor: colors.fog,
  },
});

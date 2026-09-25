import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { AnimatedNumber, GrowIn, Skeleton, rise } from "@/components/motion";
import {
  StoryFooter,
  StoryLayout,
  useStoryMetrics,
} from "@/components/onboarding/story-screen";
import { Body } from "@/components/typography";
import { androidSys, locale, localize } from "@/i18n";
import { usageAccessKeys } from "@/lib/system-strings";
import {
  compareToGuess,
  formatUsageMinutes,
  type UsageInsights,
} from "@/lib/onboarding-insights";
import { colors, fonts, motion, radius, spacing } from "@/theme/tokens";

/** Seven empty days with a "?" across them: what Still can't see yet. */
function UnknownWeek() {
  return (
    <View
      accessible
      accessibilityLabel={localize(
        "Your last seven days, not known yet.",
        "Tus últimos siete días, todavía sin datos.",
      )}
      style={styles.week}
    >
      <View style={styles.columns}>
        {Array.from({ length: 7 }, (_, index) => (
          <GrowIn delay={index * 40} key={index} style={styles.column} />
        ))}
      </View>
      <View style={styles.line}>
        {Array.from({ length: 14 }, (_, index) => (
          <View key={index} style={styles.dash} />
        ))}
      </View>
      <View style={styles.questionWrap}>
        <Text style={styles.question}>?</Text>
      </View>
    </View>
  );
}

export type UsagePermissionState = "idle" | "waiting" | "denied";

/**
 * §3.2 — asks for Usage access, saying what is read and that it stays on the
 * phone (Google Play's prominent disclosure). Settings differ by maker, so a
 * failed return shows the official labels and the way that always works.
 */
export function UsagePermissionStep({
  state,
  onGrant,
  onSkip,
}: {
  state: UsagePermissionState;
  onGrant: () => void;
  onSkip: () => void;
}) {
  const { compact } = useStoryMetrics();
  // The page's own words on this phone's Android release; a maker's skin can
  // still word it differently, hence the note under the steps.
  const labels = usageAccessKeys(
    typeof Platform.Version === "number" ? Platform.Version : 34,
  );
  return (
    <StoryLayout
      body={localize(
        "With usage access, Still counts how much you use each app. It's worked out on this phone and doesn't leave it.",
        "Con el acceso de uso, Still cuenta cuánto usas cada app. Se calcula en este teléfono y no sale de aquí.",
      )}
      footer={
        <StoryFooter
          primary={{
            label: state === "denied"
              ? localize("Try again", "Volver a intentar")
              : localize("See my real time", "Ver mi tiempo real"),
            onPress: onGrant,
          }}
          secondary={{
            label: localize("Continue without my data", "Seguir sin mi dato"),
            onPress: onSkip,
          }}
        />
      }
      title={localize("Now, your real time.", "Ahora, tu tiempo real.")}
    >
      {state === "denied" ? (
        <Animated.View entering={FadeIn.duration(motion.standard)} style={styles.help}>
          <Text accessibilityLiveRegion="polite" style={styles.helpTitle}>
            {localize("Usage access isn't on.", "No se activó el acceso de uso.")}
          </Text>
          {[
            localize(
              `Find Still in “${androidSys(labels.title)}”.`,
              `Busca Still en «${androidSys(labels.title)}».`,
            ),
            localize(
              `Turn on “${androidSys(labels.toggle)}”, then come back.`,
              `Activa «${androidSys(labels.toggle)}» y vuelve.`,
            ),
          ].map((line, index) => (
            <View key={line} style={styles.helpRow}>
              <Text style={styles.helpNumber}>{index + 1}</Text>
              <Body style={styles.helpText}>{line}</Body>
            </View>
          ))}
          <Text style={styles.helpNote}>
            {localize(
              "Your phone may look different: search for Still in Settings and turn the permission on.",
              "En tu teléfono puede verse distinto: busca Still en Ajustes y activa el permiso.",
            )}
          </Text>
        </Animated.View>
      ) : (
        <View style={compact ? styles.visualCompact : undefined}>
          <UnknownWeek />
          {state === "waiting" ? (
            <Text style={styles.waiting}>
              {localize(
                "Turn it on, then come back to Still.",
                "Actívalo y vuelve a Still.",
              )}
            </Text>
          ) : null}
        </View>
      )}
    </StoryLayout>
  );
}

/** "53 % more than you thought", with an arrow; peach for more, mineral otherwise. */
function ComparisonChip({ real, guess }: { real: number; guess: number }) {
  const comparison = compareToGuess(real, guess);
  const more = comparison.kind === "more";
  const color = more ? colors.peach : colors.mineral;
  const percent = localize(`${comparison.percent}%`, `${comparison.percent} %`);
  const text =
    comparison.kind === "close"
      ? localize("Very close to what you thought.", "Muy cerca de lo que creías.")
      : more
        ? localize(`${percent} more than you thought.`, `${percent} más de lo que creías.`)
        : localize(`${percent} less than you thought.`, `${percent} menos de lo que creías.`);
  return (
    <Animated.View entering={rise(motion.count)} style={styles.chip}>
      {comparison.kind === "close" ? null : (
        <View style={[styles.arrow, { backgroundColor: color }]}>
          <Ionicons
            color={colors.white}
            name={more ? "arrow-up" : "arrow-down"}
            size={16}
            style={{ transform: [{ rotate: more ? "45deg" : "-45deg" }] }}
          />
        </View>
      )}
      <Text style={[styles.chipText, { color }]}>{text}</Text>
    </Animated.View>
  );
}

/** §3.3 — the real daily time, against the guess, and how often the phone is unlocked. */
export function RevealStep({
  insights,
  guessMinutes,
  onNext,
}: {
  /** Undefined while it is read; null when the phone has no use recorded. */
  insights: UsageInsights | null | undefined;
  guessMinutes: number;
  onNext: () => void;
}) {
  const { density } = useStoryMetrics();
  const size = density === "regular" ? 64 : density === "compact" ? 54 : 46;
  const footer = (
    <StoryFooter
      primary={{
        label: localize("Continue", "Continuar"),
        onPress: onNext,
        disabled: insights === undefined,
      }}
    />
  );
  if (insights === null) {
    return (
      <StoryLayout
        body={localize(
          "We'll go on with what you thought.",
          "Seguimos con lo que creías.",
        )}
        footer={footer}
        title={localize(
          "There's no usage on this phone yet.",
          "Todavía no hay datos de uso en este teléfono.",
        )}
      />
    );
  }
  const basis =
    insights === undefined
      ? localize("Counting…", "Contando…")
      : insights.basis === "today"
        ? localize("today so far", "hoy, hasta ahora")
        : localize(
            `a day · average of the last ${insights.measuredDays} ${insights.measuredDays === 1 ? "day" : "days"}`,
            `al día · promedio de ${insights.measuredDays === 1 ? "el último día" : `los últimos ${insights.measuredDays} días`}`,
          );
  return (
    <StoryLayout
      eyebrow={localize("Your real time", "Tu tiempo real")}
      footer={footer}
      title={localize("This is what you use.", "Esto es lo que usas.")}
    >
      <View style={styles.reveal}>
        {insights === undefined ? (
          <Skeleton style={[styles.skeleton, { height: size }]} />
        ) : (
          <AnimatedNumber
            accessibilityLabel={formatUsageMinutes(insights.dailyMinutes, locale)}
            format={(value) => formatUsageMinutes(value, locale)}
            style={[
              styles.hero,
              { fontSize: size, lineHeight: size * 1.05, letterSpacing: -size * 0.045 },
            ]}
            value={insights.dailyMinutes}
          />
        )}
        <Text style={styles.basis}>{basis}</Text>
        {insights ? (
          <>
            <ComparisonChip guess={guessMinutes} real={insights.dailyMinutes} />
            {insights.unlocksPerDay !== null ? (
              <Animated.View entering={rise(motion.count + motion.stagger * 2)}>
                <Body style={styles.unlocks}>
                  {insights.basis === "today"
                    ? localize(
                        `You've unlocked your phone ${insights.unlocksPerDay} times today.`,
                        `Hoy desbloqueaste el teléfono ${insights.unlocksPerDay} veces.`,
                      )
                    : localize(
                        `You unlock your phone ${insights.unlocksPerDay} times a day.`,
                        `Desbloqueas el teléfono ${insights.unlocksPerDay} veces al día.`,
                      )}
                </Body>
              </Animated.View>
            ) : null}
          </>
        ) : null}
      </View>
    </StoryLayout>
  );
}

const styles = StyleSheet.create({
  week: { height: 180, justifyContent: "center" },
  columns: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  column: {
    width: "10%",
    borderRadius: radius.md,
    backgroundColor: colors.fog,
  },
  line: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xs,
  },
  dash: {
    width: 10,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.mineralLight,
  },
  questionWrap: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  question: {
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.paper,
    color: colors.mineral,
    fontFamily: fonts.brandBold,
    fontSize: 56,
    lineHeight: 64,
  },
  visualCompact: { transform: [{ scale: 0.9 }] },
  waiting: {
    paddingTop: spacing.md,
    textAlign: "center",
    color: colors.graphiteSoft,
    fontFamily: fonts.brandMedium,
    fontSize: 14,
  },
  help: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
    backgroundColor: colors.chalkRaised,
  },
  helpTitle: {
    color: colors.graphite,
    fontFamily: fonts.brandSemiBold,
    fontSize: 16,
  },
  helpRow: { flexDirection: "row", gap: spacing.sm },
  helpNumber: {
    width: 20,
    color: colors.mineral,
    fontFamily: fonts.monoMedium,
    fontSize: 15,
    lineHeight: 24,
  },
  helpText: { flex: 1, fontSize: 15, lineHeight: 22 },
  helpNote: {
    color: colors.graphiteSoft,
    fontFamily: fonts.brand,
    fontSize: 13,
    lineHeight: 19,
  },
  reveal: { alignItems: "center", gap: spacing.sm },
  skeleton: {
    width: "70%",
    borderRadius: radius.md,
    backgroundColor: colors.fog,
  },
  hero: {
    color: colors.graphite,
    fontFamily: fonts.brandSemiBold,
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
  basis: {
    color: colors.graphiteSoft,
    fontFamily: fonts.brandMedium,
    fontSize: 14,
    textAlign: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  arrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: {
    flexShrink: 1,
    fontFamily: fonts.brandSemiBold,
    fontSize: 18,
    lineHeight: 24,
  },
  unlocks: { textAlign: "center", color: colors.graphiteSoft },
});

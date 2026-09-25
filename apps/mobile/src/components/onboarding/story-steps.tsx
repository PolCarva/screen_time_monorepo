import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { AnimatedNumber, GrowFill, rise } from "@/components/motion";
import {
  DemoAppIcon,
  HomeGrid,
  PhoneFrame,
  type DemoApp,
} from "@/components/onboarding/phone";
import { PauseReplica } from "@/components/onboarding/pause-replica";
import {
  StoryFooter,
  StoryLayout,
  useStoryMetrics,
} from "@/components/onboarding/story-screen";
import { SteppedSlider } from "@/components/stepped-slider";
import { Body } from "@/components/typography";
import { locale, localize } from "@/i18n";
import { openExternalBrowser } from "@/lib/external-browser";
import {
  GUESS_STEPS_MINUTES,
  LIFE_HORIZON_YEARS,
  formatDecimal,
  formatGuess,
  formatUsageMinutes,
  lifeTotals,
  shareHeadline,
  type UsageInsights,
} from "@/lib/onboarding-insights";
import { colors, fonts, motion, radius, spacing } from "@/theme/tokens";

const continueLabel = () => localize("Continue", "Continuar");

/** Big numbers: the guess, the years. Smaller phones get a smaller one. */
function useHeroSize(scale = 1) {
  const { density } = useStoryMetrics();
  const base = density === "regular" ? 72 : density === "compact" ? 60 : 50;
  const size = Math.round(base * scale);
  return {
    fontSize: size,
    lineHeight: Math.round(size * 1.02),
    letterSpacing: -size * 0.045,
  };
}

/** §3.1 — how much the user thinks they use the phone, before any data. */
export function GuessStep({
  value,
  onChange,
  onNext,
}: {
  value: number;
  onChange: (minutes: number) => void;
  onNext: () => void;
}) {
  const hero = useHeroSize(0.8);
  const format = (minutes: number) => formatGuess(minutes, locale);
  return (
    <StoryLayout
      body={localize("No peeking. Your best guess.", "Sin mirar. Lo que creas.")}
      footer={<StoryFooter primary={{ label: continueLabel(), onPress: onNext }} />}
      title={localize(
        "How much do you think you use your phone a day?",
        "¿Cuánto crees que usas el teléfono al día?",
      )}
    >
      <View style={styles.center}>
        <Text
          accessibilityLiveRegion="polite"
          adjustsFontSizeToFit
          numberOfLines={1}
          style={[styles.hero, hero]}
        >
          {format(value)}
        </Text>
        <Text style={styles.heroUnit}>{localize("a day", "al día")}</Text>
      </View>
      <SteppedSlider
        accessibilityLabel={localize(
          "How much you think you use your phone a day",
          "Cuánto crees que usas el teléfono al día",
        )}
        format={format}
        onChange={onChange}
        showValue={false}
        steps={GUESS_STEPS_MINUTES}
        tone="light"
        value={value}
      />
    </StoryLayout>
  );
}

/** §3.4 — what the daily time adds up to over 30 years, said as a fact (D6). */
export function LifeStep({
  dailyMinutes,
  fromGuess,
  onNext,
}: {
  dailyMinutes: number;
  /** The number is the user's guess, not measured use. */
  fromGuess: boolean;
  onNext: () => void;
}) {
  const hero = useHeroSize(1.6);
  const totals = lifeTotals(dailyMinutes);
  const perDay = localize(
    `${formatUsageMinutes(dailyMinutes, "en")} a day`,
    `${formatUsageMinutes(dailyMinutes, "es")} al día`,
  );
  return (
    <StoryLayout
      eyebrow={
        fromGuess
          ? `${perDay} · ${localize("your guess", "según lo que creías")}`
          : perDay
      }
      footer={<StoryFooter primary={{ label: continueLabel(), onPress: onNext }} />}
      title={localize(
        `Over ${LIFE_HORIZON_YEARS} years, that adds up to:`,
        `En ${LIFE_HORIZON_YEARS} años, eso suma:`,
      )}
    >
      <View
        accessible
        accessibilityLabel={localize(
          `${formatDecimal(totals.years, "en")} years in front of the screen. That's ${totals.daysPerYear} days a year.`,
          `${formatDecimal(totals.years, "es")} años frente a la pantalla. Son ${totals.daysPerYear} días al año.`,
        )}
        style={styles.center}
      >
        <AnimatedNumber
          format={(current) => formatDecimal(current, locale)}
          style={[styles.hero, styles.heroPeach, hero]}
          value={totals.years}
        />
        <Text style={styles.lifeUnit}>
          {localize("years in front of the screen", "años frente a la pantalla")}
        </Text>
        <Body style={styles.lifeNote}>
          {localize(
            `That's ${totals.daysPerYear} days a year.`,
            `Son ${totals.daysPerYear} días al año.`,
          )}
        </Body>
      </View>
    </StoryLayout>
  );
}

const STUDY_URL = "https://www.pnas.org/doi/10.1073/pnas.2213114120";

/**
 * The one outside number the story uses (D3): a published study, named, with
 * the app it was run with. Never presented as Still's own result.
 */
function StudyCard({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.study, compact && styles.studyCompact]}>
      <View style={styles.studyStats}>
        <View style={styles.studyStat}>
          <Text style={[styles.studyNumber, compact && styles.studyNumberCompact]}>
            {localize("57%", "57 %")}
          </Text>
          <Text style={styles.studyLabel}>
            {localize(
              "fewer opens of those apps after 6 weeks",
              "menos aperturas de esas apps tras 6 semanas",
            )}
          </Text>
        </View>
        <View style={styles.studyStat}>
          <Text style={[styles.studyNumber, compact && styles.studyNumberCompact]}>
            {localize("1 in 3", "1 de 3")}
          </Text>
          <Text style={styles.studyLabel}>
            {localize(
              "times, people chose not to go in",
              "veces, la gente decidió no entrar",
            )}
          </Text>
        </View>
      </View>
      <Pressable
        accessibilityHint={localize("Opens the study.", "Abre el estudio.")}
        accessibilityRole="link"
        hitSlop={6}
        onPress={() => void openExternalBrowser(STUDY_URL).catch(() => undefined)}
        style={({ pressed }) => [styles.source, pressed && styles.pressed]}
      >
        <Text style={styles.sourceText}>
          {localize(
            "Grüning, Riedel & Lorenz-Spreen · PNAS, 2023 · Max Planck Institute and Heidelberg University, with the one sec app ↗",
            "Grüning, Riedel y Lorenz-Spreen · PNAS, 2023 · Instituto Max Planck y Universidad de Heidelberg, con la app one sec ↗",
          )}
        </Text>
      </Pressable>
    </View>
  );
}

function shareTitle(share: number, count: number) {
  const apps = localize(
    count === 1 ? "one app" : `${count} apps`,
    count === 1 ? "una sola app" : `${count} apps`,
  );
  switch (shareHeadline(share)) {
    case "moreThanHalf":
      return localize(`More than half goes to ${apps}.`, `Más de la mitad es de ${apps}.`);
    case "almostHalf":
      return localize(`Almost half goes to ${apps}.`, `Casi la mitad es de ${apps}.`);
    case "aThird":
      return localize(`A third goes to ${apps}.`, `Un tercio es de ${apps}.`);
    case "aQuarter":
      return localize(`A quarter goes to ${apps}.`, `Un cuarto es de ${apps}.`);
    default:
      return count === 1
        ? localize("Your most used app.", "Tu app más usada.")
        : localize(`Your ${count} most used apps.`, `Tus ${count} apps más usadas.`);
  }
}

/**
 * §3.5 — where the time goes (with usage data) and what a short pause did in a
 * published study (always).
 */
export function WhereStep({
  insights,
  icons,
  onNext,
}: {
  insights: UsageInsights | null;
  /** Real app icons by package, Android only, held in memory. */
  icons: Record<string, string>;
  onNext: () => void;
}) {
  const top = insights?.topApps.slice(0, 3) ?? [];
  const footer = (
    <StoryFooter primary={{ label: continueLabel(), onPress: onNext }} />
  );
  if (!insights || top.length === 0) {
    return (
      <StoryLayout
        body={localize(
          "A study measured what happens when a pause shows up before an app opens.",
          "Un estudio midió qué pasa cuando aparece una pausa antes de abrir una app.",
        )}
        footer={footer}
        title={localize(
          "A short pause changes the habit.",
          "Una pausa corta cambia el hábito.",
        )}
      >
        <StudyCard />
      </StoryLayout>
    );
  }
  return (
    <StoryLayout
      centerVisual={false}
      footer={footer}
      title={shareTitle(insights.topShare, top.length)}
    >
      <View style={styles.bars}>
        {top.map((app, index) => (
          <Animated.View
            entering={rise(120 + index * motion.stagger)}
            key={app.packageName}
            style={styles.barRow}
          >
            {icons[app.packageName] ? (
              <DemoAppIcon
                app={{ label: app.label, icon: { kind: "image", uri: icons[app.packageName]! } }}
                size={36}
              />
            ) : (
              <View style={styles.iconPlaceholder} />
            )}
            <View style={styles.barBody}>
              <View style={styles.barHeader}>
                <Text numberOfLines={1} style={styles.barLabel}>
                  {app.label}
                </Text>
                <Text style={styles.barValue}>
                  {localize(
                    `${formatUsageMinutes(app.dailyMinutes, "en")} a day`,
                    `${formatUsageMinutes(app.dailyMinutes, "es")} al día`,
                  )}
                </Text>
              </View>
              <View style={styles.barTrack}>
                <GrowFill
                  color={index === 0 ? colors.peach : colors.mineral}
                  delay={200 + index * 120}
                  value={Math.min(1, app.dailyMinutes / insights.dailyMinutes)}
                />
              </View>
            </View>
          </Animated.View>
        ))}
      </View>
      <StudyCard compact />
    </StoryLayout>
  );
}

/**
 * The phone the demo steps draw in, sized to the room left. The pause needs a
 * taller view than the home screen: its buttons sit at the bottom.
 */
function useDemoPhone(tall = false) {
  const { contentWidth, room, density } = useStoryMetrics();
  const width = Math.min(contentWidth, density === "regular" ? 300 : 260);
  const share = (density === "tight" ? 0.4 : 0.46) + (tall ? 0.06 : 0);
  const visibleHeight = Math.min(
    width * 1.35,
    Math.max(width * (tall ? 1.05 : 0.85), room * share),
  );
  return { width, visibleHeight, screenWidth: width - Math.max(5, Math.round(width * 0.022)) * 2 };
}

/** §3.6 — the automatic tap, on a home screen with the app lit. */
export function HabitStep({ app, onNext }: { app: DemoApp; onNext: () => void }) {
  const phone = useDemoPhone();
  return (
    <StoryLayout
      footer={
        <StoryFooter
          note={localize("Tap the app or press Continue.", "Toca la app o pulsa Continuar.")}
          primary={{ label: continueLabel(), onPress: onNext }}
        />
      }
      title={localize(
        "Old habits kick in on their own: you tap without thinking.",
        "Los viejos hábitos se activan solos: tocas sin pensar.",
      )}
    >
      <PhoneFrame visibleHeight={phone.visibleHeight} width={phone.width}>
        <HomeGrid app={app} onPressApp={onNext} pointer width={phone.screenWidth} />
      </PhoneFrame>
    </StoryLayout>
  );
}

type DemoState = "gate" | "back" | "ad";

/** §3.7 — the pause, with the real pause's words; both choices can be tried. */
export function PauseDemoStep({
  app,
  onNext,
}: {
  app: DemoApp;
  onNext: () => void;
}) {
  const phone = useDemoPhone(true);
  const [state, setState] = useState<DemoState>("gate");
  const platform = Platform.OS === "android" ? "android" : "ios";
  const caption =
    state === "back"
      ? localize("Going back is one tap.", "Volver es un toque.")
      : state === "ad"
        ? localize(
            "An ad lets you in for as long as you choose. If there's no ad, a short wait.",
            "Un anuncio te deja entrar el tiempo que elijas. Si no hay anuncio, una espera breve.",
          )
        : localize("Try it: this is the pause.", "Pruébala: así es la pausa.");
  return (
    <StoryLayout
      footer={<StoryFooter primary={{ label: continueLabel(), onPress: onNext }} />}
      title={localize(
        "Still shows up first. You choose.",
        "Still aparece antes. Tú eliges.",
      )}
    >
      <PhoneFrame fit visibleHeight={phone.visibleHeight} width={phone.width}>
        <Animated.View
          entering={FadeIn.duration(motion.reveal)}
          key={state === "back" ? "home" : "pause"}
          style={styles.fill}
        >
          {state === "back" ? (
            <HomeGrid app={app} width={phone.screenWidth} />
          ) : (
            <PauseReplica
              appLabel={app.label}
              onDecline={() => setState("back")}
              onWatchAd={() => setState("ad")}
              platform={platform}
              width={phone.screenWidth}
            />
          )}
        </Animated.View>
      </PhoneFrame>
      <Animated.View entering={FadeIn.duration(motion.standard)} key={state} style={styles.captionRow}>
        <Body accessibilityLiveRegion="polite" style={styles.caption}>
          {caption}
        </Body>
        {state === "gate" ? null : (
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setState("gate")}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text style={styles.again}>{localize("See it again", "Ver de nuevo")}</Text>
          </Pressable>
        )}
      </Animated.View>
    </StoryLayout>
  );
}

/** §3.8 — how it works, in three lines, and where the data stays. */
export function HowStep({ onNext }: { onNext: () => void }) {
  const rows = [
    localize(
      "You choose the apps you open without thinking.",
      "Eliges las apps que abres sin pensar.",
    ),
    localize(
      "Before they open, the pause shows up: go back or go in.",
      "Antes de abrirlas aparece la pausa: volver o entrar.",
    ),
    localize(
      "Going in costs one ad. Ads fund Still and a weekly fund; in Impact you vote where it goes.",
      "Entrar cuesta un anuncio. Los anuncios financian Still y un fondo semanal; en Impacto votas a dónde va.",
    ),
  ];
  return (
    <StoryLayout
      centerVisual={false}
      footer={
        <StoryFooter
          primary={{ label: localize("Set up Still", "Configurar Still"), onPress: onNext }}
        />
      }
      title={localize("Here's how it works.", "Así funciona.")}
    >
      <View style={styles.rows}>
        {rows.map((row, index) => (
          <Animated.View
            entering={rise(100 + index * motion.stagger)}
            key={row}
            style={styles.row}
          >
            <Text style={styles.rowNumber}>{String(index + 1).padStart(2, "0")}</Text>
            <Body style={styles.rowText}>{row}</Body>
          </Animated.View>
        ))}
      </View>
      <View style={styles.privacy}>
        <Ionicons color={colors.mineral} name="lock-closed-outline" size={16} />
        <Text style={styles.privacyText}>
          {localize(
            "Your apps and your use stay on this phone.",
            "Tus apps y tu uso no salen de este teléfono.",
          )}
        </Text>
      </View>
    </StoryLayout>
  );
}


const styles = StyleSheet.create({
  center: { alignItems: "center", gap: spacing.xs },
  fill: { flex: 1 },
  hero: {
    color: colors.graphite,
    fontFamily: fonts.brandSemiBold,
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
  heroPeach: { color: colors.peach },
  heroUnit: {
    color: colors.graphiteSoft,
    fontFamily: fonts.brandMedium,
    fontSize: 15,
  },
  lifeUnit: {
    color: colors.graphite,
    fontFamily: fonts.brandSemiBold,
    fontSize: 20,
    lineHeight: 24,
    textAlign: "center",
  },
  lifeNote: { color: colors.graphiteSoft, textAlign: "center" },
  study: {
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
    backgroundColor: colors.chalkRaised,
  },
  studyCompact: { gap: spacing.md, padding: spacing.md },
  studyStats: { flexDirection: "row", gap: spacing.lg },
  studyStat: { flex: 1, gap: spacing.xxs },
  studyNumber: {
    color: colors.mineral,
    fontFamily: fonts.brandSemiBold,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1.4,
  },
  studyNumberCompact: { fontSize: 30, lineHeight: 33, letterSpacing: -1 },
  studyLabel: {
    color: colors.graphite,
    fontFamily: fonts.brand,
    fontSize: 14,
    lineHeight: 19,
  },
  source: { paddingTop: spacing.xs },
  sourceText: {
    color: colors.graphiteSoft,
    fontFamily: fonts.brand,
    fontSize: 11,
    lineHeight: 16,
  },
  bars: { gap: spacing.md },
  barRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.fog,
  },
  barBody: { flex: 1, gap: spacing.xs },
  barHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  barLabel: {
    flexShrink: 1,
    color: colors.graphite,
    fontFamily: fonts.brandSemiBold,
    fontSize: 15,
  },
  barValue: {
    color: colors.graphiteSoft,
    fontFamily: fonts.brand,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  barTrack: {
    height: 8,
    overflow: "hidden",
    borderRadius: radius.sm,
    backgroundColor: colors.fog,
  },
  captionRow: { alignItems: "center", gap: spacing.xs, minHeight: 64 },
  caption: {
    textAlign: "center",
    color: colors.graphiteSoft,
    fontSize: 15,
    lineHeight: 22,
  },
  again: {
    color: colors.graphite,
    fontFamily: fonts.brandSemiBold,
    fontSize: 13,
    textDecorationLine: "underline",
    textDecorationColor: colors.mineralLight,
  },
  rows: { gap: spacing.lg },
  row: { flexDirection: "row", gap: spacing.md },
  rowNumber: {
    width: 28,
    color: colors.mineral,
    fontFamily: fonts.monoMedium,
    fontSize: 15,
    lineHeight: 24,
  },
  rowText: { flex: 1 },
  privacy: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
  },
  privacyText: {
    flex: 1,
    color: colors.graphiteSoft,
    fontFamily: fonts.brand,
    fontSize: 13,
    lineHeight: 19,
  },
  pressed: { opacity: 0.5 },
});

import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { AnimatedNumber, GrowFill, GrowIn, Skeleton } from "@/components/motion";
import { Screen } from "@/components/screen";
import { Body, Eyebrow, Heading, Mono } from "@/components/typography";
import { locale, localize } from "@/i18n";
import { formatUsageMinutes } from "@/lib/onboarding-insights";
import { restrictionEngine } from "@/native/restriction-engine";
import {
  SAVINGS_PERIODS,
  type AppSavings,
  type SavingsPeriod,
  summarizeSavings,
} from "@/lib/savings";
import { typicalMinutes, type SavedTimeSource } from "@/lib/saved-time";
import { weekdayLabel } from "@/lib/today-summary";
import { useAppState } from "@/state/app-state";
import { useSavedTime } from "@/state/saved-time";
import { useSavingsHistory } from "@/state/savings-history";
import { colors, fonts, radius, spacing } from "@/theme/tokens";

const intlLocale = locale === "es" ? "es" : "en";
const shortWeekday = new Intl.DateTimeFormat(intlLocale, { weekday: "short" });
const dayMonth = new Intl.DateTimeFormat(intlLocale, { day: "numeric", month: "short" });

const CHART_HEIGHT = 88;

function periodLabel(period: SavingsPeriod) {
  switch (period) {
    case "today":
      return localize("Today", "Hoy");
    case "week":
      return localize("7 days", "7 días");
    case "month":
      return localize("30 days", "30 días");
    case "all":
      return localize("All", "Todo");
  }
}

/** "returned today" / "recuperados en los últimos 7 días"… */
function periodCaption(period: SavingsPeriod) {
  switch (period) {
    case "today":
      return localize("returned today", "recuperados hoy");
    case "week":
      return localize("returned in the last 7 days", "recuperados en los últimos 7 días");
    case "month":
      return localize("returned in the last 30 days", "recuperados en los últimos 30 días");
    case "all":
      return localize("returned since you started", "recuperados desde que empezaste");
  }
}

function minutesLabel(minutes: number) {
  return formatUsageMinutes(minutes, locale);
}

function times(count: number) {
  return localize(
    count === 1 ? "once" : `${count} times`,
    count === 1 ? "1 vez" : `${count} veces`,
  );
}

function sourceLabel(source: SavedTimeSource) {
  if (source === "before") return localize("before Still", "antes de Still");
  if (source === "recent") return localize("last 7 days", "últimos 7 días");
  return localize("estimated", "estimado");
}

/** "Didn't go in 6 times · ~10 min each (last 7 days)". */
function appDetail(app: AppSavings) {
  const each = new Intl.NumberFormat(locale, {
    maximumFractionDigits: app.minutesEach < 10 ? 1 : 0,
  }).format(app.minutesEach);
  const parts = [
    localize(`Didn't go in ${times(app.skipped)}`, `No entraste ${times(app.skipped)}`),
    localize(
      `~${each} min each (${sourceLabel(app.source)})`,
      `~${each} min cada una (${sourceLabel(app.source)})`,
    ),
  ];
  if (!app.chosen) parts.push(localize("no longer paused", "ya no la pausas"));
  return parts.join(" · ");
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text numberOfLines={1} style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

function DayBars({
  days,
  period,
}: {
  days: { date: string; minutes: number }[];
  period: SavingsPeriod;
}) {
  const highest = Math.max(1, ...days.map((day) => day.minutes));
  const labels = {
    today: localize("Today", "Hoy"),
    format: (date: Date) => shortWeekday.format(date),
  };
  const first = new Date(`${days[0]?.date}T12:00:00`);
  return (
    <View style={styles.chartBlock}>
      <View style={[styles.chart, period === "month" && styles.chartDense]}>
        {days.map((day, index) => {
          const height =
            day.minutes > 0 ? Math.max(3, Math.round((day.minutes / highest) * CHART_HEIGHT)) : 0;
          return (
            <View
              accessibilityLabel={`${day.date}: ${minutesLabel(day.minutes)}`}
              accessible
              key={day.date}
              style={styles.chartColumn}
            >
              <View style={styles.chartTrack}>
                {height > 0 ? (
                  <GrowIn delay={80 + index * (period === "month" ? 12 : 40)} style={[styles.chartBar, { height }]} />
                ) : null}
              </View>
              {period === "week" ? (
                <Text style={styles.chartLabel}>
                  {weekdayLabel(day.date, index === days.length - 1, labels)}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
      <View style={styles.chartBaseline} />
      {period === "month" ? (
        <View style={styles.chartEnds}>
          <Mono style={styles.chartEnd}>{dayMonth.format(first).replace(/\.$/, "")}</Mono>
          <Mono style={styles.chartEnd}>{localize("Today", "Hoy")}</Mono>
        </View>
      ) : null}
    </View>
  );
}

/**
 * How much time Still gave back, per app and in total, for today, the last
 * 7 or 30 days, or everything the phone keeps; for every app or just one.
 * Worked out on the phone from Still's own counters, the same way as Today.
 */
export default function SavingsScreen() {
  const { config } = useAppState();
  const savedTime = useSavedTime(config.estimatedMinutesPerAvoidedOpen);
  const history = useSavingsHistory();
  const [period, setPeriod] = useState<SavingsPeriod>("week");
  const [app, setApp] = useState<string | null>(null);
  const configMinutes = config.estimatedMinutesPerAvoidedOpen;

  const minutesFor = useMemo(() => {
    const sources = {
      baseline: savedTime.baseline,
      recent: savedTime.usageAccess ? savedTime.recent : null,
      configMinutes,
    };
    return (key: string) => typicalMinutes(key, sources);
  }, [configMinutes, savedTime.baseline, savedTime.recent, savedTime.usageAccess]);

  // "Today" is the day the counters were read, so a screen left open past
  // midnight moves on with the next read.
  const now = useMemo(() => new Date(), [history]);
  const summary = useMemo(
    () =>
      history
        ? summarizeSavings({ history, period, app, now, minutesFor, configMinutes })
        : null,
    [app, configMinutes, history, minutesFor, now, period],
  );
  // The app filter lists every app with a pause the phone keeps, so the chosen
  // one never vanishes when the period changes.
  const everyApp = useMemo(
    () =>
      history
        ? summarizeSavings({ history, period: "all", app: null, now, minutesFor, configMinutes })
            .apps
        : [],
    [configMinutes, history, minutesFor, now],
  );
  const selectedApp = app ? everyApp.find((entry) => entry.key === app) : undefined;
  const periodApp = app ? summary?.apps.find((entry) => entry.key === app) : undefined;
  const widest = Math.max(1, ...(summary?.apps.map((entry) => entry.minutes) ?? []));
  const measured = summary?.apps.some((entry) => entry.source !== "default") ?? false;
  const offerUsage =
    Platform.OS === "android" &&
    Boolean(restrictionEngine.getUsageStats) &&
    !savedTime.usageAccess;

  return (
    <Screen contentContainerStyle={styles.screen}>
      <View style={styles.topline}>
        <Pressable
          accessibilityRole="button"
          hitSlop={12}
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/(tabs)/(today)")
          }
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Text style={styles.backLabel}>← {localize("Today", "Hoy")}</Text>
        </Pressable>
        <Eyebrow>{localize("TIME BACK", "TIEMPO RECUPERADO")}</Eyebrow>
      </View>

      <View style={styles.filters}>
        <View accessibilityRole="tablist" style={styles.segments}>
          {SAVINGS_PERIODS.map((option) => (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: option === period }}
              key={option}
              onPress={() => setPeriod(option)}
              style={({ pressed }) => [
                styles.segment,
                option === period && styles.segmentSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text
                numberOfLines={1}
                style={[styles.segmentLabel, option === period && styles.segmentLabelSelected]}
              >
                {periodLabel(option)}
              </Text>
            </Pressable>
          ))}
        </View>
        {everyApp.length > 1 ? (
          <ScrollView
            contentContainerStyle={styles.chips}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            <Chip
              label={localize("All apps", "Todas las apps")}
              onPress={() => setApp(null)}
              selected={app === null}
            />
            {everyApp.map((entry) => (
              <Chip
                key={entry.key}
                label={entry.label}
                onPress={() => setApp(entry.key === app ? null : entry.key)}
                selected={entry.key === app}
              />
            ))}
          </ScrollView>
        ) : null}
      </View>

      {!summary ? (
        <Skeleton style={styles.skeleton} />
      ) : (
        <Animated.View entering={FadeIn.duration(220)} key={`${period}:${app ?? "all"}`} style={styles.hero}>
          <AnimatedNumber
            accessibilityLabel={minutesLabel(summary.minutes)}
            adjustsFontSizeToFit
            format={minutesLabel}
            numberOfLines={1}
            style={styles.heroNumber}
            value={Math.round(summary.minutes)}
          />
          <Body style={styles.heroCaption}>
            {selectedApp
              ? `${periodCaption(period)} · ${selectedApp.label}`
              : periodCaption(period)}
          </Body>
          {summary.pauses > 0 ? (
            <Mono style={styles.heroFacts}>
              {localize(
                `${summary.pauses} ${summary.pauses === 1 ? "pause" : "pauses"} · didn't go in ${summary.pauses - summary.entered} · went in ${summary.entered}`,
                `${summary.pauses} ${summary.pauses === 1 ? "pausa" : "pausas"} · no entraste ${summary.pauses - summary.entered} · entraste ${summary.entered}`,
              )}
            </Mono>
          ) : (
            <Body style={styles.muted}>
              {localize(
                "No pauses in this period yet.",
                "Todavía no hay pausas en este período.",
              )}
            </Body>
          )}
          {periodApp ? <Body style={styles.muted}>{appDetail(periodApp)}</Body> : null}
        </Animated.View>
      )}

      {summary && (period === "week" || period === "month") && summary.pauses > 0 ? (
        <DayBars days={summary.days} key={`${period}:${app ?? "all"}:bars`} period={period} />
      ) : null}

      {summary && app === null && summary.apps.length > 0 ? (
        <View style={styles.section}>
          <Eyebrow>{localize("BY APP", "POR APP")}</Eyebrow>
          {summary.apps.map((entry, index) => (
            <Pressable
              accessibilityHint={localize("Shows only this app", "Muestra solo esta app")}
              accessibilityRole="button"
              key={entry.key}
              onPress={() => setApp(entry.key)}
              style={({ pressed }) => [styles.appRow, pressed && styles.pressed]}
            >
              <View style={styles.appLine}>
                <Heading numberOfLines={1} style={styles.appName}>
                  {entry.label}
                </Heading>
                <Mono style={styles.appMinutes}>{minutesLabel(entry.minutes)}</Mono>
              </View>
              <View style={styles.track}>
                <GrowFill
                  color={entry.chosen ? colors.mineral : colors.mineralLight}
                  delay={index * 60}
                  value={Math.max(entry.minutes > 0 ? 0.02 : 0, entry.minutes / widest)}
                />
              </View>
              <Body style={styles.appDetail}>{appDetail(entry)}</Body>
            </Pressable>
          ))}
        </View>
      ) : null}

      {summary && summary.pauses > 0 ? (
        <View style={styles.note}>
          <Body style={styles.noteText}>
            {measured
              ? localize(
                  "Each time you didn't go in counts what a session of that app usually lasts on this phone. If you went back in right away, that one doesn't count. Worked out on this phone; it doesn't leave it.",
                  "Cada vez que no entraste cuenta lo que suele durar una sesión de esa app en este teléfono. Si volviste a entrar enseguida, esa vez no suma. Se calcula en este teléfono y no sale de aquí.",
                )
              : localize(
                  `We estimate ${configMinutes} min each time you didn't go in. If you went back in right away, that one doesn't count.`,
                  `Estimamos ${configMinutes} min por cada vez que no entraste. Si volviste a entrar enseguida, esa vez no suma.`,
                )}
          </Body>
          {offerUsage ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/usage-access")}
              style={({ pressed }) => [styles.link, pressed && styles.pressed]}
            >
              <Text style={styles.linkLabel}>
                {localize("Use my real usage", "Calcular con mi uso")}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.lg },
  topline: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  back: { paddingVertical: spacing.xs },
  backLabel: {
    color: colors.graphite,
    fontFamily: fonts.brandSemiBold,
    fontSize: 15,
  },
  pressed: { opacity: 0.55 },
  filters: { gap: spacing.sm },
  segments: {
    flexDirection: "row",
    padding: 3,
    gap: 3,
    borderRadius: radius.md,
    backgroundColor: colors.chalkRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
  },
  segment: {
    flex: 1,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xxs,
    borderRadius: radius.sm + 2,
  },
  segmentSelected: { backgroundColor: colors.graphite },
  segmentLabel: {
    color: colors.graphiteSoft,
    fontFamily: fonts.brandMedium,
    fontSize: 14,
  },
  segmentLabelSelected: { color: colors.chalk, fontFamily: fonts.brandSemiBold },
  chips: { gap: spacing.xs, paddingRight: spacing.lg },
  chip: {
    maxWidth: 200,
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.mineralLight,
  },
  chipSelected: { backgroundColor: colors.mineral, borderColor: colors.mineral },
  chipLabel: { color: colors.graphite, fontFamily: fonts.brandMedium, fontSize: 14 },
  chipLabelSelected: { color: colors.chalk },
  skeleton: { height: 120, borderRadius: radius.sm, backgroundColor: colors.fog, opacity: 0.5 },
  hero: {
    paddingVertical: spacing.md,
    gap: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
  },
  heroNumber: { fontSize: 56, lineHeight: 60, letterSpacing: -2.5 },
  heroCaption: { color: colors.graphiteSoft },
  heroFacts: { color: colors.graphiteSoft },
  muted: { color: colors.graphiteSoft, fontSize: 14, lineHeight: 20 },
  chartBlock: { gap: 6 },
  chart: { flexDirection: "row", alignItems: "flex-end", gap: spacing.xs },
  chartDense: { gap: 2 },
  chartColumn: { flex: 1, gap: 6 },
  chartTrack: { height: CHART_HEIGHT, justifyContent: "flex-end" },
  chartBar: {
    backgroundColor: colors.mineral,
    borderTopLeftRadius: radius.xs,
    borderTopRightRadius: radius.xs,
  },
  chartLabel: {
    color: colors.graphiteSoft,
    fontFamily: fonts.brandMedium,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
  },
  chartBaseline: { height: StyleSheet.hairlineWidth, backgroundColor: colors.mineralLight },
  chartEnds: { flexDirection: "row", justifyContent: "space-between" },
  chartEnd: { color: colors.graphiteSoft, fontSize: 12 },
  section: {
    paddingTop: spacing.lg,
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
  },
  appRow: { gap: spacing.xs, paddingVertical: spacing.xxs },
  appLine: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  appName: { flexShrink: 1, fontSize: 18, lineHeight: 23 },
  appMinutes: { color: colors.graphite, fontFamily: fonts.monoMedium },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.chalkRaised,
    overflow: "hidden",
  },
  appDetail: { color: colors.graphiteSoft, fontSize: 13, lineHeight: 18 },
  note: {
    paddingTop: spacing.lg,
    gap: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
  },
  noteText: { color: colors.graphiteSoft, fontSize: 13, lineHeight: 18 },
  link: { paddingVertical: spacing.xs, alignSelf: "flex-start" },
  linkLabel: {
    color: colors.graphite,
    fontFamily: fonts.brandSemiBold,
    fontSize: 14,
    textDecorationLine: "underline",
    textDecorationColor: colors.mineralLight,
  },
});

import { Platform, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/screen";
import { Body, Data, Display, Eyebrow, Mono } from "@/components/typography";
import { localize, t } from "@/i18n";
import { ActivityReport } from "@/native/activity-report";
import { useAppState } from "@/state/app-state";
import { colors, fonts, spacing } from "@/theme/tokens";

const days = ["L", "M", "M", "J", "V", "S", "D"];

export default function TodayScreen() {
  const { stats, config } = useAppState();
  const maximum = Math.max(...stats.weeklyScreenTimeMinutes, 1);
  const weekly = stats.weeklyScreenTimeMinutes.length === 7 ? stats.weeklyScreenTimeMinutes : Array(7).fill(0);
  const totalHours = Math.floor(stats.screenTimeMinutes / 60);
  const totalMinutes = stats.screenTimeMinutes % 60;
  const recoveredMinutes = stats.avoidedOpens * config.estimatedMinutesPerAvoidedOpen;

  return (
    <Screen>
      <View style={styles.header}>
        <Eyebrow>
          {localize("TODAY / ", "HOY / ")}
          {new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "2-digit" }).format(new Date())}
        </Eyebrow>
        <Display>{localize("A record,\nnot a score.", "Un registro,\nno una nota.")}</Display>
        <Body style={styles.lede}>
          {localize(
            "Still describes what happened. It doesn’t grade your day.",
            "Still describe lo que pasó. No califica tu día.",
          )}
        </Body>
      </View>

      {Platform.OS === "ios" ? (
        <View style={styles.nativeGroup}>
          <View style={styles.reportHeader}>
            <Eyebrow>{localize("SELECTED APPS", "APPS ELEGIDAS")}</Eyebrow>
            <Mono>{t("screenTime")}</Mono>
          </View>
          <View style={styles.nativeReport}>
            <ActivityReport context="still.daily" />
          </View>
          <View style={styles.nativeWeekly}>
            <ActivityReport context="still.weekly" />
          </View>
        </View>
      ) : (
        <View style={styles.record}>
          <View style={styles.metricLine}>
            <Data style={styles.metric}>{totalHours}:{String(totalMinutes).padStart(2, "0")}</Data>
            <Mono style={styles.metricCaption}>{localize("HOURS / SELECTED APPS", "HORAS / APPS ELEGIDAS")}</Mono>
          </View>
          <View
            accessible
            accessibilityLabel={localize(
              `Weekly selected-app time: ${weekly.join(", ")} minutes`,
              `Tiempo semanal en apps elegidas: ${weekly.join(", ")} minutos`,
            )}
            style={styles.chart}
          >
            {weekly.map((minutes, index) => (
              <View key={index} style={styles.chartColumn}>
                <View
                  style={[
                    styles.bar,
                    index === 6 && styles.barToday,
                    { height: Math.max(5, (minutes / maximum) * 84) },
                  ]}
                />
                <Text style={styles.day}>{days[index]}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.metrics}>
        <View style={styles.metricRow}>
          <Eyebrow>01 / {localize("DECISIONS", "DECISIONES")}</Eyebrow>
          <Data>{String(stats.avoidedOpens).padStart(2, "0")}</Data>
          <Body style={styles.metricBody}>{t("avoided")}</Body>
        </View>
        <View style={styles.metricRow}>
          <Eyebrow>02 / {localize("OUTSIDE THE FLOW", "FUERA DEL FLUJO")}</Eyebrow>
          <Data>{recoveredMinutes} min</Data>
          <Body style={styles.metricBody}>{t("saved")}</Body>
        </View>
      </View>

      <View style={styles.note}>
        <Eyebrow>{localize("A NOTE / NOT A NUDGE", "UNA NOTA / SIN PRESIÓN")}</Eyebrow>
        <Text selectable style={styles.quote}>
          {localize(
            "“Attention is the rarest and purest form of generosity.”",
            "“La atención es la forma más rara y pura de generosidad.”",
          )}
        </Text>
        <Mono>— Simone Weil</Mono>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.lg },
  lede: { maxWidth: 520, color: colors.muted },
  nativeGroup: {
    overflow: "hidden",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.ink,
  },
  reportHeader: {
    minHeight: 58,
    paddingVertical: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
  },
  nativeReport: { minHeight: 180, overflow: "hidden" },
  nativeWeekly: {
    minHeight: 155,
    overflow: "hidden",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
  },
  record: {
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.ink,
    gap: spacing.xl,
  },
  metricLine: { gap: spacing.sm },
  metric: { fontSize: 68, lineHeight: 68, letterSpacing: -3 },
  metricCaption: { color: colors.muted, fontSize: 10 },
  chart: { height: 118, flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  chartColumn: { flex: 1, height: 112, justifyContent: "flex-end", alignItems: "center", gap: spacing.xs },
  bar: { width: "100%", maxWidth: 26, backgroundColor: colors.ink },
  barToday: { backgroundColor: colors.signal },
  day: { color: colors.muted, fontFamily: fonts.mono, fontSize: 10 },
  metrics: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.rule },
  metricRow: {
    minHeight: 142,
    paddingVertical: spacing.lg,
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
  },
  metricBody: { color: colors.muted, fontSize: 13 },
  note: {
    paddingVertical: spacing.xl,
    gap: spacing.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.ink,
  },
  quote: {
    color: colors.ink,
    fontFamily: fonts.brandMedium,
    fontSize: 28,
    lineHeight: 31,
    letterSpacing: -0.7,
  },
});

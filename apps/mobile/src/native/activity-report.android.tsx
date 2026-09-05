import { StyleSheet, Text, View } from "react-native";

import { Eyebrow } from "@/components/typography";
import { locale, localize } from "@/i18n";
import { useAppState } from "@/state/app-state";
import { colors, fonts, spacing } from "@/theme/tokens";

const dayLabels =
  locale === "es"
    ? ["L", "M", "X", "J", "V", "S", "D"]
    : ["M", "T", "W", "T", "F", "S", "S"];

function formatDuration(minutes: number) {
  const wholeMinutes = Math.max(0, Math.round(minutes));
  if (wholeMinutes < 60) return `${wholeMinutes}m`;
  const hours = Math.floor(wholeMinutes / 60);
  const remainder = wholeMinutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

function WeeklyReport({ values }: { values: number[] }) {
  const normalized = values.length === 7 ? values : Array(7).fill(0);
  const maximum = Math.max(...normalized, 1);

  return (
    <View style={styles.weekly}>
      <Eyebrow>{localize("LAST 7 DAYS", "ÚLTIMOS 7 DÍAS")}</Eyebrow>
      <View style={styles.weeklyChart}>
        {normalized.map((value, dayIndex) => {
          const activeCount =
            value <= 0 ? 0 : Math.max(1, Math.round((value / maximum) * 5));
          return (
            <View key={dayIndex} style={styles.dayColumn}>
              <View style={styles.modules}>
                {Array.from({ length: 5 }).map((_, moduleIndex) => (
                  <View
                    key={moduleIndex}
                    style={[
                      styles.module,
                      moduleIndex < activeCount
                        ? {
                            backgroundColor: colors.mineral,
                            opacity: 0.58 + moduleIndex * 0.08,
                          }
                        : styles.inactiveModule,
                    ]}
                  />
                ))}
              </View>
              <Text
                style={[
                  styles.dayLabel,
                  dayIndex === 6 && styles.dayLabelToday,
                ]}
              >
                {dayLabels[dayIndex]}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function DailyReport({
  minutes,
  pickups,
}: {
  minutes: number;
  pickups: number;
}) {
  return (
    <View style={styles.daily}>
      <Eyebrow>{localize("SCREEN TIME", "TIEMPO EN PANTALLA")}</Eyebrow>
      <Text style={styles.duration}>{formatDuration(minutes)}</Text>
      <View style={styles.rule} />
      <Text style={styles.pickups}>
        {localize(`${pickups} PICKUPS`, `${pickups} ACTIVACIONES`)}
      </Text>
    </View>
  );
}

export function ActivityReport({
  context = "still.daily",
}: {
  context?: "still.daily" | "still.weekly";
}) {
  const { stats } = useAppState();
  return context === "still.weekly" ? (
    <WeeklyReport values={stats.weeklyScreenTimeMinutes} />
  ) : (
    <DailyReport minutes={stats.screenTimeMinutes} pickups={stats.pickups} />
  );
}

const styles = StyleSheet.create({
  weekly: { minHeight: 145, paddingVertical: spacing.sm, gap: 14 },
  weeklyChart: {
    height: 82,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  dayColumn: { flex: 1, height: 82, justifyContent: "flex-end", gap: 5 },
  modules: { gap: 4 },
  module: { height: 8, borderRadius: 2 },
  inactiveModule: { backgroundColor: colors.fog, opacity: 0.6 },
  dayLabel: {
    color: colors.graphiteSoft,
    fontFamily: fonts.brandMedium,
    fontSize: 10,
    lineHeight: 12,
    textAlign: "center",
  },
  dayLabelToday: { fontFamily: fonts.brandBold },
  daily: { minHeight: 145, paddingVertical: spacing.sm, gap: 10 },
  duration: {
    color: colors.graphite,
    fontFamily: fonts.monoMedium,
    fontSize: 42,
    lineHeight: 46,
    letterSpacing: -2,
    fontVariant: ["tabular-nums"],
  },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.fog },
  pickups: {
    color: colors.graphiteSoft,
    fontFamily: fonts.brandMedium,
    fontSize: 11,
    lineHeight: 16,
  },
});

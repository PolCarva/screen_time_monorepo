import { Platform, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/screen";
import { Surface } from "@/components/surface";
import { Body, Display, Eyebrow } from "@/components/typography";
import { localize, t } from "@/i18n";
import { ActivityReport } from "@/native/activity-report";
import { useAppState } from "@/state/app-state";
import { colors, fonts, spacing } from "@/theme/tokens";

export default function TodayScreen() {
  const { stats, config } = useAppState();
  const maximum = Math.max(...stats.weeklyScreenTimeMinutes, 1);
  const weekly = stats.weeklyScreenTimeMinutes.length === 7 ? stats.weeklyScreenTimeMinutes : Array(7).fill(0);

  return (
    <Screen>
      <View>
        <Eyebrow>
          {new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" }).format(new Date())}
        </Eyebrow>
        <Display>{t("greeting")}</Display>
      </View>

      {Platform.OS === "ios" ? (
        <>
          <Surface style={styles.nativeReport}>
            <ActivityReport context="still.daily" />
          </Surface>
          <Surface style={styles.nativeWeekly}>
            <ActivityReport context="still.weekly" />
          </Surface>
        </>
      ) : (
        <Surface style={styles.heroCard}>
          <View style={styles.metricTop}>
            <Text style={styles.metric}>
              {Math.floor(stats.screenTimeMinutes / 60)}h {stats.screenTimeMinutes % 60}m
            </Text>
          </View>
          <Body style={styles.muted}>{t("screenTime")} · {localize("selected apps", "apps seleccionadas")}</Body>
          <View style={styles.bars}>
            {weekly.map((minutes, index) => (
              <View key={index} style={[styles.bar, { height: Math.max(6, (minutes / maximum) * 70) }]} />
            ))}
          </View>
          <View style={styles.days}>
            {["L", "M", "M", "J", "V", "S", "D"].map((day, index) => (
              <Text key={`${day}${index}`}>{day}</Text>
            ))}
          </View>
        </Surface>
      )}

      <View style={styles.grid}>
        <Surface style={styles.small}>
          <Text style={styles.icon}>♡</Text>
          <Text style={styles.smallMetric}>{stats.avoidedOpens}</Text>
          <Body style={styles.muted}>{t("avoided")}</Body>
        </Surface>
        <Surface style={styles.small}>
          <Text style={styles.icon}>◷</Text>
          <Text style={styles.smallMetric}>{stats.avoidedOpens * config.estimatedMinutesPerAvoidedOpen} min</Text>
          <Body style={styles.muted}>{t("saved")}</Body>
        </Surface>
      </View>
      <Surface>
        <Eyebrow>{localize("A thought for today", "Una idea para hoy")}</Eyebrow>
        <Text style={styles.quote}>{localize("“Attention is the rarest and purest form of generosity.”", "“La atención es la forma más rara y pura de generosidad.”")}</Text>
        <Body style={styles.muted}>— Simone Weil</Body>
      </Surface>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: { padding: spacing.lg },
  nativeReport: { minHeight: 180, padding: 0, overflow: "hidden" },
  nativeWeekly: { minHeight: 155, padding: 0, overflow: "hidden" },
  metricTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  metric: { fontFamily: fonts.display, fontSize: 45, color: colors.forest },
  muted: { color: colors.muted, fontSize: 12 },
  bars: { height: 82, flexDirection: "row", alignItems: "flex-end", gap: 10, marginTop: spacing.xl },
  bar: { flex: 1, backgroundColor: colors.sage, borderRadius: 5, opacity: 0.9 },
  days: { flexDirection: "row", justifyContent: "space-around", marginTop: 8 },
  grid: { flexDirection: "row", gap: 12 },
  small: { flex: 1, minHeight: 160 },
  icon: { fontSize: 24, color: colors.sage },
  smallMetric: { fontFamily: fonts.display, fontSize: 35, color: colors.forest, marginTop: 18 },
  quote: { fontFamily: fonts.displayMedium, fontSize: 27, lineHeight: 32, color: colors.forest, marginTop: 5 },
});

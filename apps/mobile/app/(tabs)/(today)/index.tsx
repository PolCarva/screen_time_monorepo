import { impactWeekSchema } from "@screen-time/contracts";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { AttentionField } from "@/components/attention-field";
import { FieldApertureMark } from "@/components/field-aperture-mark";
import { Screen } from "@/components/screen";
import { Body, Data, Eyebrow, Heading, Mono } from "@/components/typography";
import { localize } from "@/i18n";
import { apiFetch } from "@/lib/api";
import { ActivityReport } from "@/native/activity-report";
import { useAppState } from "@/state/app-state";
import { colors, fonts, spacing } from "@/theme/tokens";

const days = ["M", "T", "W", "T", "F", "S", "S"];

export default function TodayScreen() {
  const { stats, config, health } = useAppState();
  const impactQuery = useQuery({
    queryKey: ["impact-current"],
    queryFn: () => apiFetch("/api/v1/impact/current", impactWeekSchema),
  });
  const weekly = stats.weeklyScreenTimeMinutes.length === 7 ? stats.weeklyScreenTimeMinutes : Array(7).fill(0);
  const recoveredMinutes = stats.avoidedOpens * config.estimatedMinutesPerAvoidedOpen;
  const impact = impactQuery.data;
  const impactAmount = impact
    ? new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(impact.impactFundMinor / 100)
    : "—";
  const selectedCount = health.selectedCount;
  const nextAction = selectedCount === 0
    ? localize("Choose apps to protect", "Elegir apps para proteger")
    : localize("Review protected apps", "Revisar apps protegidas");

  return (
    <Screen contentContainerStyle={styles.screen}>
      <View style={styles.topline}>
        <FieldApertureMark size={34} />
        <Eyebrow>
          {localize("TODAY / ", "HOY / ")}
          {new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short" }).format(new Date()).toUpperCase()}
        </Eyebrow>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroLine}>
          <Data style={styles.heroNumber}>{recoveredMinutes}</Data>
          <View style={styles.heroCopy}>
            <Heading style={styles.heroUnit}>{localize("minutes", "minutos")}</Heading>
            <Body style={styles.muted}>{localize("returned today", "recuperados hoy")}</Body>
          </View>
        </View>
        <Body style={styles.heroNote}>
          {localize(
            `${stats.avoidedOpens} automatic opens became conscious choices.`,
            `${stats.avoidedOpens} aperturas automáticas se convirtieron en decisiones conscientes.`,
          )}
        </Body>
      </View>

      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Data>{selectedCount}</Data>
          <Body style={styles.summaryLabel}>{localize("apps protected", "apps protegidas")}</Body>
        </View>
        <View style={styles.summaryItem}>
          <Data>{stats.avoidedOpens}</Data>
          <Body style={styles.summaryLabel}>{localize("opens avoided", "aperturas evitadas")}</Body>
        </View>
      </View>

      <View style={styles.fieldSection}>
        <View style={styles.sectionTop}>
          <Eyebrow>{localize("SELECTED-APP TIME / 7 DAYS", "TIEMPO EN APPS / 7 DÍAS")}</Eyebrow>
          <Mono>{localize("ON DEVICE", "EN DISPOSITIVO")}</Mono>
        </View>
        <AttentionField
          accessibilityLabel={localize(
            `Selected-app time over seven days: ${weekly.join(", ")} minutes`,
            `Tiempo en apps seleccionadas durante siete días: ${weekly.join(", ")} minutos`,
          )}
          values={weekly}
          passes={stats.unlocks}
        />
        <View style={styles.days}>
          {days.map((day, index) => <Text key={`${day}-${index}`} style={[styles.day, index === 6 && styles.dayToday]}>{index === 6 ? localize("TODAY", "HOY") : day}</Text>)}
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/(tabs)/(impact)" as never)}
        style={({ pressed }) => [styles.impactRow, pressed && styles.pressed]}
      >
        <View>
          <Eyebrow>{localize("IMPACT FUND", "FONDO DE IMPACTO")}</Eyebrow>
          <Data style={styles.impactAmount}>{impactAmount}</Data>
        </View>
        <View style={styles.impactMeta}>
          <Mono>{impact?.isEstimated ? localize("ESTIMATED", "ESTIMADO") : localize("VERIFIED", "VERIFICADO")}</Mono>
          <Text style={styles.arrow}>→</Text>
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/(tabs)/(settings)" as never)}
        style={({ pressed }) => [styles.nextRow, pressed && styles.pressed]}
      >
        <View style={styles.nextCopy}>
          <Eyebrow>{localize("NEXT", "SIGUIENTE")}</Eyebrow>
          <Heading style={styles.nextTitle}>{nextAction}</Heading>
        </View>
        <Text style={styles.arrow}>→</Text>
      </Pressable>

      {Platform.OS === "ios" ? (
        <View style={styles.nativeDetail}>
          <View style={styles.sectionTop}>
            <Eyebrow>{localize("DEVICE DETAIL", "DETALLE DEL DISPOSITIVO")}</Eyebrow>
            <Mono>{localize("PRIVATE", "PRIVADO")}</Mono>
          </View>
          <View style={styles.nativeReport}><ActivityReport context="still.daily" /></View>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: 0 },
  topline: { minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  hero: { paddingVertical: spacing.xl, gap: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.fog },
  heroLine: { flexDirection: "row", alignItems: "flex-end", gap: spacing.lg },
  heroNumber: { fontSize: 84, lineHeight: 82, letterSpacing: -4.5 },
  heroCopy: { paddingBottom: spacing.sm, gap: 2 },
  heroUnit: { fontSize: 19, lineHeight: 22 },
  muted: { color: colors.graphiteSoft },
  heroNote: { maxWidth: 390, color: colors.graphiteSoft, fontSize: 14, lineHeight: 20 },
  summary: { paddingVertical: spacing.lg, flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.fog },
  summaryItem: { flex: 1, gap: spacing.xs },
  summaryLabel: { color: colors.graphiteSoft, fontSize: 13 },
  fieldSection: { paddingVertical: spacing.xl, gap: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.fog },
  sectionTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  days: { flexDirection: "row", gap: spacing.sm },
  day: { flex: 1, color: colors.graphiteSoft, fontFamily: fonts.brandMedium, fontSize: 9 },
  dayToday: { color: colors.graphite, fontFamily: fonts.brandBold, textAlign: "right" },
  impactRow: { minHeight: 118, paddingVertical: spacing.lg, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.fog },
  impactAmount: { marginTop: spacing.sm, fontSize: 38, lineHeight: 40 },
  impactMeta: { alignItems: "flex-end", gap: spacing.sm },
  nextRow: { minHeight: 104, paddingVertical: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.fog },
  nextCopy: { flex: 1, gap: spacing.sm },
  nextTitle: { fontSize: 19, lineHeight: 22 },
  arrow: { color: colors.graphite, fontFamily: fonts.brandMedium, fontSize: 25 },
  pressed: { opacity: 0.58 },
  nativeDetail: { minHeight: 230, paddingVertical: spacing.xl, gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.fog },
  nativeReport: { minHeight: 180, overflow: "hidden" },
});

import { impactWeekSchema } from "@screen-time/contracts";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { FieldApertureMark } from "@/components/field-aperture-mark";
import { PrimaryButton } from "@/components/primary-button";
import { Screen } from "@/components/screen";
import { Body, Data, Eyebrow, Heading, Mono } from "@/components/typography";
import { locale, localize } from "@/i18n";
import { apiFetch } from "@/lib/api";
import { isPauseFeatureEnabled } from "@/lib/restriction-mode";
import { activeTargets } from "@/lib/shortcut-targets";
import {
  dayOutcome,
  minutesReturned,
  pauseStatus,
  summarizeWeek,
  weekdayLabel,
  type WeekColumn,
} from "@/lib/today-summary";
import { secondsLeft, useAccessWindows } from "@/native/use-access-windows";
import { useAppState } from "@/state/app-state";
import { useShortcutTargets } from "@/state/shortcut-targets";
import { colors, fonts, radius, spacing } from "@/theme/tokens";

/** mm:ss, or h:mm:ss once there is more than an hour left. */
function countdown(seconds: number): string {
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const rest = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(rest)}`
    : `${pad(minutes)}:${pad(rest)}`;
}

const intlLocale = locale === "es" ? "es" : "en";
const shortWeekday = new Intl.DateTimeFormat(intlLocale, { weekday: "short" });
const longWeekday = new Intl.DateTimeFormat(intlLocale, { weekday: "long" });
const shortMonth = new Intl.DateTimeFormat(intlLocale, { month: "short" });

const trimDot = (value: string) => value.replace(/\.$/, "");
const capitalize = (value: string) =>
  value.charAt(0).toLocaleUpperCase() + value.slice(1);

/** "HOY · MAR 22 SEPT" / "TODAY · TUE 22 SEP". */
function todayEyebrow(now: Date) {
  return [
    localize("TODAY", "HOY"),
    "·",
    trimDot(shortWeekday.format(now)),
    now.getDate(),
    trimDot(shortMonth.format(now)),
  ]
    .join(" ")
    .toLocaleUpperCase();
}

/** "Lunes 21" / "Monday 21"; "Hoy" / "Today" for today. */
function fullDayLabel(column: WeekColumn) {
  if (column.isToday) return localize("Today", "Hoy");
  const date = new Date(`${column.date}T12:00:00`);
  return `${capitalize(longWeekday.format(date))} ${date.getDate()}`;
}

function times(count: number) {
  return localize(
    count === 1 ? "once" : `${count} times`,
    count === 1 ? "1 vez" : `${count} veces`,
  );
}

function dayBreakdown(column: WeekColumn) {
  return localize(
    `${fullDayLabel(column)}: ${column.pauses} ${column.pauses === 1 ? "pause" : "pauses"} · ${column.notEntered} didn't go in · ${column.entered} went in`,
    `${fullDayLabel(column)}: ${column.pauses} ${column.pauses === 1 ? "pausa" : "pausas"} · ${column.notEntered} no entraste · ${column.entered} entraste`,
  );
}

const BAR_HEIGHT = 96;

function WeekChart({
  columns,
  selected,
  onSelect,
}: {
  columns: WeekColumn[];
  selected: number;
  onSelect(index: number): void;
}) {
  const labels = {
    today: localize("Today", "Hoy"),
    format: (date: Date) => shortWeekday.format(date),
  };
  return (
    <View style={styles.chart}>
      {columns.map((column, index) => {
        const total =
          column.pauses > 0 ? Math.max(3, Math.round(column.height * BAR_HEIGHT)) : 0;
        const notEnteredHeight =
          column.pauses > 0
            ? Math.round((total * column.notEntered) / column.pauses)
            : 0;
        const isSelected = index === selected;
        return (
          <Pressable
            accessibilityLabel={dayBreakdown(column)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            key={column.date}
            onPress={() => onSelect(index)}
            style={styles.column}
          >
            <Text style={[styles.columnValue, isSelected && styles.columnValueSelected]}>
              {column.pauses}
            </Text>
            <View style={styles.barTrack}>
              {total > 0 ? (
                <View style={[styles.bar, { height: total }]}>
                  <View style={[styles.barEntered, { flex: total - notEnteredHeight }]} />
                  <View style={[styles.barNotEntered, { flex: notEnteredHeight }]} />
                </View>
              ) : null}
            </View>
            <View style={styles.baseline} />
            <Text
              style={[
                styles.columnLabel,
                column.isToday && styles.columnLabelToday,
                isSelected && styles.columnLabelSelected,
              ]}
            >
              {weekdayLabel(column.date, column.isToday, labels)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function LegendKey({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Mono style={styles.legendLabel}>{label}</Mono>
    </View>
  );
}

export default function TodayScreen() {
  const { stats, config, health } = useAppState();
  const { targets, health: shortcutHealth } = useShortcutTargets();
  const openWindows = useAccessWindows();
  const impactQuery = useQuery({
    queryKey: ["impact-current"],
    queryFn: () => apiFetch("/api/v1/impact/current", impactWeekSchema),
  });
  const now = new Date();
  const today = dayOutcome(stats);
  const minutes = minutesReturned(today, config.estimatedMinutesPerAvoidedOpen);
  const week = useMemo(
    () => summarizeWeek(stats.history, { now: new Date() }),
    [stats.history],
  );
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const selected = selectedDay ?? week.columns.length - 1;
  const selectedColumn = week.columns[selected] ?? week.columns.at(-1);

  const pausesEnabled = isPauseFeatureEnabled(Platform.OS, config);
  const chosen = activeTargets(targets);
  const status =
    Platform.OS === "ios"
      ? pauseStatus({
          platform: "ios",
          pausesEnabled,
          chosen: chosen.length,
          connected: chosen.filter((target) => shortcutHealth[target.id]?.verifiedAt)
            .length,
        })
      : pauseStatus({
          platform: "android",
          pausesEnabled,
          authorized: health.authorization === "authorized",
          selected: health.selectedCount,
        });
  const appsRoute = Platform.OS === "ios" ? "/ios-apps" : "/android-setup";
  const appsRow =
    status.kind === "paused"
      ? {
          title: localize("Pauses are coming back soon", "Las pausas vuelven pronto"),
          action: null,
          route: null,
        }
      : status.kind === "activate"
        ? {
            title: localize("Still isn't on yet", "Falta activar Still"),
            action: localize("Turn on", "Activar"),
            route: "/android-setup",
          }
        : status.kind === "connect"
          ? {
              title: localize(
                `${status.connected} of ${status.chosen} apps connected`,
                `${status.connected} de ${status.chosen} apps conectadas`,
              ),
              action: localize("Finish connecting", "Terminar de conectar"),
              route: "/shortcut-setup",
            }
          : status.kind === "active"
            ? {
                title: localize(
                  `The pause is on in ${status.apps} ${status.apps === 1 ? "app" : "apps"}`,
                  `Pausa activa en ${status.apps} ${status.apps === 1 ? "app" : "apps"}`,
                ),
                action: localize("Review", "Revisar"),
                route: appsRoute,
              }
            : null;

  const impact = impactQuery.data;
  const impactAmount = impact
    ? new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: impact.currency,
        maximumFractionDigits: 0,
      }).format(impact.impactFundMinor / 100)
    : null;

  return (
    <Screen contentContainerStyle={styles.screen}>
      <View style={styles.topline}>
        <FieldApertureMark size={34} />
        <Eyebrow>{todayEyebrow(now)}</Eyebrow>
      </View>

      {openWindows.length > 0 ? (
        <View style={styles.section}>
          <Eyebrow>
            {openWindows.length === 1
              ? localize("OPEN NOW", "ABIERTA AHORA")
              : localize("OPEN NOW", "ABIERTAS AHORA")}
          </Eyebrow>
          {openWindows.map((entry) => (
            <View key={`${entry.label}:${entry.endsAt}`} style={styles.openRow}>
              <Body style={styles.openLabel}>
                {entry.label || localize("Your app", "Tu app")}
              </Body>
              <Mono>
                {localize("pause back in", "vuelve la pausa en")}{" "}
                {countdown(secondsLeft(entry))}
              </Mono>
            </View>
          ))}
        </View>
      ) : null}

      {status.kind === "choose" ? (
        <View style={styles.section}>
          <Heading style={styles.setupTitle}>
            {localize(
              "Choose the apps where you want a pause",
              "Elige las apps donde quieres una pausa",
            )}
          </Heading>
          <PrimaryButton onPress={() => router.push(appsRoute)} variant="signal">
            {localize("Choose apps", "Elegir apps")}
          </PrimaryButton>
        </View>
      ) : (
        <View style={styles.hero}>
          <View style={styles.heroLine}>
            <Data style={styles.heroNumber}>{minutes}</Data>
            <View style={styles.heroCopy}>
              <Heading style={styles.heroUnit}>min</Heading>
              <Body style={styles.muted}>
                {localize("returned today", "recuperados hoy")}
              </Body>
            </View>
          </View>
          <Body style={styles.heroNote}>
            {today.pauses === 0
              ? localize(
                  "When Still pauses an app, you'll see the time you get back here.",
                  "Cuando Still pause una app, aquí verás el tiempo que recuperas.",
                )
              : localize(
                  `You didn't go in ${times(today.notEntered)}. We estimate ${config.estimatedMinutesPerAvoidedOpen} min for each.`,
                  `No entraste ${times(today.notEntered)}. Estimamos ${config.estimatedMinutesPerAvoidedOpen} min por cada una.`,
                )}
          </Body>
        </View>
      )}

      <View style={styles.numbers}>
        <View style={styles.number}>
          <Data>{today.pauses}</Data>
          <Body style={styles.numberLabel}>{localize("Pauses", "Pausas")}</Body>
        </View>
        <View style={styles.number}>
          <Data>{today.notEntered}</Data>
          <View style={styles.numberKey}>
            <View style={[styles.legendSwatch, styles.swatchNotEntered]} />
            <Body style={styles.numberLabel}>
              {localize("Didn't go in", "No entraste")}
            </Body>
          </View>
        </View>
        <View style={styles.number}>
          <Data>{today.entered}</Data>
          <View style={styles.numberKey}>
            <View style={[styles.legendSwatch, styles.swatchEntered]} />
            <Body style={styles.numberLabel}>{localize("Went in", "Entraste")}</Body>
          </View>
        </View>
      </View>

      <View
        accessibilityLabel={
          week.totals.pauses === 0
            ? undefined
            : localize(
                `Last 7 days: ${week.totals.pauses} pauses, you didn't go in ${week.totals.notEntered} times.`,
                `Últimos 7 días: ${week.totals.pauses} pausas, no entraste ${times(week.totals.notEntered)}.`,
              )
        }
        style={styles.section}
      >
        <Eyebrow>{localize("LAST 7 DAYS", "ÚLTIMOS 7 DÍAS")}</Eyebrow>
        {week.totals.pauses === 0 ? (
          <Body style={styles.muted}>
            {localize(
              "Your pauses from the last 7 days will appear here.",
              "Tus pausas de los últimos 7 días aparecerán aquí.",
            )}
          </Body>
        ) : (
          <>
            <Heading style={styles.weekSummary}>
              {localize(
                `${week.totals.pauses} ${week.totals.pauses === 1 ? "pause" : "pauses"} · you didn't go in ${times(week.totals.notEntered)} (${week.notEnteredPercent}%)`,
                // A no-break space keeps "93 %" together at the end of a line.
                `${week.totals.pauses} ${week.totals.pauses === 1 ? "pausa" : "pausas"} · no entraste en ${week.totals.notEntered} (${week.notEnteredPercent}\u00A0%)`,
              )}
            </Heading>
            <WeekChart
              columns={week.columns}
              onSelect={setSelectedDay}
              selected={selected}
            />
            <View style={styles.legend}>
              <LegendKey
                color={colors.mineral}
                label={localize("Didn't go in", "No entraste")}
              />
              <LegendKey color={colors.peach} label={localize("Went in", "Entraste")} />
            </View>
            {selectedColumn ? (
              <Body accessibilityLiveRegion="polite" style={styles.dayDetail}>
                {dayBreakdown(selectedColumn)}
              </Body>
            ) : null}
          </>
        )}
      </View>

      {appsRow && status.kind !== "choose" ? (
        <Pressable
          accessibilityRole={appsRow.route ? "button" : undefined}
          disabled={!appsRow.route}
          onPress={() => {
            if (appsRow.route) router.push(appsRow.route as never);
          }}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <View style={styles.rowCopy}>
            <Eyebrow>{localize("YOUR APPS", "TUS APPS")}</Eyebrow>
            <Heading style={styles.rowTitle}>{appsRow.title}</Heading>
          </View>
          {appsRow.action ? (
            <View style={styles.rowAction}>
              <Mono>{appsRow.action.toLocaleUpperCase()}</Mono>
              <Text style={styles.arrow}>→</Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}

      {impactQuery.isLoading ? (
        <View style={styles.row}>
          <View style={styles.skeleton} />
        </View>
      ) : impactAmount && impact ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/(tabs)/(impact)" as never)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <View style={styles.rowCopy}>
            <Eyebrow>{localize("THIS WEEK'S FUND", "FONDO DE ESTA SEMANA")}</Eyebrow>
            <Data style={styles.impactAmount}>{impactAmount}</Data>
          </View>
          <View style={styles.rowAction}>
            <Mono>
              {impact.isEstimated
                ? localize("ESTIMATED", "ESTIMADO")
                : localize("CONFIRMED", "CONFIRMADO")}
            </Mono>
            <Text style={styles.arrow}>→</Text>
          </View>
        </Pressable>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: 0 },
  topline: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  section: {
    paddingVertical: spacing.lg,
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
  },
  openRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  openLabel: { flex: 1, fontFamily: fonts.brandSemiBold },
  setupTitle: { fontSize: 24, lineHeight: 28 },
  hero: {
    paddingVertical: spacing.xl,
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
  },
  heroLine: { flexDirection: "row", alignItems: "flex-end", gap: spacing.lg },
  heroNumber: { fontSize: 84, lineHeight: 82, letterSpacing: -4.5 },
  heroCopy: { paddingBottom: spacing.sm, gap: 2 },
  heroUnit: { fontSize: 19, lineHeight: 22 },
  muted: { color: colors.graphiteSoft },
  heroNote: {
    maxWidth: 390,
    color: colors.graphiteSoft,
    fontSize: 14,
    lineHeight: 20,
  },
  numbers: {
    paddingVertical: spacing.lg,
    flexDirection: "row",
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
  },
  number: { flex: 1, gap: spacing.xs },
  numberKey: { flexDirection: "row", alignItems: "center", gap: 6 },
  numberLabel: { color: colors.graphiteSoft, fontSize: 13, lineHeight: 18 },
  weekSummary: { fontSize: 19, lineHeight: 24 },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  column: { flex: 1, alignItems: "stretch", gap: 6 },
  columnValue: {
    color: colors.graphiteSoft,
    fontFamily: fonts.monoMedium,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  columnValueSelected: { color: colors.graphite, fontFamily: fonts.monoSemiBold },
  barTrack: { height: BAR_HEIGHT, justifyContent: "flex-end" },
  bar: {
    overflow: "hidden",
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
  },
  barEntered: { backgroundColor: colors.peach },
  barNotEntered: { backgroundColor: colors.mineral },
  baseline: { height: StyleSheet.hairlineWidth, backgroundColor: colors.mineralLight },
  columnLabel: {
    color: colors.graphiteSoft,
    fontFamily: fonts.brandMedium,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
  },
  columnLabelToday: { color: colors.graphite, fontFamily: fonts.brandBold },
  columnLabelSelected: { textDecorationLine: "underline" },
  legend: { flexDirection: "row", gap: spacing.lg },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendSwatch: { width: 10, height: 10, borderRadius: radius.xs },
  swatchNotEntered: { backgroundColor: colors.mineral },
  swatchEntered: { backgroundColor: colors.peach },
  legendLabel: { color: colors.graphiteSoft },
  dayDetail: { color: colors.graphite, fontSize: 14, lineHeight: 20 },
  row: {
    minHeight: 104,
    paddingVertical: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
  },
  rowCopy: { flex: 1, gap: spacing.sm },
  rowTitle: { fontSize: 19, lineHeight: 23 },
  rowAction: { alignItems: "flex-end", gap: spacing.xs },
  impactAmount: { fontSize: 38, lineHeight: 40 },
  arrow: {
    color: colors.graphite,
    fontFamily: fonts.brandMedium,
    fontSize: 25,
  },
  pressed: { opacity: 0.58 },
  skeleton: {
    flex: 1,
    height: 64,
    borderRadius: radius.sm,
    backgroundColor: colors.fog,
    opacity: 0.5,
  },
});

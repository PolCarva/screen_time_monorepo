import { StyleSheet, View } from "react-native";

import { GrowFill } from "@/components/motion";
import { Body, Eyebrow, Heading, Mono } from "@/components/typography";
import { locale, localize } from "@/i18n";
import { formatUsageMinutes } from "@/lib/onboarding-insights";
import type { BeforeNow } from "@/lib/saved-time";
import { colors, radius, spacing } from "@/theme/tokens";

function perDay(seconds: number) {
  return formatUsageMinutes(seconds / 60, locale);
}

/** "25 min less a day" / "12 min more a day" / "About the same as before Still". */
export function beforeNowHeadline(comparison: BeforeNow) {
  const delta = Math.round((comparison.now - comparison.before) / 60);
  if (delta === 0) {
    return localize("About the same as before Still", "Casi igual que antes de Still");
  }
  const amount = formatUsageMinutes(Math.abs(delta), locale);
  return delta < 0
    ? localize(`${amount} less a day`, `${amount} menos al día`)
    : localize(`${amount} more a day`, `${amount} más al día`);
}

/**
 * "Before and now" (docs/real-savings-estimate-plan.md §2.5, §6, D10): the
 * chosen apps' daily use in the week before Still and on the days since. A
 * comparison, never a cause: it says what changed, up or down.
 */
export function BeforeNowCard({
  comparison,
  labels,
}: {
  comparison: BeforeNow;
  labels: Record<string, string>;
}) {
  const widest = Math.max(comparison.before, comparison.now, 1);
  const bars = [
    {
      key: "before",
      label: localize("Before Still", "Antes de Still"),
      seconds: comparison.before,
      color: colors.fog,
    },
    {
      key: "now",
      label: localize("Now", "Ahora"),
      seconds: comparison.now,
      color: colors.mineral,
    },
  ];
  const note = localize(
    `Apps you pause. Before: the ${comparison.beforeDays} days before Still. Now: the last ${comparison.nowDays} days. Measured on this phone.`,
    `Apps que pausas. Antes: los ${comparison.beforeDays} días previos a Still. Ahora: los últimos ${comparison.nowDays} días. Medido en este teléfono.`,
  );
  return (
    <View
      accessible
      accessibilityLabel={[
        beforeNowHeadline(comparison),
        localize(
          `Before Still: ${perDay(comparison.before)} a day. Now: ${perDay(comparison.now)} a day.`,
          `Antes de Still: ${perDay(comparison.before)} al día. Ahora: ${perDay(comparison.now)} al día.`,
        ),
        note,
      ].join(" ")}
      style={styles.card}
    >
      <Eyebrow>{localize("BEFORE AND NOW", "ANTES Y AHORA")}</Eyebrow>
      <Heading style={styles.headline}>{beforeNowHeadline(comparison)}</Heading>
      <View style={styles.bars}>
        {bars.map((bar, index) => (
          <View key={bar.key} style={styles.barRow}>
            <View style={styles.barCopy}>
              <Body style={styles.barLabel}>{bar.label}</Body>
              <Mono>
                {localize(`${perDay(bar.seconds)} a day`, `${perDay(bar.seconds)} al día`)}
              </Mono>
            </View>
            <View style={styles.track}>
              <GrowFill
                color={bar.color}
                delay={index * 80}
                value={Math.max(0.02, bar.seconds / widest)}
              />
            </View>
          </View>
        ))}
      </View>
      {comparison.apps.length > 1 ? (
        <View style={styles.apps}>
          {comparison.apps.map((app) => (
            <View key={app.packageName} style={styles.appRow}>
              <Body numberOfLines={1} style={styles.appName}>
                {labels[app.packageName] ?? app.packageName}
              </Body>
              <Mono style={styles.appValues}>
                {`${perDay(app.before)} → ${perDay(app.now)}`}
              </Mono>
            </View>
          ))}
        </View>
      ) : null}
      <Body style={styles.note}>{note}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: spacing.lg,
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
  },
  headline: { fontSize: 19, lineHeight: 24 },
  bars: { gap: spacing.sm },
  barRow: { gap: spacing.xs },
  barCopy: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  barLabel: { color: colors.graphiteSoft, fontSize: 14, lineHeight: 20 },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.chalkRaised,
    overflow: "hidden",
  },
  apps: { gap: spacing.xs },
  appRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  appName: { flexShrink: 1, fontSize: 14, lineHeight: 20 },
  appValues: { color: colors.graphiteSoft },
  note: { color: colors.graphiteSoft, fontSize: 13, lineHeight: 18 },
});

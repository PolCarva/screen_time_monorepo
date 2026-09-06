import { StyleSheet, Text, View } from "react-native";

import { localize } from "@/i18n";
import { colors, radius, spacing } from "@/theme/tokens";

export type ShortcutStepVisualVariant = "return" | "trigger" | "pause";

type ShortcutStepVisualProps = {
  accessibilityLabel: string;
  variant: ShortcutStepVisualVariant;
};

function Chrome({ title }: { title: string }) {
  return (
    <View style={styles.chrome}>
      <View style={styles.chromeDots}>
        <View style={[styles.chromeDot, styles.chromeDotRed]} />
        <View style={[styles.chromeDot, styles.chromeDotYellow]} />
        <View style={[styles.chromeDot, styles.chromeDotGreen]} />
      </View>
      <Text style={styles.chromeTitle}>{title}</Text>
      <Text style={styles.chromeMore}>•••</Text>
    </View>
  );
}

function ShortcutBadge({ label, tone }: { label: string; tone: "blue" | "red" | "still" }) {
  return (
    <View
      style={[
        styles.badge,
        tone === "blue" && styles.badgeBlue,
        tone === "red" && styles.badgeRed,
        tone === "still" && styles.badgeStill,
      ]}
    >
      <Text style={styles.badgeLabel}>{label}</Text>
    </View>
  );
}

function ReturnShortcutVisual() {
  return (
    <>
      <Chrome title="Still · YouTube" />
      <View style={styles.actionCard}>
        <ShortcutBadge label="↗" tone="blue" />
        <View style={styles.actionCopy}>
          <Text style={styles.actionTitle}>
            {localize("Open App", "Abrir app")}
          </Text>
          <View style={styles.valuePill}>
            <Text style={styles.valueText}>YouTube</Text>
          </View>
        </View>
      </View>
    </>
  );
}

function TriggerVisual() {
  return (
    <>
      <Chrome title={localize("New Automation", "Nueva automatización")} />
      <View style={styles.actionCard}>
        <ShortcutBadge label="▶" tone="red" />
        <View style={styles.actionCopy}>
          <Text style={styles.actionEyebrow}>
            {localize("WHEN", "CUANDO")}
          </Text>
          <Text style={styles.actionTitle}>
            {localize("YouTube is opened", "Se abre YouTube")}
          </Text>
          <View style={styles.immediateRow}>
            <View style={styles.statusDot} />
            <Text style={styles.immediateText}>
              {localize("Run Immediately", "Ejecutar inmediatamente")}
            </Text>
          </View>
        </View>
      </View>
    </>
  );
}

function PauseVisual() {
  return (
    <>
      <Chrome title={localize("Still action", "Acción de Still")} />
      <View style={styles.actionCard}>
        <ShortcutBadge label="S" tone="still" />
        <View style={styles.actionCopy}>
          <Text style={styles.actionTitle}>
            {localize("Pause Before Opening", "Pausa antes de abrir")}
          </Text>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>
              {localize("App name", "Nombre de app")}
            </Text>
            <View style={styles.valuePill}>
              <Text style={styles.valueText}>YouTube</Text>
            </View>
          </View>
        </View>
      </View>
      <View style={styles.resultRow}>
        <View style={styles.resultLine} />
        <Text style={styles.resultText}>
          {localize("STILL PAUSE", "PAUSA DE STILL")}
        </Text>
      </View>
    </>
  );
}

export function ShortcutStepVisual({
  accessibilityLabel,
  variant,
}: ShortcutStepVisualProps) {
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
      style={styles.root}
    >
      {variant === "return" ? <ReturnShortcutVisual /> : null}
      {variant === "trigger" ? <TriggerVisual /> : null}
      {variant === "pause" ? <PauseVisual /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: 150,
    padding: spacing.md,
    gap: spacing.md,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.mineralLight,
    borderRadius: radius.modal,
    borderCurve: "continuous",
    backgroundColor: "#ECECF2",
  },
  chrome: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chromeDots: { flexDirection: "row", gap: 5 },
  chromeDot: { width: 7, height: 7, borderRadius: radius.pill },
  chromeDotRed: { backgroundColor: "#FF605C" },
  chromeDotYellow: { backgroundColor: "#FFBD44" },
  chromeDotGreen: { backgroundColor: "#00CA4E" },
  chromeTitle: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    color: colors.graphite,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  chromeMore: { color: colors.graphiteSoft, fontSize: 10 },
  actionCard: {
    minHeight: 84,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    backgroundColor: colors.white,
    boxShadow: "0 4px 12px rgba(36, 40, 38, 0.10)",
  },
  badge: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
  },
  badgeBlue: { backgroundColor: "#2F7CF6" },
  badgeRed: { backgroundColor: "#FF3B30" },
  badgeStill: { backgroundColor: colors.graphite },
  badgeLabel: { color: colors.white, fontSize: 15, fontWeight: "800" },
  actionCopy: { flex: 1, gap: spacing.xs },
  actionEyebrow: {
    color: colors.graphiteSoft,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
  },
  actionTitle: { color: colors.graphite, fontSize: 14, fontWeight: "700" },
  valuePill: {
    alignSelf: "flex-start",
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: "#E8F1FF",
  },
  valueText: { color: "#1769D2", fontSize: 12, fontWeight: "700" },
  immediateRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: radius.pill, backgroundColor: colors.success },
  immediateText: { color: colors.success, fontSize: 11, fontWeight: "700" },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  fieldLabel: { color: colors.graphiteSoft, fontSize: 11 },
  resultRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  resultLine: { flex: 1, height: 1, backgroundColor: colors.mineralLight },
  resultText: {
    color: colors.mineral,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
});

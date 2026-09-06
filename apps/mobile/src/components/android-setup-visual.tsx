import { StyleSheet, Text, View } from "react-native";

import { localize } from "@/i18n";
import { colors, fonts, radius, spacing } from "@/theme/tokens";

export type AndroidSetupVisualVariant = "accessibility" | "apps" | "return";

type AndroidSetupVisualProps = {
  accessibilityLabel: string;
  variant: AndroidSetupVisualVariant;
};

function SystemHeader({ title }: { title: string }) {
  return (
    <View style={styles.systemHeader}>
      <Text style={styles.back}>‹</Text>
      <Text style={styles.systemTitle}>{title}</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

function StillMark() {
  return (
    <View style={styles.stillMark}>
      <Text style={styles.stillMarkText}>S</Text>
    </View>
  );
}

function Toggle() {
  return (
    <View style={styles.toggle}>
      <View style={styles.toggleThumb} />
    </View>
  );
}

function AccessibilityVisual() {
  return (
    <View style={styles.phonePanel}>
      <SystemHeader
        title={localize("Downloaded apps", "Apps descargadas")}
      />
      <View style={styles.settingRow}>
        <StillMark />
        <View style={styles.settingCopy}>
          <Text style={styles.rowTitle}>Still</Text>
          <Text style={styles.rowDetail}>{localize("On", "Activado")}</Text>
        </View>
        <Toggle />
      </View>
      <Text style={styles.helperText}>
        {localize(
          "Android Settings → Accessibility",
          "Ajustes de Android → Accesibilidad",
        )}
      </Text>
    </View>
  );
}

function AppRow({
  badge,
  label,
  selected,
  tone,
}: {
  badge: string;
  label: string;
  selected: boolean;
  tone: "red" | "violet" | "plain";
}) {
  return (
    <View style={styles.appRow}>
      <View
        style={[
          styles.appBadge,
          tone === "red" && styles.appBadgeRed,
          tone === "violet" && styles.appBadgeViolet,
          tone === "plain" && styles.appBadgePlain,
        ]}
      >
        <Text style={styles.appBadgeText}>{badge}</Text>
      </View>
      <Text style={styles.appLabel}>{label}</Text>
      <View style={[styles.check, selected && styles.checkSelected]}>
        {selected ? <Text style={styles.checkText}>✓</Text> : null}
      </View>
    </View>
  );
}

function AppsVisual() {
  return (
    <View style={styles.phonePanel}>
      <SystemHeader title={localize("Choose apps", "Elegir apps")} />
      <AppRow badge="▶" label="YouTube" selected tone="red" />
      <AppRow badge="M" label="Gmail" selected={false} tone="plain" />
      <AppRow badge="◎" label="Instagram" selected tone="violet" />
      <View style={styles.donePill}>
        <Text style={styles.donePillText}>{localize("Done", "Listo")}</Text>
      </View>
    </View>
  );
}

function FlowNode({
  caption,
  label,
  tone,
}: {
  caption: string;
  label: string;
  tone: "app" | "still";
}) {
  return (
    <View style={styles.flowNode}>
      <View style={[styles.flowIcon, tone === "still" && styles.flowIconStill]}>
        <Text
          style={[
            styles.flowIconText,
            tone === "still" && styles.flowIconTextStill,
          ]}
        >
          {label}
        </Text>
      </View>
      <Text style={styles.flowCaption}>{caption}</Text>
    </View>
  );
}

function ReturnVisual() {
  return (
    <View style={styles.returnPanel}>
      <View style={styles.flow}>
        <FlowNode caption={localize("Open", "Abrir")} label="▶" tone="app" />
        <Text style={styles.arrow}>→</Text>
        <FlowNode
          caption={localize("Pause + ad", "Pausa + anuncio")}
          label="S"
          tone="still"
        />
        <Text style={styles.arrow}>→</Text>
        <FlowNode
          caption={localize("Returns", "Vuelve")}
          label="▶"
          tone="app"
        />
      </View>
      <View style={styles.returnRule} />
      <Text style={styles.returnText}>
        {localize(
          "Still remembers the exact Android app. No Shortcut is needed.",
          "Still recuerda la app exacta de Android. No necesitas un Atajo.",
        )}
      </Text>
    </View>
  );
}

export function AndroidSetupVisual({
  accessibilityLabel,
  variant,
}: AndroidSetupVisualProps) {
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
      style={styles.root}
    >
      {variant === "accessibility" ? <AccessibilityVisual /> : null}
      {variant === "apps" ? <AppsVisual /> : null}
      {variant === "return" ? <ReturnVisual /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: 166,
    padding: spacing.md,
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.mineralLight,
    borderRadius: radius.modal,
    borderCurve: "continuous",
    backgroundColor: "#E9EEEC",
  },
  phonePanel: {
    padding: spacing.md,
    gap: spacing.xs,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    backgroundColor: colors.white,
    boxShadow: "0 4px 12px rgba(36, 40, 38, 0.10)",
  },
  systemHeader: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
  },
  back: { width: 24, color: colors.graphite, fontSize: 24, lineHeight: 24 },
  systemTitle: {
    flex: 1,
    color: colors.graphite,
    fontFamily: fonts.brandSemiBold,
    fontSize: 13,
    textAlign: "center",
  },
  headerSpacer: { width: 24 },
  settingRow: {
    minHeight: 58,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.chalkRaised,
  },
  stillMark: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.graphite,
  },
  stillMarkText: { color: colors.white, fontFamily: fonts.brandBold },
  settingCopy: { flex: 1 },
  rowTitle: {
    color: colors.graphite,
    fontFamily: fonts.brandSemiBold,
    fontSize: 13,
  },
  rowDetail: { color: colors.success, fontSize: 10, fontWeight: "700" },
  toggle: {
    width: 38,
    height: 22,
    padding: 2,
    alignItems: "flex-end",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.mineral,
  },
  toggleThumb: {
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
  },
  helperText: {
    paddingTop: spacing.xxs,
    color: colors.graphiteSoft,
    fontSize: 9,
    textAlign: "center",
  },
  appRow: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  appBadge: {
    width: 27,
    height: 27,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
  },
  appBadgeRed: { backgroundColor: "#FF3B30" },
  appBadgeViolet: { backgroundColor: "#A54DCE" },
  appBadgePlain: { backgroundColor: colors.fog },
  appBadgeText: { color: colors.white, fontSize: 10, fontWeight: "800" },
  appLabel: {
    flex: 1,
    color: colors.graphite,
    fontFamily: fonts.brandMedium,
    fontSize: 12,
  },
  check: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.mineralLight,
    borderRadius: radius.pill,
  },
  checkSelected: { borderColor: colors.mineral, backgroundColor: colors.mineral },
  checkText: { color: colors.white, fontSize: 11, fontWeight: "800" },
  donePill: {
    alignSelf: "flex-end",
    paddingVertical: 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.graphite,
  },
  donePillText: { color: colors.white, fontSize: 9, fontWeight: "800" },
  returnPanel: {
    padding: spacing.lg,
    gap: spacing.md,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    backgroundColor: colors.white,
  },
  flow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  flowNode: { width: 70, alignItems: "center", gap: spacing.xs },
  flowIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
    backgroundColor: "#FF3B30",
  },
  flowIconStill: { backgroundColor: colors.graphite },
  flowIconText: { color: colors.white, fontSize: 15, fontWeight: "800" },
  flowIconTextStill: { fontFamily: fonts.brandBold },
  flowCaption: {
    color: colors.graphiteSoft,
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
  },
  arrow: { color: colors.mineral, fontSize: 18, fontWeight: "800" },
  returnRule: { height: 1, backgroundColor: colors.fog },
  returnText: {
    color: colors.graphiteSoft,
    fontSize: 10,
    lineHeight: 14,
    textAlign: "center",
  },
});

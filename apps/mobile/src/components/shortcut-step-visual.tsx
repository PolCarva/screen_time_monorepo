import { StyleSheet, Text, View } from "react-native";

import { localize } from "@/i18n";
import { colors, radius, spacing } from "@/theme/tokens";

export type ShortcutStepVisualVariant =
  | "return"
  | "trigger"
  | "pause"
  | "import"
  | "toggle"
  | "trigger-multi"
  | "current-app"
  | "pause-current";

type ShortcutStepVisualProps = {
  accessibilityLabel: string;
  variant: ShortcutStepVisualVariant;
  /** App shown in the mock-up; the user's own first choice when there is one. */
  appName?: string;
  /** Apps listed in the multi-app trigger mock-up. */
  appNames?: readonly string[];
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

function ReturnShortcutVisual({ appName }: { appName: string }) {
  return (
    <>
      <Chrome title={`Still · ${appName}`} />
      <View style={styles.actionCard}>
        <ShortcutBadge label="↗" tone="blue" />
        <View style={styles.actionCopy}>
          <Text style={styles.actionTitle}>
            {localize("Open App", "Abrir app")}
          </Text>
          <View style={styles.valuePill}>
            <Text style={styles.valueText}>{appName}</Text>
          </View>
        </View>
      </View>
    </>
  );
}

function TriggerVisual({ appName }: { appName: string }) {
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
            {localize(`${appName} is opened`, `Se abre ${appName}`)}
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

function PauseVisual({ appName }: { appName: string }) {
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
              <Text style={styles.valueText}>{appName}</Text>
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

function ImportVisual() {
  return (
    <>
      <Chrome title={localize("Add Shortcut", "Añadir atajo")} />
      <View style={styles.actionCard}>
        <ShortcutBadge label="S" tone="still" />
        <View style={styles.actionCopy}>
          <Text style={styles.actionTitle}>Still · Pausa</Text>
          <Text style={styles.fieldLabel}>
            {localize("1 automation · 1 action", "1 automatización · 1 acción")}
          </Text>
        </View>
      </View>
      <View style={styles.ctaPill}>
        <Text style={styles.ctaText}>
          {localize("Add Shortcut", "Añadir atajo")}
        </Text>
      </View>
    </>
  );
}

function ToggleVisual() {
  return (
    <>
      <Chrome title="Still · Pausa" />
      <View style={styles.actionCard}>
        <ShortcutBadge label="▶" tone="red" />
        <View style={styles.actionCopy}>
          <Text style={styles.actionEyebrow}>
            {localize("AUTOMATION", "AUTOMATIZACIÓN")}
          </Text>
          <Text style={styles.actionTitle}>
            {localize("When an app is opened", "Cuando se abre una app")}
          </Text>
        </View>
        <View style={styles.toggleTrack}>
          <View style={styles.toggleKnob} />
        </View>
      </View>
    </>
  );
}

function TriggerMultiVisual({ appNames }: { appNames: readonly string[] }) {
  return (
    <>
      <Chrome title={localize("When", "Cuando")} />
      <View style={styles.actionCard}>
        <ShortcutBadge label="▶" tone="red" />
        <View style={styles.actionCopy}>
          <Text style={styles.actionEyebrow}>
            {localize("ANY OF THESE IS OPENED", "SE ABRE CUALQUIERA DE ESTAS")}
          </Text>
          <View style={styles.pillRow}>
            {appNames.slice(0, 3).map((name) => (
              <View key={name} style={styles.valuePill}>
                <Text style={styles.valueText}>{name}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </>
  );
}

function CurrentAppVisual() {
  return (
    <>
      <Chrome title={localize("Add Action", "Añadir acción")} />
      <View style={styles.actionCard}>
        <ShortcutBadge label="◎" tone="blue" />
        <View style={styles.actionCopy}>
          <Text style={styles.actionTitle}>
            {localize("Get Current App", "Obtener app actual")}
          </Text>
          <Text style={styles.fieldLabel}>
            {localize(
              "Tells Still which app you opened",
              "Le dice a Still qué app abriste",
            )}
          </Text>
        </View>
      </View>
    </>
  );
}

function PauseCurrentVisual() {
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
            <View style={[styles.valuePill, styles.variablePill]}>
              <Text style={styles.valueText}>
                {localize("Current App", "App actual")}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </>
  );
}

export function ShortcutStepVisual({
  accessibilityLabel,
  appName = "YouTube",
  appNames = ["YouTube"],
  variant,
}: ShortcutStepVisualProps) {
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
      style={styles.root}
    >
      {variant === "return" ? <ReturnShortcutVisual appName={appName} /> : null}
      {variant === "trigger" ? <TriggerVisual appName={appName} /> : null}
      {variant === "pause" ? <PauseVisual appName={appName} /> : null}
      {variant === "import" ? <ImportVisual /> : null}
      {variant === "toggle" ? <ToggleVisual /> : null}
      {variant === "trigger-multi" ? (
        <TriggerMultiVisual appNames={appNames} />
      ) : null}
      {variant === "current-app" ? <CurrentAppVisual /> : null}
      {variant === "pause-current" ? <PauseCurrentVisual /> : null}
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
  variablePill: { backgroundColor: "#E4F6EA" },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  ctaPill: {
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: "#2F7CF6",
  },
  ctaText: { color: colors.white, fontSize: 13, fontWeight: "700" },
  toggleTrack: {
    width: 42,
    height: 26,
    padding: 2,
    alignItems: "flex-end",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: "#34C759",
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
  },
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

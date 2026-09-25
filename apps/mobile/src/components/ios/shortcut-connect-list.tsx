import { router } from "expo-router";
import { useEffect, useState } from "react";
import { AppState, Linking, Platform, StyleSheet, View } from "react-native";

import { PrimaryButton } from "@/components/primary-button";
import { gotItAction, useStillSheet } from "@/components/still-sheet";
import { Body, Eyebrow, Mono } from "@/components/typography";
import { localize } from "@/i18n";
import {
  probeResult,
  relativeAge,
  setupProbeGraceMs,
  type RelativeAge,
} from "@/lib/ios-shortcut-setup";
import {
  type ShortcutTarget,
  activeTargets,
  catalogSchemeFor,
} from "@/lib/shortcut-targets";
import {
  type SetupTestReturn,
  rememberSetupTestReturn,
} from "@/lib/setup-test-return";
import { restrictionEngine } from "@/native/restriction-engine";
import { useShortcutTargets } from "@/state/shortcut-targets";
import { colors, fonts, spacing } from "@/theme/tokens";

/** A setup test in flight: which app, and when it started (ms). */
export type SetupProbe = { targetId: string; startedAt: number };

export function ageLabel(age: RelativeAge) {
  switch (age.unit) {
    case "now":
      return localize("just now", "ahora mismo");
    case "minutes":
      return localize(`${age.value} min ago`, `hace ${age.value} min`);
    case "hours":
      return localize(`${age.value} h ago`, `hace ${age.value} h`);
    case "days":
      return localize(
        `${age.value} ${age.value === 1 ? "day" : "days"} ago`,
        `hace ${age.value} ${age.value === 1 ? "día" : "días"}`,
      );
  }
}

type RowState = {
  tone: "idle" | "pending" | "ok" | "failed";
  label: string;
};

/**
 * Every chosen app with its state and its own Test button, so testing is one
 * tap away instead of at the end of the guide. iOS gives no way to read an
 * automation: a test passes when the App Intent runs for that app after it
 * started. The onboarding keeps the probe in its own progress (`probe` +
 * `onProbeStart`) and says where the "connected" screen returns (`returnTo`).
 */
export function ShortcutConnectList({
  probe: externalProbe,
  onProbeStart,
  returnTo,
  pausesEnabled = true,
}: {
  probe?: SetupProbe | null;
  onProbeStart?: (probe: SetupProbe) => void;
  returnTo?: SetupTestReturn;
  pausesEnabled?: boolean;
}) {
  const { targets, health, refresh, disableScheme, restoreScheme } =
    useShortcutTargets();
  const sheet = useStillSheet();
  const [localProbe, setLocalProbe] = useState<SetupProbe | null>(null);
  const probe = externalProbe !== undefined ? externalProbe : localProbe;
  const [now, setNow] = useState(() => Date.now());
  const chosen = activeTargets(targets);
  const connected = chosen.filter((target) => health[target.id]?.verifiedAt);

  useEffect(() => {
    // Coming back from Shortcuts or from the app under test: look again, and
    // only then judge the test, so a late read never shows a false failure.
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      void refresh().finally(() => setNow(Date.now()));
    });
    return () => subscription.remove();
  }, [refresh]);

  const probing = probe
    ? probeResult({
        startedAt: probe.startedAt,
        lastTriggeredAt: health[probe.targetId]?.lastTriggeredAt,
        now,
        graceMs: setupProbeGraceMs(Platform.Version),
      })
    : null;

  useEffect(() => {
    if (probing !== "waiting") return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [probing]);

  async function test(target: ShortcutTarget) {
    await rememberSetupTestReturn(returnTo ?? null).catch(() => undefined);
    await restrictionEngine
      .beginShortcutSetupProbe(target.name)
      .catch(() => undefined);
    const started = { targetId: target.id, startedAt: Date.now() };
    setLocalProbe(started);
    onProbeStart?.(started);
    setNow(started.startedAt);
    // A test also retries a scheme that was switched off earlier, so one
    // transient failure does not cost the direct return forever.
    const scheme = target.urlScheme ?? catalogSchemeFor(target);
    if (scheme) {
      try {
        await Linking.openURL(scheme);
        if (!target.urlScheme) await restoreScheme(target.id);
        return;
      } catch {
        // This scheme does not open here: return through the shortcut instead.
        if (target.urlScheme) await disableScheme(target.id);
      }
    }
    void sheet.show({
      title: localize(`Now open ${target.name}`, `Ahora abre ${target.name}`),
      message: localize(
        `Go to your Home Screen and open ${target.name}. If you see Still's pause, it is connected.`,
        `Ve a tu pantalla de inicio y abre ${target.name}. Si ves la pausa de Still, quedó conectada.`,
      ),
      actions: [gotItAction()],
    });
  }

  function stateOf(target: ShortcutTarget): RowState {
    if (probe?.targetId === target.id && probing === "waiting")
      return {
        tone: "pending",
        label: localize("Waiting for the automation…", "Esperando a la automatización…"),
      };
    if (probe?.targetId === target.id && probing === "not_detected")
      return {
        tone: "failed",
        label: localize("The pause didn't show up.", "La pausa no apareció."),
      };
    const entry = health[target.id];
    if (entry?.verifiedAt) {
      const age = relativeAge(entry.lastTriggeredAt, now);
      return {
        tone: "ok",
        label: age
          ? localize(
              `Connected · last pause ${ageLabel(age)}`,
              `Conectada · última pausa ${ageLabel(age)}`,
            )
          : localize("Connected", "Conectada"),
      };
    }
    return {
      tone: "idle",
      label: localize("Not connected yet", "Falta conectar"),
    };
  }

  return (
    <View style={styles.root}>
      <View style={styles.heading}>
        <Eyebrow>{localize("YOUR APPS", "TUS APPS")}</Eyebrow>
        <Mono accessibilityLabel={localize(
          `${connected.length} of ${chosen.length} connected`,
          `${connected.length} de ${chosen.length} conectadas`,
        )}>
          {connected.length}/{chosen.length}
        </Mono>
      </View>
      {chosen.map((target) => {
        const state = stateOf(target);
        return (
          <View key={target.id} style={styles.row}>
            <View style={[styles.dot, styles[state.tone]]} />
            <View style={styles.copy}>
              <Body style={styles.name}>{target.name}</Body>
              <Body
                accessibilityLiveRegion="polite"
                style={[
                  styles.status,
                  state.tone === "ok" && styles.okText,
                  state.tone === "failed" && styles.failedText,
                ]}
              >
                {state.label}
              </Body>
            </View>
            {state.tone === "failed" ? (
              <PrimaryButton
                onPress={() => router.push("/shortcut-repair")}
                style={styles.button}
                variant="secondary"
              >
                {localize("Repair", "Reparar")}
              </PrimaryButton>
            ) : (
              <PrimaryButton
                accessibilityLabel={localize(`Test ${target.name}`, `Probar ${target.name}`)}
                disabled={state.tone === "pending" || !pausesEnabled}
                onPress={() => void test(target)}
                style={styles.button}
                variant={state.tone === "ok" ? "quiet" : "secondary"}
              >
                {localize("Test", "Probar")}
              </PrimaryButton>
            )}
          </View>
        );
      })}
      <Body style={styles.hint}>
        {localize(
          "Test opens the app: if Still's pause shows up, it's connected. A test never counts as an opening.",
          "Probar abre la app: si aparece la pausa de Still, quedó conectada. Una prueba nunca cuenta como apertura.",
        )}
      </Body>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs },
  heading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  row: {
    minHeight: 64,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
  },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1 },
  idle: { borderColor: colors.mineralLight },
  pending: { borderColor: colors.mineral, backgroundColor: colors.mineralLight },
  ok: { borderColor: colors.success, backgroundColor: colors.success },
  failed: { borderColor: colors.danger, backgroundColor: colors.danger },
  copy: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.brandSemiBold, fontSize: 16 },
  status: { color: colors.graphiteSoft, fontSize: 12, lineHeight: 17 },
  okText: { color: colors.success },
  failedText: { color: colors.danger },
  button: { minHeight: 44, paddingHorizontal: spacing.md },
  hint: { color: colors.graphiteSoft, fontSize: 13, lineHeight: 19, paddingTop: spacing.xs },
});

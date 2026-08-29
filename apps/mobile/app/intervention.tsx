import { router } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { IntervalMark } from "@/components/interval-mark";
import { PrimaryButton } from "@/components/primary-button";
import { Screen } from "@/components/screen";
import { Body, Display, Eyebrow, Mono } from "@/components/typography";
import { localize } from "@/i18n";
import { useAppState } from "@/state/app-state";
import { colors, spacing } from "@/theme/tokens";

export default function InterventionScreen() {
  const { wallet, config, stats, unlockCurrent } = useAppState();
  const [busy, setBusy] = useState(false);
  const durationMinutes = Math.round(config.unlockDurationSeconds / 60);
  const hasRewardedPass = wallet.rewardedBalance > 0;
  const hasEmergencyAccess = wallet.emergencyRemaining > 0;

  async function unlock() {
    setBusy(true);
    try {
      if (!hasRewardedPass && !hasEmergencyAccess) {
        router.replace("/(tabs)/(tokens)");
        return;
      }
      const session = await unlockCurrent();
      router.replace({ pathname: "/unlock-ready", params: { endsAt: session.endsAt } });
    } catch {
      Alert.alert(
        localize("Couldn’t open the app", "No se pudo abrir la app"),
        localize(
          "No pass was lost. Open Still again or use an Emergency Access.",
          "No perdiste ningún pase. Abre Still otra vez o usa un acceso de emergencia.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  const secondaryLabel = busy
    ? localize("Opening…", "Abriendo…")
    : hasRewardedPass
      ? localize(`Use 1 pass · ${durationMinutes} min`, `Usar 1 pase · ${durationMinutes} min`)
      : hasEmergencyAccess
        ? localize(`Emergency Access · ${wallet.emergencyRemaining}`, `Acceso de emergencia · ${wallet.emergencyRemaining}`)
        : localize("Get a pass", "Conseguir un pase");

  return (
    <Screen contentContainerStyle={styles.screen}>
      <View style={styles.top}>
        <Eyebrow>
          {new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date())}
          {localize(" / PAUSE", " / PAUSA")}
        </Eyebrow>
        <Mono>{localize("STILL / BEFORE ENTERING", "STILL / ANTES DE ENTRAR")}</Mono>
      </View>

      <View style={styles.decision}>
        <IntervalMark label="00:01" />
        <View style={styles.copy}>
          <Eyebrow>{localize("ONE SECOND TO CHOOSE", "UN SEGUNDO PARA ELEGIR")}</Eyebrow>
          <Display style={styles.title}>{localize("Still want to\ngo in?", "¿Aún quieres\nentrar?")}</Display>
          <Body style={styles.detail}>
            {localize(
              `You’ve spent ${Math.floor(stats.screenTimeMinutes / 60)} hr ${stats.screenTimeMinutes % 60} min in selected apps today.`,
              `Llevas ${Math.floor(stats.screenTimeMinutes / 60)} h ${stats.screenTimeMinutes % 60} min hoy en las apps elegidas.`,
            )}
          </Body>
        </View>
      </View>

      <View style={styles.actions}>
        <PrimaryButton onPress={() => router.back()}>
          {localize("Not now", "No entrar")}
        </PrimaryButton>
        <PrimaryButton onPress={unlock} disabled={busy} variant="secondary">
          {secondaryLabel}
        </PrimaryButton>
        <Body style={styles.note}>
          {localize(
            `The pass lasts ${durationMinutes} minutes. The pause returns when it ends.`,
            `El pase dura ${durationMinutes} minutos. La pausa vuelve cuando termina.`,
          )}
        </Body>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, minHeight: 720, justifyContent: "space-between", paddingVertical: spacing.lg },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.md },
  decision: {
    paddingVertical: spacing.xl,
    gap: spacing.xxl,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.ink,
  },
  copy: { gap: spacing.lg },
  title: { fontSize: 54, lineHeight: 51 },
  detail: { color: colors.muted },
  actions: { gap: spacing.sm },
  note: { marginTop: spacing.sm, color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
});

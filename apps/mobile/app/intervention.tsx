import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { AttentionField } from "@/components/attention-field";
import { Screen } from "@/components/screen";
import { Body, Display, Eyebrow, Mono } from "@/components/typography";
import { localize } from "@/i18n";
import { useAppState } from "@/state/app-state";
import { colors, fonts, spacing } from "@/theme/tokens";

export default function InterventionScreen() {
  const { app } = useLocalSearchParams<{ app?: string }>();
  const { wallet, config, stats, unlockCurrent } = useAppState();
  const [busy, setBusy] = useState(false);
  const durationMinutes = Math.round(config.unlockDurationSeconds / 60);
  const hasRewardedPass = wallet.rewardedBalance > 0;
  const hasEmergencyAccess = wallet.emergencyRemaining > 0;
  const appLabel = app || localize("Selected app", "App seleccionada");
  const attempts = Math.max(
    stats.openAttempts,
    stats.avoidedOpens + stats.unlocks,
  );

  async function unlock() {
    setBusy(true);
    try {
      if (!hasRewardedPass && !hasEmergencyAccess) {
        router.replace("/(tabs)/(tokens)");
        return;
      }
      const session = await unlockCurrent();
      router.replace({
        pathname: "/unlock-ready",
        params: { endsAt: session.endsAt },
      });
    } catch {
      Alert.alert(
        localize("Couldn’t open the app", "No se pudo abrir la app"),
        localize(
          "No pass was lost. Try again from Still.",
          "No perdiste ningún pase. Inténtalo otra vez desde Still.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  const secondaryLabel = busy
    ? localize("Opening…", "Abriendo…")
    : hasRewardedPass
      ? localize(
          `Use 1 pass · ${durationMinutes} min`,
          `Usar 1 pase · ${durationMinutes} min`,
        )
      : hasEmergencyAccess
        ? localize(
            `Emergency access · ${durationMinutes} min`,
            `Acceso de emergencia · ${durationMinutes} min`,
          )
        : localize("Get a pass", "Conseguir un pase");

  return (
    <Screen style={styles.root} contentContainerStyle={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.topline}>
        <Eyebrow style={styles.lightLabel}>{appLabel}</Eyebrow>
        <Mono style={styles.timer}>00:01</Mono>
      </View>

      <AttentionField
        accessibilityLabel={localize(
          "The attention field opens to make space for a decision.",
          "El campo de atención se abre para dejar espacio a una decisión.",
        )}
        mode="intervention"
        dark
      />

      <View style={styles.copy}>
        <Display style={styles.title}>
          {localize(
            `${appLabel} opened\n${attempts} ${attempts === 1 ? "time" : "times"} today.`,
            `${appLabel} se abrió\n${attempts} ${attempts === 1 ? "vez" : "veces"} hoy.`,
          )}
        </Display>
        <Body style={styles.question}>
          {localize(
            `What do you want from the next ${durationMinutes} minutes?`,
            `¿Qué quieres de los próximos ${durationMinutes} minutos?`,
          )}
        </Body>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        >
          <Text style={styles.primaryLabel}>
            {localize("Go back", "Volver")}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={unlock}
          style={({ pressed }) => [
            styles.secondary,
            pressed && styles.pressed,
            busy && styles.disabled,
          ]}
        >
          <Text style={styles.secondaryLabel}>{secondaryLabel}</Text>
          <Text style={styles.secondaryArrow}>→</Text>
        </Pressable>
        <Body style={styles.note}>
          {localize(
            `The pause returns after ${durationMinutes} minutes. Continuing is a choice, not a failure.`,
            `La pausa vuelve después de ${durationMinutes} minutos. Continuar es una elección, no un fracaso.`,
          )}
        </Body>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.graphite },
  screen: {
    minHeight: 760,
    flexGrow: 1,
    justifyContent: "space-between",
    paddingVertical: spacing.lg,
    backgroundColor: colors.graphite,
  },
  topline: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  lightLabel: { color: colors.chalk },
  timer: {
    color: colors.chalk,
    fontFamily: fonts.brandSemiBold,
    letterSpacing: 1,
  },
  copy: { gap: spacing.lg },
  title: {
    color: colors.chalk,
    fontSize: 38,
    lineHeight: 41,
    letterSpacing: -1.2,
  },
  question: { color: colors.mineralLight, fontSize: 15, lineHeight: 22 },
  actions: { gap: 0 },
  primary: {
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    backgroundColor: colors.chalk,
  },
  primaryLabel: {
    color: colors.graphite,
    fontFamily: fonts.brandSemiBold,
    fontSize: 15,
  },
  secondary: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.graphiteSoft,
  },
  secondaryLabel: {
    color: colors.chalk,
    fontFamily: fonts.brandSemiBold,
    fontSize: 15,
  },
  secondaryArrow: {
    color: colors.chalk,
    fontFamily: fonts.brandMedium,
    fontSize: 21,
  },
  note: {
    paddingTop: spacing.lg,
    color: colors.mineralLight,
    fontSize: 12,
    lineHeight: 18,
  },
  pressed: { opacity: 0.62 },
  disabled: { opacity: 0.42 },
});

import { StatusBar } from "expo-status-bar";
import { formatUnlockDuration } from "@screen-time/contracts";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { z } from "zod";

import { AttentionField } from "@/components/attention-field";
import { Screen } from "@/components/screen";
import { Body, Display, Eyebrow } from "@/components/typography";
import { localize } from "@/i18n";
import { capture } from "@/lib/analytics";
import { apiFetch } from "@/lib/api";
import { getInterventionUnlockAction } from "@/lib/shortcut-intervention";
import { restrictionEngine } from "@/native/restriction-engine";
import { useAppState } from "@/state/app-state";
import { useRewardAd } from "@/state/reward-ad-state";
import { colors, fonts, spacing } from "@/theme/tokens";

const claimSchema = z.object({
  intentId: z.string().uuid(),
  status: z.enum(["provisional", "verified"]),
});

export default function InterventionScreen() {
  const {
    app,
    attempts: attemptsParam,
    shortcutId,
  } = useLocalSearchParams<{
    app?: string;
    attempts?: string;
    shortcutId?: string;
  }>();
  const {
    cancelShortcut,
    config,
    deviceId,
    wallet,
    preferences,
    stats,
    unlockCurrent,
    unlockShortcut,
  } = useAppState();
  const { status: adStatus, showPrepared, retry } = useRewardAd();
  const [busy, setBusy] = useState(false);
  const durationLabel = localize(
    formatUnlockDuration(preferences.unlockDurationSeconds, "en"),
    formatUnlockDuration(preferences.unlockDurationSeconds, "es"),
  );
  const hasRewardedPass =
    wallet.rewardedBalance > 0 && wallet.rewardedPassesRemainingToday > 0;
  const hasEmergencyAccess = wallet.emergencyRemaining > 0;
  const appLabel = app || localize("Selected app", "App seleccionada");
  const isShortcutIntervention = Boolean(shortcutId);
  const isAndroidIntervention = Platform.OS === "android" && Boolean(app);
  const directUnlockAction = getInterventionUnlockAction({
    supportsDirectAd: isShortcutIntervention || isAndroidIntervention,
    hasDevice: Boolean(deviceId),
    rewardProvider: config.rewardProvider,
    rewardStatus: adStatus,
    rewardAdsRemainingToday: wallet.rewardAdsRemainingToday,
    rewardedPassesRemainingToday: wallet.rewardedPassesRemainingToday,
    rewardedBalance: wallet.rewardedBalance,
    maxRewardTokenBalance: config.maxRewardTokenBalance,
    emergencyRemaining: wallet.emergencyRemaining,
  });
  const directAdReady = directUnlockAction === "watch_ad";
  const directAdPreparing = directUnlockAction === "preparing_ad";
  const parsedAttempts = Number.parseInt(attemptsParam ?? "", 10);
  const attempts =
    Number.isFinite(parsedAttempts) && parsedAttempts > 0
      ? parsedAttempts
      : app
        ? 1
        : Math.max(stats.openAttempts, stats.avoidedOpens + stats.unlocks);

  async function unlock() {
    let shortcutFailureStage: "reward" | "unlock" | "return" = "unlock";
    setBusy(true);
    try {
      if (directAdReady) {
        shortcutFailureStage = "reward";
        const prepared = await showPrepared();
        if (!prepared) throw new Error("reward_unavailable");
        const { intent, result } = prepared;
        if (result.status !== "earned") return;
        await apiFetch(
          `/api/v1/rewards/intents/${intent.id}/claim`,
          claimSchema,
          {
            method: "POST",
            body: JSON.stringify({
              clientEventId: result.clientEventId,
              earnedAt: new Date().toISOString(),
            }),
            headers: { "idempotency-key": result.clientEventId },
          },
        );
        shortcutFailureStage = "unlock";
        if (shortcutId) {
          const session = await unlockShortcut(shortcutId, {
            freshReward: true,
          });
          capture("unlock_started", {
            source: "rewarded",
            resumedIntent: true,
            trigger: "ios_shortcut",
          });
          shortcutFailureStage = "return";
          await Linking.openURL(session.returnUrl);
          return;
        }
        await unlockCurrent({ freshReward: true });
        capture("unlock_started", {
          source: "rewarded",
          resumedIntent: true,
          trigger: "android_accessibility",
        });
        return;
      }
      if (directAdPreparing) return;
      if (shortcutId) {
        if (!hasRewardedPass && !hasEmergencyAccess) {
          retry();
          Alert.alert(
            localize("Ad not ready", "El anuncio no está listo"),
            localize(
              "Still is preparing another ad. Try again in a moment or use Emergency Access.",
              "Still está preparando otro anuncio. Inténtalo en un momento o usa el acceso de emergencia.",
            ),
          );
          return;
        }
        const session = await unlockShortcut(shortcutId);
        capture("unlock_started", {
          source: hasRewardedPass ? "rewarded" : "emergency",
          resumedIntent: true,
          trigger: "ios_shortcut",
        });
        shortcutFailureStage = "return";
        await Linking.openURL(session.returnUrl);
        return;
      }
      if (
        isAndroidIntervention &&
        directUnlockAction === "retry_ad" &&
        !hasRewardedPass &&
        !hasEmergencyAccess
      ) {
        retry();
        Alert.alert(
          localize("Ad not ready", "El anuncio no está listo"),
          localize(
            "Still is preparing another ad. Try again in a moment or use Emergency Access.",
            "Still está preparando otro anuncio. Inténtalo en un momento o usa el acceso de emergencia.",
          ),
        );
        return;
      }
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
        isShortcutIntervention
          ? shortcutFailureStage === "reward"
            ? localize(
                "The reward could not be confirmed, so access was not activated. Check your connection and try again.",
                "No se pudo confirmar la recompensa, por lo que el acceso no se activó. Revisa tu conexión e inténtalo de nuevo.",
              )
            : shortcutFailureStage === "return"
              ? localize(
                  "Check that the return shortcut name is exact. Access is active, so reopening the app will not show Still again during this window.",
                  "Comprueba que el nombre del atajo de retorno sea exacto. El acceso está activo, así que volver a abrir la app no mostrará Still durante este período.",
                )
              : localize(
                  "Still could not activate this access window. Open the app again to retry.",
                  "Still no pudo activar este período de acceso. Abre la app otra vez para reintentar.",
                )
          : localize(
              "No pass was lost. Try again from Still.",
              "No perdiste ningún pase. Inténtalo otra vez desde Still.",
            ),
      );
    } finally {
      setBusy(false);
      if (isShortcutIntervention) retry();
    }
  }

  async function goBack() {
    if (shortcutId) {
      setBusy(true);
      try {
        await cancelShortcut(shortcutId);
      } catch {
        // An expired intervention is already closed from the user's point of view.
      } finally {
        setBusy(false);
      }
      router.replace("/(tabs)/(today)");
      return;
    }
    if (isAndroidIntervention) {
      setBusy(true);
      try {
        await restrictionEngine.cancelCurrentIntervention();
        return;
      } catch {
        router.replace("/(tabs)/(today)");
        return;
      } finally {
        setBusy(false);
      }
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)/(today)");
  }

  const secondaryLabel = busy
    ? localize("Opening…", "Abriendo…")
    : directAdReady
      ? localize(
          `Watch ad · Open ${appLabel}`,
          `Ver anuncio · Abrir ${appLabel}`,
        )
      : directAdPreparing
        ? localize("Preparing the ad…", "Preparando el anuncio…")
        : hasRewardedPass
          ? localize(
              `Use 1 pass · ${formatUnlockDuration(preferences.unlockDurationSeconds, "en")}`,
              `Usar 1 pase · ${formatUnlockDuration(preferences.unlockDurationSeconds, "es")}`,
            )
          : hasEmergencyAccess
            ? localize(
                `Emergency access · ${formatUnlockDuration(preferences.unlockDurationSeconds, "en")}`,
                `Acceso de emergencia · ${formatUnlockDuration(preferences.unlockDurationSeconds, "es")}`,
              )
            : isShortcutIntervention || isAndroidIntervention
              ? localize("Retry ad", "Reintentar anuncio")
              : localize("Get a pass", "Conseguir un pase");

  return (
    <Screen style={styles.root} contentContainerStyle={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.topline}>
        <Eyebrow style={styles.lightLabel}>{appLabel}</Eyebrow>
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
            preferences.unlockDurationSeconds >= 86_400
              ? "What do you want from the rest of the day?"
              : `What do you want from the next ${durationLabel}?`,
            preferences.unlockDurationSeconds >= 86_400
              ? "¿Qué quieres del resto del día?"
              : `¿Qué quieres de los próximos ${durationLabel}?`,
          )}
        </Body>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={() => void goBack()}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        >
          <Text style={styles.primaryLabel}>
            {localize("Go back", "Volver")}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: busy || directAdPreparing }}
          disabled={busy || directAdPreparing}
          onPress={() => void unlock()}
          style={({ pressed }) => [
            styles.secondary,
            pressed && styles.pressed,
            (busy || directAdPreparing) && styles.disabled,
          ]}
        >
          <Text style={styles.secondaryLabel}>{secondaryLabel}</Text>
          <Text style={styles.secondaryArrow}>→</Text>
        </Pressable>
        <Body style={styles.note}>
          {localize(
            isShortcutIntervention
              ? `After continuing, Still runs your return shortcut and ${appLabel} stays open for ${durationLabel}.`
              : isAndroidIntervention
                ? `After continuing, Still returns directly to ${appLabel}, which stays open for ${durationLabel}.`
              : `The pause returns after ${durationLabel}. Continuing is a choice, not a failure.`,
            isShortcutIntervention
              ? `Después de continuar, Still ejecuta tu atajo de retorno y ${appLabel} queda abierto durante ${durationLabel}.`
              : isAndroidIntervention
                ? `Después de continuar, Still vuelve directamente a ${appLabel}, que queda abierto durante ${durationLabel}.`
              : `La pausa vuelve después de ${durationLabel}. Continuar es una elección, no un fracaso.`,
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

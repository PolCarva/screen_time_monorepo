import { useCallback, useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, StyleSheet, View } from "react-native";
import { z } from "zod";

import { apiFetch } from "@/lib/api";
import { capture } from "@/lib/analytics";
import { IntervalMark } from "@/components/interval-mark";
import { Screen } from "@/components/screen";
import { PrimaryButton } from "@/components/primary-button";
import { Body, Data, Display, Eyebrow, Heading, Mono } from "@/components/typography";
import { localize, t } from "@/i18n";
import { useAppState } from "@/state/app-state";
import { useRewardAd } from "@/state/reward-ad-state";
import { colors, fonts, spacing } from "@/theme/tokens";

const claimSchema = z.object({
  intentId: z.string().uuid(),
  status: z.enum(["provisional", "verified"]),
});
export default function TokensScreen() {
  const { recharge, autoUnlock } = useLocalSearchParams<{
    recharge?: string;
    autoUnlock?: string;
  }>();
  const {
    wallet,
    config,
    deviceId,
    addProvisionalToken,
    refresh,
    unlockCurrent,
  } = useAppState();
  const { status: adStatus, showPrepared, retry } = useRewardAd();
  const [busy, setBusy] = useState(false);
  const [earnedForRecharge, setEarnedForRecharge] = useState<string | null>(
    null,
  );
  const handledRecharge = useRef<string | null>(null);
  const autoUnlockInFlight = useRef(false);
  const earn = useCallback(async (rechargeRequest?: string) => {
    if (!deviceId || busy) return false;
    setBusy(true);
    capture("reward_intent_started", {
      platform: process.env.EXPO_OS ?? "unknown",
    });
    try {
      const prepared = await showPrepared();
      if (!prepared) throw new Error("unavailable");
      const { intent, result } = prepared;
      if (result.status !== "earned") return false;
      await addProvisionalToken();
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
      capture("reward_earned", { provisional: true });
      await refresh();
      if (rechargeRequest) setEarnedForRecharge(rechargeRequest);
      return true;
    } catch {
      Alert.alert(
        localize("Reward unavailable", "Recompensa no disponible"),
        localize(
          "You can always use an Emergency Unlock.",
          "Siempre puedes usar un desbloqueo de emergencia.",
        ),
      );
      return false;
    } finally {
      setBusy(false);
      retry();
    }
  }, [addProvisionalToken, busy, deviceId, refresh, retry, showPrepared]);
  const balanceCapped =
    wallet.rewardedBalance >= config.maxRewardTokenBalance;
  const capped = balanceCapped;
  const adReady = adStatus === "ready";
  useEffect(() => {
    if (
      !recharge ||
      !adReady ||
      busy ||
      capped ||
      handledRecharge.current === recharge
    ) {
      return;
    }
    handledRecharge.current = recharge;
    void earn(autoUnlock === "1" ? recharge : undefined).then((earned) => {
      if (!earned) handledRecharge.current = null;
    });
  }, [adReady, autoUnlock, busy, capped, earn, recharge]);
  useEffect(() => {
    if (
      autoUnlock !== "1" ||
      !recharge ||
      earnedForRecharge !== recharge ||
      wallet.rewardedBalance <= 0 ||
      busy ||
      autoUnlockInFlight.current
    ) {
      return;
    }

    autoUnlockInFlight.current = true;
    setBusy(true);
    void unlockCurrent()
      .then((session) => {
        capture("unlock_started", { source: "rewarded", resumedIntent: true });
        router.replace({
          pathname: "/unlock-ready",
          params: { endsAt: session.endsAt },
        });
      })
      .catch(() => {
        autoUnlockInFlight.current = false;
        Alert.alert(
          localize("Could not unlock", "No se pudo desbloquear"),
          localize(
            "Your token is still available. Return to the restricted app and try again.",
            "Tu pase sigue disponible. Vuelve a la app restringida e inténtalo de nuevo.",
          ),
        );
      })
      .finally(() => setBusy(false));
  }, [
    autoUnlock,
    busy,
    earnedForRecharge,
    recharge,
    unlockCurrent,
    wallet.rewardedBalance,
  ]);
  const buttonLabel = busy
    ? localize("Preparing the ad…", "Preparando el anuncio…")
    : balanceCapped
      ? localize("Pass limit reached", "Límite de pases alcanzado")
      : adReady
        ? localize("Get 1 pass", "Conseguir 1 pase")
        : adStatus === "unavailable"
          ? localize("Ad unavailable · retrying", "Anuncio no disponible · reintentando")
          : localize(
              "Preparing the ad…",
              "Preparando el anuncio…",
            );
  return (
    <Screen>
      <View style={styles.header}>
        <Eyebrow>{localize("PASSES / YOUR CHOICE", "PASES / TU ELECCIÓN")}</Eyebrow>
        <Display>{localize("Ten minutes,\nwhen you choose.", "Diez minutos,\ncuando eliges.")}</Display>
        <Body style={styles.lede}>
          {localize(
            "A pass opens a selected app for 10 minutes. Getting one is always optional.",
            "Un pase abre una app elegida durante 10 minutos. Conseguirlo siempre es opcional.",
          )}
        </Body>
      </View>

      <View style={styles.balancePanel}>
        <View style={styles.balanceHeader}>
          <Eyebrow>{localize("AVAILABLE NOW", "DISPONIBLES AHORA")}</Eyebrow>
          <Mono>{wallet.rewardedBalance} / {config.maxRewardTokenBalance}</Mono>
        </View>
        <View style={styles.balanceRow}>
          <Data style={styles.balance}>{String(wallet.rewardedBalance).padStart(2, "0")}</Data>
          <View style={styles.balanceCopy}>
            <Heading>{localize("passes", "pases")}</Heading>
            <Body style={styles.note}>{localize("non-transferable", "no transferibles")}</Body>
          </View>
        </View>
        <IntervalMark label={localize("10 MIN / PASS", "10 MIN / PASE")} />
        <PrimaryButton
          onPress={() => void earn()}
          disabled={capped || busy || !deviceId || !adReady}
          variant="signal"
        >
          {buttonLabel}
        </PrimaryButton>
      </View>
      {capped && (
        <Body style={styles.limitNote}>
          {localize(
            "You already have the maximum number of passes.",
            "Ya tienes el máximo de pases disponible.",
          )}
        </Body>
      )}

      <View style={styles.emergency}>
        <View style={styles.sectionTop}>
          <Eyebrow>02 / {localize("OFFLINE OPTION", "OPCIÓN SIN CONEXIÓN")}</Eyebrow>
          <Data style={styles.emergencyCount}>{wallet.emergencyRemaining}</Data>
        </View>
        <Heading>{t("emergency")}</Heading>
        <Body style={styles.note}>
          {localize(
            "Available today. They work even when an ad or connection doesn’t.",
            "Disponibles hoy. Funcionan incluso cuando no hay anuncio o conexión.",
          )}
        </Body>
      </View>

      <View style={styles.policy}>
        <Eyebrow>{localize("HOW ADS WORK", "CÓMO FUNCIONAN LOS ANUNCIOS")}</Eyebrow>
        <Body style={styles.policyBody}>
          {localize(
            "Optional, limited ads fund Still. The platform allocates part of that revenue to the weekly fund; an individual ad is not a donation.",
            "Los anuncios opcionales y limitados financian Still. La plataforma asigna parte de ese ingreso al fondo semanal; un anuncio individual no es una donación.",
          )}
        </Body>
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  header: { gap: spacing.lg },
  lede: { color: colors.muted },
  balancePanel: {
    paddingVertical: spacing.lg,
    gap: spacing.xl,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.ink,
  },
  balanceHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  balanceRow: { minHeight: 122, flexDirection: "row", alignItems: "flex-end", gap: spacing.lg },
  balance: {
    fontFamily: fonts.monoMedium,
    fontSize: 92,
    lineHeight: 96,
    letterSpacing: -5,
  },
  balanceCopy: { paddingBottom: spacing.sm, gap: spacing.xs },
  note: { fontSize: 12, color: colors.muted },
  limitNote: {
    padding: spacing.md,
    borderLeftWidth: 5,
    borderColor: colors.warning,
    backgroundColor: colors.paperRaised,
    color: colors.muted,
    fontSize: 13,
  },
  emergency: {
    paddingVertical: spacing.xl,
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
  },
  sectionTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  emergencyCount: { fontSize: 34, lineHeight: 36 },
  policy: {
    padding: spacing.lg,
    gap: spacing.md,
    borderLeftWidth: 7,
    borderColor: colors.record,
    backgroundColor: colors.paperRaised,
  },
  policyBody: { fontSize: 14, lineHeight: 22 },
});

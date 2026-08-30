import { useCallback, useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, StyleSheet, View } from "react-native";
import { z } from "zod";

import { apiFetch } from "@/lib/api";
import { capture } from "@/lib/analytics";
import { AttentionField } from "@/components/attention-field";
import { FieldApertureMark } from "@/components/field-aperture-mark";
import { Screen } from "@/components/screen";
import { PrimaryButton } from "@/components/primary-button";
import { Body, Data, Eyebrow, Heading, Mono } from "@/components/typography";
import { localize, t } from "@/i18n";
import { useAppState } from "@/state/app-state";
import { useRewardAd } from "@/state/reward-ad-state";
import { colors, spacing } from "@/theme/tokens";

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
  const earn = useCallback(
    async (rechargeRequest?: string) => {
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
        const claim = await apiFetch(
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
        // The server must accept the claim before a pass reaches the local
        // wallet. Otherwise a failed request would create a phantom pass that
        // the native restriction extension could spend.
        await addProvisionalToken();
        capture("reward_earned", {
          provisional: claim.status === "provisional",
        });
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
    },
    [addProvisionalToken, busy, deviceId, refresh, retry, showPrepared],
  );
  const balanceCapped = wallet.rewardedBalance >= config.maxRewardTokenBalance;
  const durationMinutes = Math.max(
    1,
    Math.round(config.unlockDurationSeconds / 60),
  );
  const rewardsEnabled = config.rewardProvider === "admob";
  const dailyCapped = wallet.rewardAdsRemainingToday <= 0;
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
    : !rewardsEnabled
      ? localize("Rewards paused", "Recompensas en pausa")
      : balanceCapped
        ? localize("Pass limit reached", "Límite de pases alcanzado")
        : dailyCapped
          ? localize("Daily limit reached", "Límite diario alcanzado")
          : adReady
            ? localize("Get 1 pass", "Conseguir 1 pase")
            : adStatus === "unavailable"
              ? localize(
                  "Ad unavailable · retrying",
                  "Anuncio no disponible · reintentando",
                )
              : localize("Preparing the ad…", "Preparando el anuncio…");
  return (
    <Screen contentContainerStyle={styles.screen}>
      <View style={styles.topline}>
        <FieldApertureMark size={34} />
        <Eyebrow>
          {localize(
            `PASSES / ${durationMinutes} MIN`,
            `PASES / ${durationMinutes} MIN`,
          )}
        </Eyebrow>
      </View>

      <View style={styles.balancePanel}>
        <View style={styles.balanceHeader}>
          <Eyebrow>{localize("AVAILABLE NOW", "DISPONIBLES AHORA")}</Eyebrow>
          <Mono>
            {wallet.rewardedBalance} / {config.maxRewardTokenBalance}
          </Mono>
        </View>
        <View style={styles.balanceRow}>
          <Data style={styles.balance}>{wallet.rewardedBalance}</Data>
          <View style={styles.balanceCopy}>
            <Heading>
              {wallet.rewardedBalance === 1
                ? localize("pass available", "pase disponible")
                : localize("passes available", "pases disponibles")}
            </Heading>
            <Body style={styles.note}>
              {localize(
                `Each one opens one selected app for ${durationMinutes} minutes.`,
                `Cada uno abre una app seleccionada durante ${durationMinutes} minutos.`,
              )}
            </Body>
          </View>
        </View>
        <AttentionField
          accessibilityLabel={localize(
            `${wallet.rewardedBalance} passes available out of ${config.maxRewardTokenBalance}.`,
            `${wallet.rewardedBalance} pases disponibles de ${config.maxRewardTokenBalance}.`,
          )}
          values={[0, 0, 0, 0, 0, 0, wallet.rewardedBalance]}
          passes={wallet.rewardedBalance}
        />
        <PrimaryButton
          onPress={() => void earn()}
          disabled={
            !rewardsEnabled ||
            dailyCapped ||
            capped ||
            busy ||
            !deviceId ||
            !adReady
          }
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
          <Eyebrow>{localize("OFFLINE ACCESS", "ACCESO SIN CONEXIÓN")}</Eyebrow>
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
        <View style={styles.sectionTop}>
          <Eyebrow>{localize("OPTIONAL ADS", "ANUNCIOS OPCIONALES")}</Eyebrow>
          <Mono>
            {localize(
              `MAX ${config.maxRewardedAdsPerUtcDay} / DAY`,
              `MÁX ${config.maxRewardedAdsPerUtcDay} / DÍA`,
            )}
          </Mono>
        </View>
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
  screen: { gap: 0 },
  topline: {
    minHeight: 58,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  balancePanel: {
    paddingVertical: spacing.xl,
    gap: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
  },
  balanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  balanceRow: {
    minHeight: 104,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.lg,
  },
  balance: {
    fontSize: 84,
    lineHeight: 84,
    letterSpacing: -4,
  },
  balanceCopy: { paddingBottom: spacing.sm, gap: spacing.xs },
  note: {
    maxWidth: 240,
    fontSize: 12,
    lineHeight: 18,
    color: colors.graphiteSoft,
  },
  limitNote: {
    padding: spacing.md,
    borderLeftWidth: 3,
    borderColor: colors.warning,
    color: colors.graphiteSoft,
    fontSize: 13,
  },
  emergency: {
    paddingVertical: spacing.xl,
    gap: spacing.md,
    borderTopWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
  },
  sectionTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  emergencyCount: { fontSize: 34, lineHeight: 36 },
  policy: {
    paddingVertical: spacing.xl,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
  },
  policyBody: { fontSize: 14, lineHeight: 22 },
});

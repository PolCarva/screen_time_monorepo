import { useCallback, useEffect, useRef, useState } from "react";
import { formatAccessDuration } from "@screen-time/contracts";
import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";
import { z } from "zod";

import { apiFetch } from "@/lib/api";
import { capture } from "@/lib/analytics";
import { AttentionField } from "@/components/attention-field";
import { DurationSlider } from "@/components/duration-slider";
import { FieldApertureMark } from "@/components/field-aperture-mark";
import { Screen } from "@/components/screen";
import { PrimaryButton } from "@/components/primary-button";
import {
  closeAction,
  retryAction,
  useStillSheet,
} from "@/components/still-sheet";
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
    preferences,
    deviceId,
    addProvisionalToken,
    lastAccessDurationSeconds,
    refresh,
    rememberAccessDuration,
    unlockCurrent,
  } = useAppState();
  const { status: adStatus, showPrepared, retry } = useRewardAd();
  const sheet = useStillSheet();
  const [busy, setBusy] = useState(false);
  const [earnedForRecharge, setEarnedForRecharge] = useState<string | null>(
    null,
  );
  const handledRecharge = useRef<string | null>(null);
  const autoUnlockInFlight = useRef(false);
  const [chosenWindow, setChosenWindow] = useState<number | null>(null);
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
        const emergency = wallet.emergencyRemaining;
        void sheet.show({
          title: localize("The ad didn't load", "El anuncio no cargó"),
          message:
            emergency > 0
              ? localize(
                  `Try again in a moment. You have ${emergency} emergency ${emergency === 1 ? "access" : "accesses"} for today.`,
                  `Prueba otra vez en un momento. Tienes ${emergency} ${emergency === 1 ? "acceso" : "accesos"} de emergencia para hoy.`,
                )
              : localize(
                  "Try again in a moment.",
                  "Prueba otra vez en un momento.",
                ),
          actions: [
            retryAction(() => {
              void earn(rechargeRequest);
            }),
            closeAction(),
          ],
        });
        return false;
      } finally {
        setBusy(false);
        retry();
      }
    },
    [
      addProvisionalToken,
      busy,
      deviceId,
      refresh,
      retry,
      sheet,
      showPrepared,
      wallet.emergencyRemaining,
    ],
  );
  const balanceCapped = wallet.rewardedBalance >= config.maxRewardTokenBalance;
  // Nothing is decided in advance: the window is chosen once the pass exists.
  const windowSeconds = chosenWindow ?? lastAccessDurationSeconds;
  const windowLabel = localize(
    formatAccessDuration(windowSeconds, "en"),
    formatAccessDuration(windowSeconds, "es"),
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
  // The ad is over and the pass exists: the only thing left is how long the
  // app stays open, which the user chooses here rather than ahead of time.
  const choosingWindow =
    autoUnlock === "1" &&
    Boolean(recharge) &&
    earnedForRecharge === recharge &&
    wallet.rewardedBalance > 0;
  const openForChosenWindow = useCallback(async () => {
    if (autoUnlockInFlight.current || busy) return;
    autoUnlockInFlight.current = true;
    setBusy(true);
    try {
      const session = await unlockCurrent({ durationSeconds: windowSeconds });
      await rememberAccessDuration(windowSeconds);
      capture("unlock_started", {
        source: "rewarded",
        resumedIntent: true,
        durationSeconds: windowSeconds,
      });
      router.replace({
        pathname: "/unlock-ready",
        params: { endsAt: session.endsAt },
      });
    } catch {
      autoUnlockInFlight.current = false;
      void sheet.show({
        title: localize("The app didn't open", "No se abrió la app"),
        message: localize(
          "Your pass is still saved.",
          "Tu pase sigue guardado.",
        ),
        actions: [
          retryAction(() => {
            void openForChosenWindow();
          }),
          closeAction(),
        ],
      });
    } finally {
      setBusy(false);
    }
  }, [busy, rememberAccessDuration, sheet, unlockCurrent, windowSeconds]);
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
              ? localize("Looking for an ad…", "Buscando un anuncio…")
              : localize("Preparing the ad…", "Preparando el anuncio…");
  return (
    <Screen contentContainerStyle={styles.screen}>
      <View style={styles.topline}>
        <FieldApertureMark size={34} />
        <Eyebrow>{localize("PASSES", "PASES")}</Eyebrow>
      </View>

      {choosingWindow ? (
        <View style={styles.windowPanel}>
          <Eyebrow>{localize("HOW LONG", "CUÁNTO TIEMPO")}</Eyebrow>
          <Heading>
            {localize(
              "Choose how long the app stays open.",
              "Elige cuánto tiempo queda abierta la app.",
            )}
          </Heading>
          <Body style={styles.note}>
            {localize(
              "When the time is up, the pause comes back.",
              "Al terminar el tiempo, vuelve la pausa.",
            )}
          </Body>
          <DurationSlider
            disabled={busy}
            onChange={setChosenWindow}
            tone="light"
            value={windowSeconds}
          />
          <PrimaryButton
            disabled={busy}
            onPress={() => void openForChosenWindow()}
            variant="signal"
          >
            {localize(`Open for ${windowLabel}`, `Abrir por ${windowLabel}`)}
          </PrimaryButton>
        </View>
      ) : null}

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
                "Each one opens one selected app for as long as you choose when you use it, from 1 minute to the rest of the day.",
                "Cada uno abre una app seleccionada durante el tiempo que elijas al usarlo, desde 1 minuto hasta el resto del día.",
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
      {wallet.rewardedPassesRemainingToday <= 0 && (
        <Body style={styles.limitNote}>
          {localize(
            "You reached your pass limit for today. Stored passes remain available tomorrow.",
            "Alcanzaste tu límite de pases de hoy. Los pases guardados seguirán disponibles mañana.",
          )}
        </Body>
      )}

      <View style={styles.emergency}>
        <View style={styles.sectionTop}>
          <Eyebrow>{localize("EMERGENCY", "EMERGENCIA")}</Eyebrow>
          <Data style={styles.emergencyCount}>{wallet.emergencyRemaining}</Data>
        </View>
        <Heading>{t("emergency")}</Heading>
        <Body style={styles.note}>
          {localize(
            "To go in without an ad when you need it. They renew every day.",
            "Para entrar sin anuncio cuando lo necesites. Se renuevan cada día.",
          )}
        </Body>
      </View>

      <View style={styles.policy}>
        <View style={styles.sectionTop}>
          <Eyebrow>{localize("OPTIONAL ADS", "ANUNCIOS OPCIONALES")}</Eyebrow>
          <Mono>
            {localize(
              `MAX ${preferences.maxRewardedAdsPerUtcDay} / DAY`,
              `MÁX ${preferences.maxRewardedAdsPerUtcDay} / DÍA`,
            )}
          </Mono>
        </View>
        <Body style={styles.policyBody}>
          {localize(
            "The ads you choose to watch fund Still. Part of that revenue goes to the weekly fund.",
            "Los anuncios que eliges ver financian Still. Parte de ese ingreso va al fondo semanal.",
          )}
        </Body>
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  screen: { gap: 0 },
  windowPanel: {
    paddingVertical: spacing.xl,
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
  },
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

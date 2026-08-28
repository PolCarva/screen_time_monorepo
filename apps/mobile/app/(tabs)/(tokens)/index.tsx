import { useCallback, useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, StyleSheet, Text, View } from "react-native";
import { z } from "zod";

import { apiFetch } from "@/lib/api";
import { capture } from "@/lib/analytics";
import { Screen } from "@/components/screen";
import { PrimaryButton } from "@/components/primary-button";
import { Surface } from "@/components/surface";
import { Body, Display, Eyebrow } from "@/components/typography";
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
            "Tu token sigue disponible. Volvé a la app restringida e intentá nuevamente.",
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
    ? localize("Opening…", "Abriendo…")
    : balanceCapped
      ? localize("Token limit reached", "Límite de tokens alcanzado")
      : adReady
        ? t("getToken")
        : adStatus === "unavailable"
          ? localize("Retrying ad…", "Reintentando anuncio…")
          : localize(
              "Preparing in background…",
              "Preparando en segundo plano…",
            );
  return (
    <Screen>
      <View>
        <Eyebrow>
          {localize("Your time, your choice", "Tu tiempo, tu elección")}
        </Eyebrow>
        <Display>{t("tokens")}</Display>
      </View>
      <View style={styles.ring}>
        <View style={styles.inner}>
          <Text style={styles.balance}>{wallet.rewardedBalance}</Text>
          <Body style={styles.center}>{t("available")}</Body>
        </View>
      </View>
      <PrimaryButton
        onPress={() => void earn()}
        disabled={capped || busy || !deviceId || !adReady}
      >
        {buttonLabel}
      </PrimaryButton>
      {capped && (
        <Body style={styles.note}>
          {localize(
            "You reached the token balance cap.",
            "Alcanzaste el saldo máximo de tokens.",
          )}
        </Body>
      )}
      <Eyebrow>{localize("Other options", "Otras opciones")}</Eyebrow>
      <Surface style={styles.row}>
        <Text style={styles.rowIcon}>♙</Text>
        <View>
          <Text style={styles.rowTitle}>{t("emergency")}</Text>
          <Body style={styles.note}>
            {wallet.emergencyRemaining}{" "}
            {localize(
              "available today · work offline",
              "disponibles hoy · funcionan offline",
            )}
          </Body>
        </View>
      </Surface>
      <Surface style={styles.policy}>
        <Eyebrow>{localize("No pressure", "Sin presión")}</Eyebrow>
        <Body>
          {localize(
            "Ads are optional, limited, and non-personalized. The platform allocates part of its advertising revenue to the fund; no individual ad ‘donates’ money.",
            "Los anuncios son opcionales, limitados y no personalizados. La plataforma asigna parte de su ingreso publicitario al fondo; ningún anuncio individual “dona” dinero.",
          )}
        </Body>
      </Surface>
    </Screen>
  );
}
const styles = StyleSheet.create({
  ring: {
    width: 230,
    height: 230,
    borderRadius: 115,
    borderWidth: 8,
    borderColor: colors.stone,
    borderTopColor: colors.sage,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  inner: { alignItems: "center" },
  balance: {
    fontFamily: fonts.display,
    fontSize: 76,
    lineHeight: 78,
    color: colors.forest,
  },
  center: { textAlign: "center", color: colors.muted },
  note: { fontSize: 12, color: colors.muted },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  rowIcon: { fontSize: 28, color: colors.sage },
  rowTitle: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink },
  policy: { backgroundColor: "rgba(220,201,179,.22)" },
});

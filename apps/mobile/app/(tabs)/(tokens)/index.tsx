import { useState } from "react";
import * as Crypto from "expo-crypto";
import { Alert, StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { rewardIntentSchema } from "@screen-time/contracts";

import { apiFetch } from "@/lib/api";
import { capture } from "@/lib/analytics";
import { Screen } from "@/components/screen";
import { PrimaryButton } from "@/components/primary-button";
import { Surface } from "@/components/surface";
import { Body, Display, Eyebrow } from "@/components/typography";
import { localize, t } from "@/i18n";
import { admobRewardProvider } from "@/native/reward-provider";
import { useAppState } from "@/state/app-state";
import { colors, fonts, spacing } from "@/theme/tokens";

const claimSchema = z.object({ intentId: z.string().uuid(), status: z.enum(["provisional", "verified"]) });
export default function TokensScreen() {
  const { wallet, config, deviceId, addProvisionalToken, refresh } = useAppState();
  const [busy, setBusy] = useState(false);
  async function earn() {
    if (!deviceId || busy) return;
    setBusy(true); capture("reward_intent_started", { platform: process.env.EXPO_OS ?? "unknown" });
    try {
      const intent = await apiFetch("/api/v1/rewards/intents", rewardIntentSchema, { method: "POST", body: JSON.stringify({ deviceId, provider: "admob" }), headers: { "idempotency-key": Crypto.randomUUID() } });
      if (await admobRewardProvider.prepare() !== "ready") throw new Error("unavailable");
      const result = await admobRewardProvider.show({ ...intent, userId: "anonymous" });
      if (result.status !== "earned") return;
      await addProvisionalToken();
      await apiFetch(`/api/v1/rewards/intents/${intent.id}/claim`, claimSchema, { method: "POST", body: JSON.stringify({ clientEventId: result.clientEventId, earnedAt: new Date().toISOString() }), headers: { "idempotency-key": result.clientEventId } });
      capture("reward_earned", { provisional: true }); await refresh();
    } catch { Alert.alert(localize("Reward unavailable", "Recompensa no disponible"), localize("You can always use an Emergency Unlock.", "Siempre puedes usar un desbloqueo de emergencia.")); }
    finally { setBusy(false); }
  }
  const capped = wallet.rewardedBalance >= config.maxRewardTokenBalance || wallet.unresolvedRewardClaims >= 3;
  return <Screen><View><Eyebrow>{localize("Your time, your choice", "Tu tiempo, tu elección")}</Eyebrow><Display>{t("tokens")}</Display></View><View style={styles.ring}><View style={styles.inner}><Text style={styles.balance}>{wallet.rewardedBalance}</Text><Body style={styles.center}>{t("available")}</Body></View></View><PrimaryButton onPress={earn} disabled={capped || busy || !deviceId}>{busy ? localize("Preparing…", "Preparando…") : t("getToken")}</PrimaryButton>{capped && <Body style={styles.note}>{localize("You reached the balance cap or have rewards awaiting verification.", "Alcanzaste el saldo máximo o tienes recompensas pendientes de verificación.")}</Body>}<Eyebrow>{localize("Other options", "Otras opciones")}</Eyebrow><Surface style={styles.row}><Text style={styles.rowIcon}>♙</Text><View><Text style={styles.rowTitle}>{t("emergency")}</Text><Body style={styles.note}>{wallet.emergencyRemaining} {localize("available today · work offline", "disponibles hoy · funcionan offline")}</Body></View></Surface><Surface style={styles.policy}><Eyebrow>{localize("No pressure", "Sin presión")}</Eyebrow><Body>{localize("Ads are optional, limited, and non-personalized. The platform allocates part of its advertising revenue to the fund; no individual ad ‘donates’ money.", "Los anuncios son opcionales, limitados y no personalizados. La plataforma asigna parte de su ingreso publicitario al fondo; ningún anuncio individual “dona” dinero.")}</Body></Surface></Screen>;
}
const styles=StyleSheet.create({ring:{width:230,height:230,borderRadius:115,borderWidth:8,borderColor:colors.stone,borderTopColor:colors.sage,alignSelf:"center",alignItems:"center",justifyContent:"center"},inner:{alignItems:"center"},balance:{fontFamily:fonts.display,fontSize:76,lineHeight:78,color:colors.forest},center:{textAlign:"center",color:colors.muted},note:{fontSize:12,color:colors.muted},row:{flexDirection:"row",alignItems:"center",gap:spacing.md},rowIcon:{fontSize:28,color:colors.sage},rowTitle:{fontFamily:fonts.sansMedium,fontSize:14,color:colors.ink},policy:{backgroundColor:"rgba(220,201,179,.22)"}});

import { router } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/primary-button";
import { Screen } from "@/components/screen";
import { Body, Display, Eyebrow } from "@/components/typography";
import { localize, t } from "@/i18n";
import { useAppState } from "@/state/app-state";
import { colors, fonts, spacing } from "@/theme/tokens";

export default function InterventionScreen() {
  const { wallet, config, unlockCurrent }=useAppState(); const [busy,setBusy]=useState(false);
  async function unlock(){setBusy(true);try{if(wallet.rewardedBalance<=0&&wallet.emergencyRemaining<=0){router.replace("/(tabs)/(tokens)");return;}await unlockCurrent();router.back();}catch{Alert.alert(localize("Unlock unavailable", "Desbloqueo no disponible"),localize("Open Still again or use an Emergency Unlock.", "Abre Still otra vez o usa un desbloqueo de emergencia."));}finally{setBusy(false);}}
  return <Screen contentContainerStyle={styles.screen}><Eyebrow>{localize("A pause before you enter", "Una pausa antes de entrar")}</Eyebrow><View style={styles.seal}><Text style={styles.leaf}>⌁</Text></View><View><Display style={styles.center}>{t("interventionTitle")}</Display><Body style={styles.detail}>{localize("Your selected-app time is shown on Today", "Tu tiempo en apps seleccionadas aparece en Hoy")}</Body></View><View style={styles.actions}><Text style={styles.nowNot} onPress={()=>router.back()}>{t("nowNot")}</Text><PrimaryButton onPress={unlock} disabled={busy}>{wallet.rewardedBalance>0?t("useToken"):`Emergency Unlock · ${wallet.emergencyRemaining}`}</PrimaryButton><Body style={styles.note}>{localize(`The unlock lasts ${Math.round(config.unlockDurationSeconds/60)} minutes and is restored even if you close Still.`, `El desbloqueo dura ${Math.round(config.unlockDurationSeconds/60)} minutos y se restaura incluso si cierras Still.`)}</Body></View></Screen>;
}
const styles=StyleSheet.create({screen:{flexGrow:1,justifyContent:"space-between",alignItems:"center",paddingVertical:spacing.xxl},seal:{width:150,height:150,borderRadius:75,backgroundColor:colors.stone,borderWidth:1,borderColor:"#C8BBA8",alignItems:"center",justifyContent:"center",shadowColor:colors.ink,shadowOpacity:.15,shadowRadius:20,shadowOffset:{width:0,height:10}},leaf:{fontSize:62,color:colors.forest},center:{textAlign:"center",fontSize:38},detail:{textAlign:"center",color:colors.muted,marginTop:spacing.md},actions:{width:"100%",gap:spacing.md},nowNot:{fontFamily:fonts.sansBold,textAlign:"center",fontSize:16,color:colors.forest,padding:spacing.lg},note:{fontSize:11,textAlign:"center",color:colors.muted}});

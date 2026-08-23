import { useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { PrimaryButton } from "@/components/primary-button";
import { Screen } from "@/components/screen";
import { Body, Display, Eyebrow } from "@/components/typography";
import { localize } from "@/i18n";
import { restrictionEngine } from "@/native/restriction-engine";
import { useAppState } from "@/state/app-state";
import { colors, fonts, radius, spacing } from "@/theme/tokens";

const steps = [
  { eyebrow: localize("01 · Welcome", "01 · Bienvenida"), title: localize("Less screen.\nMore life.", "Menos pantalla.\nMás vida."), body: localize("Still adds a gentle pause before the apps you choose. Your selection never leaves this device.", "Still añade una pausa amable antes de las apps que eliges. Tus selecciones nunca salen de este dispositivo."), action: localize("Continue", "Continuar") },
  { eyebrow: localize("02 · How it works", "02 · Cómo funciona"), title: localize("Interrupt.\nChoose. Return.", "Interrumpe.\nElige. Regresa."), body: localize("When the intervention appears, ‘Not now’ is always the easiest path. One token opens ten minutes.", "Cuando aparece la intervención, ‘Ahora no’ siempre es el camino más directo. Un token abre 10 minutos."), action: localize("I understand", "Entiendo") },
  { eyebrow: localize("03 · Privacy", "03 · Privacidad"), title: localize("Your usage is\nyours alone.", "Tu uso es\nsolo tuyo."), body: localize("The app shares general counts, never app names, package names, bundle IDs, or detailed history.", "La app comparte conteos generales, nunca nombres de apps, package names, bundle IDs ni historial detallado."), action: localize("Continue", "Continuar") },
  { eyebrow: localize("04 · Setup", "04 · Preparación"), title: localize("Choose with\nintention.", "Elige con\nintención."), body: localize("Confirm you are 18 or older, authorize the engine, and select the apps where you want a pause.", "Confirma que tienes 18 años, autoriza el motor y selecciona las apps donde quieres una pausa."), action: localize("Set up restrictions", "Configurar restricciones") },
];

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const { setOnboarded } = useAppState();
  const current = steps[step]!;

  async function next() {
    if (step < steps.length - 1) return setStep(step + 1);
    if (!adult) return;
    setBusy(true);
    try {
      const restrictionStatus = await restrictionEngine.requestAuthorization();
      if (restrictionStatus !== "authorized") {
        Alert.alert(localize("Authorize pauses", "Autoriza las pausas"), localize("Enable Still in Settings, return, and tap the button again.", "Activa Still en Ajustes, regresa y toca el botón de nuevo."));
        return;
      }
      const wellbeingStatus = await restrictionEngine.requestWellbeingAuthorization();
      if (Platform.OS === "android" && wellbeingStatus !== "authorized") {
        Alert.alert(localize("Authorize wellbeing stats", "Autoriza las estadísticas"), localize("Enable Usage Access, return, and tap the button again.", "Activa el acceso de uso, regresa y toca el botón de nuevo."));
        return;
      }
      const selection = await restrictionEngine.presentAppPicker();
      if (selection.count > 0) await restrictionEngine.applyRestrictions(selection);
      await setOnboarded(true);
      router.replace("/(tabs)/(today)");
    } finally { setBusy(false); }
  }

  return (
    <Screen contentContainerStyle={styles.screen}>
      <View style={styles.top}><Eyebrow>{current.eyebrow}</Eyebrow><Text style={styles.skip} onPress={() => setStep(steps.length - 1)}>{localize("Skip", "Saltar")}</Text></View>
      <View style={styles.art}><View style={styles.orbit}><View style={styles.seal}><Text style={styles.leaf}>⌁</Text></View></View></View>
      <View><Display>{current.title}</Display><Body style={styles.body}>{current.body}</Body></View>
      {step === steps.length - 1 && <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: adult }} onPress={() => setAdult(!adult)} style={styles.checkRow}><View style={[styles.check, adult && styles.checkOn]}>{adult && <Text style={styles.tick}>✓</Text>}</View><Body>{localize("I confirm that I am 18 or older.", "Confirmo que tengo 18 años o más.")}</Body></Pressable>}
      <View style={styles.footer}><View style={styles.dots}>{steps.map((_, index) => <View key={index} style={[styles.dot, index === step && styles.dotActive]} />)}</View><PrimaryButton onPress={next} disabled={busy || (step === steps.length - 1 && !adult)}>{busy ? localize("Preparing…", "Preparando…") : current.action}</PrimaryButton></View>
    </Screen>
  );
}

const styles = StyleSheet.create({ screen: { flexGrow: 1, justifyContent: "space-between", minHeight: 740 }, top: { flexDirection: "row", justifyContent: "space-between" }, skip: { fontFamily: fonts.sansMedium, color: colors.muted, fontSize: 12 }, art: { alignItems: "center", justifyContent: "center", marginVertical: spacing.md }, orbit: { width: 230, height: 230, borderRadius: 115, borderWidth: 1, borderColor: colors.clay, alignItems: "center", justifyContent: "center" }, seal: { width: 134, height: 134, borderRadius: 67, backgroundColor: colors.stone, borderWidth: 1, borderColor: "#C8BBA8", alignItems: "center", justifyContent: "center", shadowColor: colors.ink, shadowOpacity: .14, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } }, leaf: { fontSize: 58, color: colors.forest }, body: { marginTop: spacing.md, color: colors.muted }, footer: { gap: spacing.lg }, dots: { flexDirection: "row", justifyContent: "center", gap: 7 }, dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.stone }, dotActive: { width: 22, backgroundColor: colors.sage }, checkRow: { padding: spacing.md, flexDirection: "row", gap: spacing.md, alignItems: "center", borderWidth: 1, borderColor: colors.line, borderRadius: radius.md }, check: { width: 24, height: 24, borderWidth: 1, borderColor: colors.sage, borderRadius: 12, alignItems: "center", justifyContent: "center" }, checkOn: { backgroundColor: colors.sage }, tick: { color: colors.white, fontFamily: fonts.sansBold } });

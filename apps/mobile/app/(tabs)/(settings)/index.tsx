import { AdsConsent } from "react-native-google-mobile-ads";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, Share, StyleSheet, Switch, Text, View } from "react-native";

import { PrimaryButton } from "@/components/primary-button";
import { Screen } from "@/components/screen";
import { Surface } from "@/components/surface";
import { Body, Display, Eyebrow } from "@/components/typography";
import { localize, t } from "@/i18n";
import { analytics } from "@/lib/analytics";
import { apiRequest } from "@/lib/api";
import { linkIdentity } from "@/lib/identity";
import { getJson, setJson } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { restrictionEngine, type RestrictionHealth } from "@/native/restriction-engine";
import { useAppState } from "@/state/app-state";
import { colors, fonts, spacing } from "@/theme/tokens";

export default function SettingsScreen() {
  const { setOnboarded } = useAppState();
  const [health, setHealth] = useState<RestrictionHealth | null>(null);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);

  useEffect(() => {
    void restrictionEngine.getHealth().then(setHealth);
    void getJson("analyticsEnabled", true).then(setAnalyticsEnabled);
  }, []);

  async function link(provider: "apple" | "google") {
    try {
      const linked = await linkIdentity(provider);
      if (linked) Alert.alert(localize("Account linked", "Cuenta vinculada"), localize("You can now participate in voting.", "Ya puedes participar en las votaciones."));
    } catch {
      Alert.alert(localize("Could not link", "No se pudo vincular"), localize("Check the provider configuration and try again.", "Revisa la configuración del proveedor e inténtalo otra vez."));
    }
  }

  async function chooseApps() {
    const selection = await restrictionEngine.presentAppPicker();
    await restrictionEngine.applyRestrictions(selection);
    setHealth(await restrictionEngine.getHealth());
  }

  async function toggleAnalytics(value: boolean) {
    setAnalyticsEnabled(value);
    await setJson("analyticsEnabled", value);
    if (value) analytics?.optIn();
    else analytics?.optOut();
  }

  async function exportData() {
    try {
      const response = await apiRequest("/api/v1/privacy/export", { method: "POST" });
      const payload = await response.json();
      await Share.share({ message: JSON.stringify(payload, null, 2), title: "Still data export" });
    } catch {
      Alert.alert(localize("Could not export", "No se pudo exportar"), localize("Check your connection and try again.", "Revisa tu conexión e inténtalo otra vez."));
    }
  }

  function confirmDeletion() {
    Alert.alert(
      localize("Delete account and data", "Eliminar cuenta y datos"),
      localize("This deletes your profile, devices, and wellbeing data. The financial ledger is retained only in pseudonymized form.", "Esta acción elimina tu perfil, dispositivos y datos de bienestar. El ledger financiero se conserva solo pseudonimizado."),
      [
        { text: localize("Cancel", "Cancelar"), style: "cancel" },
        {
          text: localize("Delete permanently", "Eliminar definitivamente"),
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await apiRequest("/api/v1/privacy/delete", { method: "POST" });
                await supabase?.auth.signOut({ scope: "local" });
                await setOnboarded(false);
                router.replace("/(onboarding)" as never);
              } catch {
                Alert.alert(localize("Could not delete", "No se pudo eliminar"), localize("Your data was not changed. Try again.", "Tus datos no se modificaron. Inténtalo otra vez."));
              }
            })();
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <View>
        <Eyebrow>{localize("Account and privacy", "Cuenta y privacidad")}</Eyebrow>
        <Display>{t("settings")}</Display>
      </View>
      <Surface>
        <Eyebrow>{localize("Restrictions", "Restricciones")}</Eyebrow>
        <View style={styles.health}>
          <View style={[styles.indicator, health?.engineActive && styles.on]} />
          <View>
            <Text style={styles.title}>{health?.engineActive ? localize("Protection active", "Protección activa") : localize("Needs attention", "Requiere atención")}</Text>
            <Body style={styles.muted}>
              {health?.selectedCount ?? 0} {localize("selected apps", "apps seleccionadas")} · {health?.authorization ?? localize("checking", "comprobando")}
            </Body>
          </View>
        </View>
        <PrimaryButton onPress={chooseApps}>{localize("Choose applications", "Elegir aplicaciones")}</PrimaryButton>
      </Surface>
      <Surface>
        <Eyebrow>{localize("Link account", "Vincular cuenta")}</Eyebrow>
        <Body style={styles.muted}>
          {localize("Your anonymous session keeps the rest of the app private. Link an identity only to vote and recover access.", "Tu sesión anónima mantiene el resto de la app privado. Vincula una identidad solo para votar y recuperar acceso.")}
        </Body>
        <Pressable style={styles.identity} onPress={() => link("apple")}>
          <Text style={styles.identityText}> {localize("Continue with Apple", "Continuar con Apple")}</Text>
        </Pressable>
        <Pressable style={styles.identity} onPress={() => link("google")}>
          <Text style={styles.identityText}>G {localize("Continue with Google", "Continuar con Google")}</Text>
        </Pressable>
      </Surface>
      <Surface>
        <View style={styles.between}>
          <View>
            <Text style={styles.title}>{localize("Product analytics", "Analytics de producto")}</Text>
            <Body style={styles.muted}>{localize("Only general events and counts", "Solo eventos y conteos generales")}</Body>
          </View>
          <Switch value={analyticsEnabled} onValueChange={toggleAnalytics} trackColor={{ true: colors.sage }} />
        </View>
        <Pressable style={styles.textAction} onPress={() => void AdsConsent.showPrivacyOptionsForm()}>
          <Text style={styles.actionLabel}>{localize("Advertising privacy options", "Opciones de privacidad publicitaria")}</Text>
        </Pressable>
      </Surface>
      <Surface style={styles.privacy}>
        <Eyebrow>{localize("Privacy by design", "Privacidad por diseño")}</Eyebrow>
        <Body>
          {localize("Selected apps and detailed history stay on your device. You can export or delete your account data here.", "Las apps seleccionadas y tu historial detallado permanecen en el dispositivo. Puedes exportar o borrar los datos de tu cuenta desde aquí.")}
        </Body>
        <Pressable style={styles.textAction} onPress={exportData}>
          <Text style={styles.actionLabel}>{localize("Export my data", "Exportar mis datos")}</Text>
        </Pressable>
        <Pressable style={styles.textAction} onPress={confirmDeletion}>
          <Text style={styles.dangerLabel}>{localize("Delete account and data", "Eliminar cuenta y datos")}</Text>
        </Pressable>
      </Surface>
    </Screen>
  );
}

const styles = StyleSheet.create({
  health: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: spacing.lg },
  indicator: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.danger },
  on: { backgroundColor: colors.sage },
  title: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink },
  muted: { fontSize: 11, color: colors.muted },
  identity: {
    height: 50,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 99,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  identityText: { fontFamily: fonts.sansMedium },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  privacy: { backgroundColor: "rgba(220,201,179,.22)" },
  textAction: { paddingVertical: spacing.md, marginTop: spacing.sm },
  actionLabel: { fontFamily: fonts.sansMedium, color: colors.forest },
  dangerLabel: { fontFamily: fonts.sansMedium, color: colors.danger },
});

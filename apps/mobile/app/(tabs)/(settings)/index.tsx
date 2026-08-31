import { AdsConsent } from "react-native-google-mobile-ads";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { PrimaryButton } from "@/components/primary-button";
import { FieldApertureMark } from "@/components/field-aperture-mark";
import { Screen } from "@/components/screen";
import { Body, Eyebrow, Heading, Mono } from "@/components/typography";
import { localize } from "@/i18n";
import { setAnalyticsCollectionEnabled } from "@/lib/analytics";
import { apiRequest } from "@/lib/api";
import {
  getLinkedIdentityProviders,
  isIdentityProviderEnabled,
  linkIdentity,
  type IdentityProvider,
} from "@/lib/identity";
import { getJson } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import {
  restrictionEngine,
  type RestrictionHealth,
} from "@/native/restriction-engine";
import { useAppState } from "@/state/app-state";
import { colors, fonts, radius, spacing } from "@/theme/tokens";

function authorizationLabel(
  status: RestrictionHealth["authorization"] | undefined,
) {
  switch (status) {
    case "authorized":
      return localize("Authorized", "Autorizado");
    case "denied":
      return localize("Permission denied", "Permiso denegado");
    case "notDetermined":
      return localize("Not set", "Sin configurar");
    case "unavailable":
      return localize(
        "Unavailable on this device",
        "No disponible en este dispositivo",
      );
    default:
      return localize("Checking", "Comprobando");
  }
}

export default function SettingsScreen() {
  const { clearLocalData, config, health, lastSyncedAt, refresh, syncStatus } =
    useAppState();
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [linkedIdentities, setLinkedIdentities] = useState<IdentityProvider[]>(
    [],
  );
  const [identityBusy, setIdentityBusy] = useState<IdentityProvider | null>(
    null,
  );
  const googleEnabled = isIdentityProviderEnabled("google");

  useEffect(() => {
    void getJson("analyticsEnabled", true).then(setAnalyticsEnabled);
    void getLinkedIdentityProviders()
      .then(setLinkedIdentities)
      .catch(() => setLinkedIdentities([]));
  }, []);

  async function link(provider: IdentityProvider) {
    if (
      !isIdentityProviderEnabled(provider) ||
      linkedIdentities.includes(provider)
    )
      return;
    setIdentityBusy(provider);
    try {
      const linked = await linkIdentity(provider);
      if (linked) {
        setLinkedIdentities(await getLinkedIdentityProviders());
        Alert.alert(
          localize("Account linked", "Cuenta vinculada"),
          localize(
            "You can now participate in voting.",
            "Ya puedes participar en las votaciones.",
          ),
        );
      }
    } catch {
      Alert.alert(
        localize("Could not link", "No se pudo vincular"),
        localize(
          "Check the provider configuration and try again.",
          "Revisa la configuración del proveedor e inténtalo otra vez.",
        ),
      );
    } finally {
      setIdentityBusy(null);
    }
  }

  async function chooseApps() {
    const selection = await restrictionEngine.presentAppPicker();
    await restrictionEngine.applyRestrictions(selection);
    await refresh();
  }

  async function repairOrChooseApps() {
    try {
      const enabled =
        Platform.OS === "ios"
          ? config.iosRestrictionEnabled
          : config.androidRestrictionEnabled;
      if (!enabled) {
        Alert.alert(
          localize(
            "Pauses are temporarily disabled",
            "Las pausas están deshabilitadas temporalmente",
          ),
          localize(
            "Your selection remains on this device and will be available when the service enables pauses again.",
            "Tu selección permanece en este dispositivo y estará disponible cuando el servicio vuelva a habilitar las pausas.",
          ),
        );
        return;
      }
      if (health.authorization !== "authorized") {
        await restrictionEngine.requestAuthorization();
        Alert.alert(
          localize("Finish in Settings", "Termina en Ajustes"),
          localize(
            "Enable Still, then return here. The status refreshes automatically.",
            "Activa Still y vuelve aquí. El estado se actualiza automáticamente.",
          ),
        );
        return;
      }
      if (
        Platform.OS === "android" &&
        health.issue === "usage_access_disabled"
      ) {
        await restrictionEngine.requestWellbeingAuthorization();
        Alert.alert(
          localize("Finish in Settings", "Termina en Ajustes"),
          localize(
            "Allow Usage Access, then return here. The status refreshes automatically.",
            "Permite el acceso de uso y vuelve aquí. El estado se actualiza automáticamente.",
          ),
        );
        return;
      }
      await chooseApps();
    } catch {
      Alert.alert(
        localize(
          "Could not update permissions",
          "No se pudieron actualizar los permisos",
        ),
        localize(
          "Try again from this device's Settings.",
          "Inténtalo otra vez desde los Ajustes del dispositivo.",
        ),
      );
    }
  }

  async function toggleAnalytics(value: boolean) {
    setAnalyticsEnabled(value);
    await setAnalyticsCollectionEnabled(value);
  }

  async function exportData() {
    try {
      const response = await apiRequest("/api/v1/privacy/export", {
        method: "POST",
      });
      const payload = await response.json();
      await Share.share({
        message: JSON.stringify(payload, null, 2),
        title: "Still data export",
      });
    } catch {
      Alert.alert(
        localize("Could not export", "No se pudo exportar"),
        localize(
          "Check your connection and try again.",
          "Revisa tu conexión e inténtalo otra vez.",
        ),
      );
    }
  }

  async function showAdvertisingPrivacyOptions() {
    try {
      await AdsConsent.showPrivacyOptionsForm();
    } catch {
      Alert.alert(
        localize(
          "Privacy options unavailable",
          "Opciones de privacidad no disponibles",
        ),
        localize(
          "Try again when the advertising service is available.",
          "Inténtalo de nuevo cuando el servicio publicitario esté disponible.",
        ),
      );
    }
  }

  function confirmDeletion() {
    Alert.alert(
      localize("Delete account and data", "Eliminar cuenta y datos"),
      localize(
        "This deletes your profile, devices, and wellbeing data. The financial ledger is retained only in pseudonymized form.",
        "Esta acción elimina tu perfil, dispositivos y datos de bienestar. El ledger financiero se conserva solo pseudonimizado.",
      ),
      [
        { text: localize("Cancel", "Cancelar"), style: "cancel" },
        {
          text: localize("Delete permanently", "Eliminar definitivamente"),
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await apiRequest("/api/v1/privacy/delete", { method: "POST" });
                const signOutResult = await supabase?.auth.signOut({
                  scope: "local",
                });
                let cleanupIncomplete = Boolean(signOutResult?.error);
                try {
                  await clearLocalData();
                } catch {
                  cleanupIncomplete = true;
                }
                router.replace("/(onboarding)" as never);
                if (cleanupIncomplete) {
                  Alert.alert(
                    localize("Account deleted", "Cuenta eliminada"),
                    localize(
                      "The server data was deleted, but some local data could not be cleared. Reinstall Still before giving this device to someone else.",
                      "Los datos del servidor se eliminaron, pero algunos datos locales no pudieron borrarse. Reinstala Still antes de entregar este dispositivo a otra persona.",
                    ),
                  );
                }
              } catch {
                Alert.alert(
                  localize("Could not delete", "No se pudo eliminar"),
                  localize(
                    "Your data was not changed. Try again.",
                    "Tus datos no se modificaron. Inténtalo otra vez.",
                  ),
                );
              }
            })();
          },
        },
      ],
    );
  }

  const restrictionsEnabled =
    Platform.OS === "ios"
      ? config.iosRestrictionEnabled
      : config.androidRestrictionEnabled;
  const restrictionHealthy =
    restrictionsEnabled && health.engineActive && !health.issue;
  const restrictionAction = !restrictionsEnabled
    ? localize(
        "Pauses temporarily disabled",
        "Pausas deshabilitadas temporalmente",
      )
    : health.authorization !== "authorized" || health.issue
      ? localize("Repair permissions", "Reparar permisos")
      : localize("Choose other apps", "Elegir otras apps");
  const syncLabel =
    syncStatus === "online"
      ? localize("SYNCED", "SINCRONIZADO")
      : syncStatus === "syncing"
        ? localize("SYNCING", "SINCRONIZANDO")
        : localize("OFFLINE", "SIN CONEXIÓN");

  return (
    <Screen contentContainerStyle={styles.screen}>
      <View style={styles.topline}>
        <FieldApertureMark size={34} />
        <Eyebrow>
          {localize("SETTINGS / DEVICE", "AJUSTES / DISPOSITIVO")}
        </Eyebrow>
      </View>
      <View style={styles.header}>
        <Heading style={styles.pageTitle}>
          {localize(
            "On your device, on your terms.",
            "En tu dispositivo, en tus términos.",
          )}
        </Heading>
        <Body style={styles.lede}>
          {localize(
            "Choose where pauses appear, what leaves this device, and whether to link an identity.",
            "Elige dónde aparecen las pausas, qué sale del dispositivo y si quieres vincular una identidad.",
          )}
        </Body>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <Eyebrow>01 / {localize("PAUSES", "PAUSAS")}</Eyebrow>
          <Mono>
            {health?.selectedCount ?? 0} {localize("APPS", "APPS")}
          </Mono>
        </View>
        <View style={styles.health}>
          <View style={[styles.indicator, restrictionHealthy && styles.on]} />
          <View style={styles.healthCopy}>
            <Heading style={styles.sectionTitle}>
              {restrictionHealthy
                ? localize("Still is active", "Still está activo")
                : !restrictionsEnabled
                  ? localize(
                      "Pauses are temporarily disabled",
                      "Las pausas están deshabilitadas temporalmente",
                    )
                  : localize("Action needed", "Requiere atención")}
            </Heading>
            <Body style={styles.muted}>
              {!restrictionsEnabled
                ? localize(
                    "Your on-device selection is preserved.",
                    "Tu selección en el dispositivo se conserva.",
                  )
                : authorizationLabel(health.authorization)}
            </Body>
          </View>
        </View>
        <PrimaryButton
          disabled={!restrictionsEnabled}
          onPress={repairOrChooseApps}
          variant="secondary"
        >
          {restrictionAction}
        </PrimaryButton>
        <View style={styles.syncRow}>
          <Mono>{syncLabel}</Mono>
          <Body style={styles.muted}>
            {lastSyncedAt
              ? new Intl.DateTimeFormat(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(lastSyncedAt))
              : localize(
                  "No successful sync yet",
                  "Todavía no hubo una sincronización correcta",
                )}
          </Body>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <Eyebrow>02 / {localize("IDENTITY", "IDENTIDAD")}</Eyebrow>
          <Mono>{localize("OPTIONAL", "OPCIONAL")}</Mono>
        </View>
        <Heading style={styles.sectionTitle}>
          {localize(
            "Link only when you need it.",
            "Vincula solo cuando lo necesites.",
          )}
        </Heading>
        <Body style={styles.muted}>
          {localize(
            "Your anonymous session keeps the app private. Link Google only to vote and recover access.",
            "Tu sesión anónima mantiene la app privada. Vincula Google solo para votar y recuperar acceso.",
          )}
        </Body>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{
            disabled:
              !googleEnabled ||
              identityBusy !== null ||
              linkedIdentities.includes("google"),
          }}
          disabled={
            !googleEnabled ||
            identityBusy !== null ||
            linkedIdentities.includes("google")
          }
          style={({ pressed }) => [
            styles.identity,
            pressed && styles.pressed,
            (!googleEnabled || linkedIdentities.includes("google")) &&
              styles.disabled,
          ]}
          onPress={() => link("google")}
        >
          <Text style={styles.identityText}>
            G{" "}
            {linkedIdentities.includes("google")
              ? localize("Google linked", "Google vinculado")
              : !googleEnabled
                ? localize(
                    "Google setup pending",
                    "Configuración de Google pendiente",
                  )
                : identityBusy === "google"
                  ? localize("Opening Google…", "Abriendo Google…")
                  : localize("Continue with Google", "Continuar con Google")}
          </Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <Eyebrow>03 / {localize("DATA", "DATOS")}</Eyebrow>
          <Mono>
            {analyticsEnabled
              ? localize("ON", "ACTIVO")
              : localize("OFF", "INACTIVO")}
          </Mono>
        </View>
        <View style={styles.between}>
          <View style={styles.switchCopy}>
            <Heading style={styles.sectionTitle}>
              {localize("Product analytics", "Analytics de producto")}
            </Heading>
            <Body style={styles.muted}>
              {localize(
                "General events and counts only. Never app names.",
                "Solo eventos y conteos generales. Nunca nombres de apps.",
              )}
            </Body>
          </View>
          <Switch
            value={analyticsEnabled}
            onValueChange={toggleAnalytics}
            trackColor={{ true: colors.mineral, false: colors.fog }}
            thumbColor={colors.chalkRaised}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.textAction,
            pressed && styles.pressed,
          ]}
          onPress={() => void showAdvertisingPrivacyOptions()}
        >
          <Text style={styles.actionLabel}>
            {localize(
              "Advertising privacy options",
              "Opciones de privacidad publicitaria",
            )}
          </Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Eyebrow>
          04 / {localize("PRIVACY BY DESIGN", "PRIVACIDAD POR DISEÑO")}
        </Eyebrow>
        <Heading style={styles.sectionTitle}>
          {localize("The names stay here.", "Los nombres se quedan aquí.")}
        </Heading>
        <Body style={styles.privacyBody}>
          {localize(
            "Selected apps and detailed history stay on your device. Export or delete account data from here.",
            "Las apps elegidas y el historial detallado permanecen en el dispositivo. Exporta o elimina los datos de la cuenta desde aquí.",
          )}
        </Body>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.textAction,
            pressed && styles.pressed,
          ]}
          onPress={exportData}
        >
          <Text style={styles.actionLabel}>
            {localize("Export my data", "Exportar mis datos")}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.textAction,
            pressed && styles.pressed,
          ]}
          onPress={confirmDeletion}
        >
          <Text style={styles.dangerLabel}>
            {localize("Delete account and data", "Eliminar cuenta y datos")}
          </Text>
        </Pressable>
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
  header: { gap: spacing.lg },
  pageTitle: { fontSize: 30, lineHeight: 33 },
  lede: { paddingBottom: spacing.xl, color: colors.graphiteSoft },
  section: {
    paddingVertical: spacing.xl,
    gap: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
  },
  sectionHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: { fontSize: 21, lineHeight: 24 },
  health: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  healthCopy: { flex: 1, gap: spacing.xs },
  syncRow: { gap: spacing.xs },
  indicator: {
    width: 12,
    height: 12,
    borderRadius: radius.xs,
    backgroundColor: colors.danger,
  },
  on: { backgroundColor: colors.success },
  muted: { fontSize: 13, lineHeight: 20, color: colors.graphiteSoft },
  identity: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.graphite,
    borderRadius: radius.control,
    alignItems: "center",
    justifyContent: "center",
  },
  identityText: { fontFamily: fonts.brandSemiBold, color: colors.graphite },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.42 },
  between: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  switchCopy: { flex: 1, paddingRight: spacing.md, gap: spacing.xs },
  privacyBody: { fontSize: 14, lineHeight: 22 },
  textAction: {
    minHeight: 48,
    paddingVertical: spacing.md,
    justifyContent: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
  },
  actionLabel: { fontFamily: fonts.brandSemiBold, color: colors.graphite },
  dangerLabel: { fontFamily: fonts.brandSemiBold, color: colors.danger },
});

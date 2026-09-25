import { AdsConsent } from "react-native-google-mobile-ads";
import { router, useFocusEffect, useIsFocused } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Platform,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { PrimaryButton } from "@/components/primary-button";
import { FieldApertureMark } from "@/components/field-aperture-mark";
import { IdentityButtons } from "@/components/identity-buttons";
import { Breathing, PressableScale } from "@/components/motion";
import { Screen } from "@/components/screen";
import {
  closeAction,
  gotItAction,
  retryAction,
  useStillSheet,
} from "@/components/still-sheet";
import { Body, Eyebrow, Heading, Mono } from "@/components/typography";
import { formatDayAndTime, localize } from "@/i18n";
import { setAnalyticsCollectionEnabled } from "@/lib/analytics";
import { apiRequest } from "@/lib/api";
import {
  getLinkedIdentityProviders,
  identityProviderName,
  identityProviders,
  isIdentityProviderEnabled,
  linkIdentity,
  type IdentityProvider,
} from "@/lib/identity";
import { isPauseFeatureEnabled } from "@/lib/restriction-mode";
import { activeTargets } from "@/lib/shortcut-targets";
import { getJson } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { type RestrictionHealth } from "@/native/restriction-engine";
import { useAppState } from "@/state/app-state";
import { useShortcutTargets } from "@/state/shortcut-targets";
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
      return localize("Still isn't on yet", "Falta activar Still");
    case "unavailable":
      return localize(
        "Unavailable on this phone",
        "No disponible en este teléfono",
      );
    default:
      return localize("Checking", "Comprobando");
  }
}

export default function SettingsScreen() {
  const {
    clearLocalData,
    config,
    health,
    lastSyncedAt,
    refresh,
    syncStatus,
  } = useAppState();
  const shortcutTargets = useShortcutTargets();
  const sheet = useStillSheet();
  const focused = useIsFocused();
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [linkedIdentities, setLinkedIdentities] = useState<IdentityProvider[]>(
    [],
  );
  const [identityBusy, setIdentityBusy] = useState<IdentityProvider | null>(
    null,
  );
  const accountLinked = linkedIdentities.length > 0;
  const offersApple = identityProviders().includes("apple");

  useEffect(() => {
    void getJson("analyticsEnabled", true).then(setAnalyticsEnabled);
  }, []);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void getLinkedIdentityProviders()
        .then((providers) => {
          if (active) setLinkedIdentities(providers);
        })
        .catch(() => {
          if (active) setLinkedIdentities([]);
        });
      return () => {
        active = false;
      };
    }, []),
  );
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
        showConnected(provider);
      }
    } catch (error) {
      try {
        const providers = await getLinkedIdentityProviders();
        if (providers.includes(provider)) {
          setLinkedIdentities(providers);
          showConnected(provider);
          return;
        }
      } catch {
        // Preserve the original OAuth error below when reconciliation fails.
      }
      if (__DEV__) console.warn(`${provider} identity link failed`, error);
      const name = identityProviderName(provider);
      void sheet.show({
        title: localize(`${name} didn't connect`, `No se conectó ${name}`),
        message: localize(
          "Check your connection and try again.",
          "Revisa tu conexión y vuelve a intentarlo.",
        ),
        actions: [retryAction(() => link(provider)), closeAction()],
      });
    } finally {
      setIdentityBusy(null);
    }
  }

  function showConnected(provider: IdentityProvider) {
    const name = identityProviderName(provider);
    void sheet.show({
      title: localize(`${name} connected`, `${name} conectado`),
      message: localize(
        "You can now vote for this week's project.",
        "Ya puedes votar por el proyecto de esta semana.",
      ),
      actions: [
        {
          label: localize("Go vote", "Ir a votar"),
          variant: "signal",
          onPress: () => router.push("/(tabs)/(impact)" as never),
        },
        { label: localize("Done", "Listo"), variant: "quiet" },
      ],
    });
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
      void sheet.show({
        title: localize(
          "Your data wasn't downloaded",
          "No se descargaron tus datos",
        ),
        message: localize("Check your connection.", "Revisa tu conexión."),
        actions: [retryAction(() => exportData()), closeAction()],
      });
    }
  }

  async function showAdvertisingPrivacyOptions() {
    try {
      await AdsConsent.showPrivacyOptionsForm();
    } catch {
      void sheet.show({
        title: localize(
          "The ad options didn't load",
          "Las opciones de anuncios no cargaron",
        ),
        message: localize(
          "Try again in a moment.",
          "Vuelve a intentarlo en un momento.",
        ),
        actions: [
          retryAction(() => showAdvertisingPrivacyOptions()),
          closeAction(),
        ],
      });
    }
  }

  async function deleteAccount() {
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
        void sheet.show({
          title: localize("Account deleted", "Cuenta eliminada"),
          message: localize(
            "To also erase what is saved on this phone, uninstall Still.",
            "Para borrar también lo guardado en este teléfono, desinstala Still.",
          ),
          actions: [gotItAction()],
        });
      }
    } catch {
      void sheet.show({
        title: localize(
          "Your account wasn't deleted",
          "No se eliminó tu cuenta",
        ),
        message: localize(
          "Your data is as it was.",
          "Tus datos siguen como estaban.",
        ),
        actions: [retryAction(() => deleteAccount()), closeAction()],
      });
    }
  }

  function confirmDeletion() {
    void sheet.show({
      title: localize("Delete your account?", "¿Eliminar tu cuenta?"),
      message: localize(
        "Your account and your history are erased. The donation record is kept without anything that identifies you. This is permanent.",
        "Se borran tu cuenta y tu historial. El registro de donaciones se conserva sin datos que te identifiquen. Es definitivo.",
      ),
      actions: [
        {
          label: localize("Delete permanently", "Eliminar definitivamente"),
          variant: "danger",
          onPress: () => deleteAccount(),
        },
        { label: localize("Cancel", "Cancelar"), variant: "quiet" },
      ],
    });
  }

  const restrictionsEnabled = isPauseFeatureEnabled(Platform.OS, config);
  const shortcutMode = Platform.OS === "ios";
  // iOS cannot report whether an automation exists; an app counts as
  // connected once its automation has fired at least once.
  const chosenApps = activeTargets(shortcutTargets.targets);
  const connectedApps = chosenApps.filter(
    (target) => shortcutTargets.health[target.id]?.verifiedAt,
  );
  const restrictionHealthy = shortcutMode
    ? restrictionsEnabled &&
      chosenApps.length > 0 &&
      connectedApps.length === chosenApps.length
    : restrictionsEnabled &&
      health.engineActive &&
      !health.issue &&
      health.serviceRunning !== false;
  const restrictionAction = shortcutMode
    ? chosenApps.length === 0
      ? localize("Choose apps", "Elegir apps")
      : localize("Apps with a pause", "Apps con pausa")
    : !restrictionsEnabled
      ? localize("Pauses are coming back soon", "Las pausas vuelven pronto")
      : health.authorization !== "authorized"
        ? localize("Turn on Still", "Activar Still")
        : health.selectedCount === 0
          ? localize("Choose apps", "Elegir apps")
          : localize("Review apps and permission", "Revisar apps y permiso");
  const syncLabel =
    syncStatus === "online"
      ? localize("UP TO DATE", "ACTUALIZADO")
      : syncStatus === "syncing"
        ? localize("UPDATING", "ACTUALIZANDO")
        : localize("OFFLINE", "SIN CONEXIÓN");
  const syncDetail =
    syncStatus === "offline"
      ? localize(
          "Your pauses keep working.",
          "Tus pausas siguen funcionando.",
        )
      : lastSyncedAt
        ? formatDayAndTime(new Date(lastSyncedAt))
        : localize("Updating…", "Actualizando…");
  return (
    <Screen contentContainerStyle={styles.screen}>
      <View style={styles.topline}>
        <FieldApertureMark size={34} />
        <Eyebrow>{localize("SETTINGS", "AJUSTES")}</Eyebrow>
      </View>
      <View style={styles.header}>
        <Heading style={styles.pageTitle}>
          {localize("Your pauses, your way.", "Tus pausas, a tu manera.")}
        </Heading>
        <Body style={styles.lede}>
          {localize(
            "Your apps, your pauses and your account.",
            "Tus apps, tus pausas y tu cuenta.",
          )}
        </Body>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <Eyebrow>01 / {localize("PAUSES", "PAUSAS")}</Eyebrow>
          <Mono>
            {shortcutMode
              ? `${connectedApps.length}/${chosenApps.length} ${localize("APPS", "APPS")}`
              : `${health?.selectedCount ?? 0} ${localize("APPS", "APPS")}`}
          </Mono>
        </View>
        <View style={styles.health}>
          {/* A pause that is on breathes, slowly; one that needs work holds still.
              Tabs stay mounted, so it only breathes while Settings is shown. */}
          <Breathing
            active={restrictionHealthy && focused}
            opacityTo={0.4}
            period={1_600}
            scaleTo={1}
            style={[styles.indicator, restrictionHealthy && styles.on]}
          />
          <View style={styles.healthCopy}>
            <Heading style={styles.sectionTitle}>
              {restrictionHealthy
                ? shortcutMode
                  ? localize(
                      `The pause is on in your ${chosenApps.length} ${chosenApps.length === 1 ? "app" : "apps"}`,
                      `La pausa está activa en ${chosenApps.length === 1 ? "tu app" : `tus ${chosenApps.length} apps`}`,
                    )
                  : localize("Still is on", "Still está activo")
                : !restrictionsEnabled
                  ? localize(
                      "Pauses are coming back soon",
                      "Las pausas vuelven pronto",
                    )
                  : shortcutMode && chosenApps.length === 0
                    ? localize("Choose your apps", "Elige tus apps")
                    : shortcutMode && connectedApps.length === 0
                      ? localize(
                          "Connect Shortcuts",
                          "Falta conectar Atajos",
                        )
                      : shortcutMode
                        ? localize(
                            `${connectedApps.length} of ${chosenApps.length} apps connected`,
                            `${connectedApps.length} de ${chosenApps.length} apps conectadas`,
                          )
                        : health.authorization !== "authorized"
                          ? localize("Turn on Still", "Falta activar Still")
                          : health.selectedCount === 0
                            ? localize("Choose your apps", "Elige tus apps")
                            : localize(
                                "Check your setup",
                                "Revisa la configuración",
                              )}
            </Heading>
            <Body style={styles.muted}>
              {!restrictionsEnabled
                ? localize(
                    "Your chosen apps are kept.",
                    "Tus apps elegidas se conservan.",
                  )
                : shortcutMode
                  ? restrictionHealthy
                    ? localize(
                        "Your apps stay on this iPhone.",
                        "Tus apps se quedan en este iPhone.",
                      )
                    : chosenApps.length === 0
                      ? localize(
                          "Choose the apps where you want a pause.",
                          "Elige las apps donde quieres una pausa.",
                        )
                      : localize(
                          "Test each app to connect it.",
                          "Prueba cada app para conectarla.",
                        )
                  : authorizationLabel(health.authorization)}
            </Body>
          </View>
        </View>
        <PrimaryButton
          disabled={!restrictionsEnabled}
          onPress={() =>
            shortcutMode
              ? router.push("/ios-apps")
              : // Something missing: the verified setup; all set: the apps.
                router.push(restrictionHealthy ? "/android-setup" : "/setup")
          }
          variant="secondary"
        >
          {restrictionAction}
        </PrimaryButton>
        {shortcutMode && chosenApps.length > 0 ? (
          <PrimaryButton
            disabled={!restrictionsEnabled}
            onPress={() => router.push("/shortcut-setup")}
            variant="quiet"
          >
            {restrictionHealthy
              ? localize("Shortcuts setup", "Configuración de Atajos")
              : connectedApps.length === 0
                ? localize("Connect Shortcuts", "Conectar Atajos")
                : localize("Finish connecting", "Terminar de conectar")}
          </PrimaryButton>
        ) : null}
        <View style={styles.syncRow}>
          <Mono>{syncLabel}</Mono>
          <Body style={styles.muted}>{syncDetail}</Body>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <Eyebrow>02 / {localize("ACCOUNT", "CUENTA")}</Eyebrow>
          <Mono>{localize("OPTIONAL", "OPCIONAL")}</Mono>
        </View>
        <Heading style={styles.sectionTitle}>
          {offersApple
            ? localize("Connect an account to vote", "Conecta una cuenta para votar")
            : localize("Connect Google to vote", "Conecta Google para votar")}
        </Heading>
        <Body style={styles.muted}>
          {localize(
            "And to get your account back if you change phones.",
            "Y para recuperar tu cuenta si cambias de teléfono.",
          )}
        </Body>
        <IdentityButtons
          busy={identityBusy}
          linked={linkedIdentities}
          onLink={(provider) => void link(provider)}
        />
        {accountLinked ? (
          <Body style={styles.identityConfirmation}>
            {localize(
              "Voting is enabled. Open Impact to choose and see your vote.",
              "Ya puedes votar. Abre Impacto para elegir y ver tu voto.",
            )}
          </Body>
        ) : null}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <Eyebrow>03 / {localize("IMPROVE STILL", "MEJORAR STILL")}</Eyebrow>
          <Mono>
            {analyticsEnabled
              ? localize("ON", "ACTIVO")
              : localize("OFF", "INACTIVO")}
          </Mono>
        </View>
        <View style={styles.between}>
          <View style={styles.switchCopy}>
            <Heading style={styles.sectionTitle}>
              {localize("Help improve Still", "Ayudar a mejorar Still")}
            </Heading>
            <Body style={styles.muted}>
              {localize(
                "Share general counts. Your app names stay on your phone.",
                "Comparte conteos generales. Los nombres de tus apps se quedan en el teléfono.",
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
        <PressableScale
          accessibilityRole="button"
          dimTo={0.6}
          scaleTo={1}
          style={styles.textAction}
          onPress={() => void showAdvertisingPrivacyOptions()}
        >
          <Text style={styles.actionLabel}>
            {localize("Ad privacy", "Privacidad de los anuncios")}
          </Text>
        </PressableScale>
      </View>

      <View style={styles.section}>
        <Eyebrow>04 / {localize("YOUR DATA", "TUS DATOS")}</Eyebrow>
        <Heading style={styles.sectionTitle}>
          {localize(
            "Your data, whenever you want it.",
            "Tus datos, cuando los quieras.",
          )}
        </Heading>
        <Body style={styles.privacyBody}>
          {localize(
            "Download a copy or delete your account.",
            "Descarga una copia o elimina tu cuenta.",
          )}
        </Body>
        <PressableScale
          accessibilityRole="button"
          dimTo={0.6}
          scaleTo={1}
          style={styles.textAction}
          onPress={exportData}
        >
          <Text style={styles.actionLabel}>
            {localize("Download my data", "Descargar mis datos")}
          </Text>
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          dimTo={0.6}
          scaleTo={1}
          style={styles.textAction}
          onPress={confirmDeletion}
        >
          <Text style={styles.dangerLabel}>
            {localize("Delete account and data", "Eliminar cuenta y datos")}
          </Text>
        </PressableScale>
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
  identityConfirmation: {
    color: colors.success,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
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

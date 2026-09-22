import { AdsConsent } from "react-native-google-mobile-ads";
import { type UpdateUserPreferencesRequest } from "@screen-time/contracts";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
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
import {
  closeAction,
  gotItAction,
  retryAction,
  useStillSheet,
} from "@/components/still-sheet";
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

function Stepper({
  label,
  value,
  minimum,
  maximum,
  onChange,
}: {
  label: string;
  value: number;
  minimum: number;
  maximum: number;
  onChange(value: number): void;
}) {
  return (
    <View style={styles.stepperRow}>
      <Body style={styles.stepperLabel}>{label}</Body>
      <View style={styles.stepper}>
        <Pressable
          accessibilityLabel={localize(`Reduce ${label}`, `Reducir ${label}`)}
          accessibilityRole="button"
          accessibilityState={{ disabled: value <= minimum }}
          disabled={value <= minimum}
          onPress={() => onChange(Math.max(minimum, value - 1))}
          style={({ pressed }) => [
            styles.stepperButton,
            pressed && styles.pressed,
            value <= minimum && styles.disabled,
          ]}
        >
          <Text style={styles.stepperButtonLabel}>−</Text>
        </Pressable>
        <Text accessibilityLiveRegion="polite" style={styles.stepperValue}>
          {value}
        </Text>
        <Pressable
          accessibilityLabel={localize(
            `Increase ${label}`,
            `Aumentar ${label}`,
          )}
          accessibilityRole="button"
          accessibilityState={{ disabled: value >= maximum }}
          disabled={value >= maximum}
          onPress={() => onChange(Math.min(maximum, value + 1))}
          style={({ pressed }) => [
            styles.stepperButton,
            pressed && styles.pressed,
            value >= maximum && styles.disabled,
          ]}
        >
          <Text style={styles.stepperButtonLabel}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const {
    clearLocalData,
    config,
    health,
    lastSyncedAt,
    preferences,
    refresh,
    savePreferences,
    syncStatus,
  } = useAppState();
  const shortcutTargets = useShortcutTargets();
  const sheet = useStillSheet();
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [linkedIdentities, setLinkedIdentities] = useState<IdentityProvider[]>(
    [],
  );
  const [identityBusy, setIdentityBusy] = useState<IdentityProvider | null>(
    null,
  );
  const [preferencesBusy, setPreferencesBusy] = useState(false);
  const [draftPreferences, setDraftPreferences] =
    useState<UpdateUserPreferencesRequest>({
      dailyPassLimit: preferences.dailyPassLimit,
      unlockDurationSeconds: preferences.unlockDurationSeconds,
      maxRewardedAdsPerUtcDay: preferences.maxRewardedAdsPerUtcDay,
    });
  const googleEnabled = isIdentityProviderEnabled("google");

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
  useEffect(() => {
    setDraftPreferences({
      dailyPassLimit: preferences.dailyPassLimit,
      unlockDurationSeconds: preferences.unlockDurationSeconds,
      maxRewardedAdsPerUtcDay: preferences.maxRewardedAdsPerUtcDay,
    });
  }, [preferences]);

  async function persistPreferences() {
    setPreferencesBusy(true);
    try {
      await savePreferences(draftPreferences);
      sheet.toast({ message: localize("Limits saved.", "Límites guardados.") });
    } catch {
      void sheet.show({
        title: localize(
          "Your limits weren't saved",
          "No se guardaron tus límites",
        ),
        message: localize("Check your connection.", "Revisa tu conexión."),
        actions: [retryAction(() => persistPreferences()), closeAction()],
      });
    } finally {
      setPreferencesBusy(false);
    }
  }

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
        showGoogleConnected();
      }
    } catch (error) {
      try {
        const providers = await getLinkedIdentityProviders();
        if (providers.includes(provider)) {
          setLinkedIdentities(providers);
          showGoogleConnected();
          return;
        }
      } catch {
        // Preserve the original OAuth error below when reconciliation fails.
      }
      if (__DEV__) console.warn("Google identity link failed", error);
      void sheet.show({
        title: localize("Google didn't connect", "No se conectó Google"),
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

  function showGoogleConnected() {
    void sheet.show({
      title: localize("Google connected", "Google conectado"),
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
        "Your account, your passes and your history are erased. The donation record is kept without anything that identifies you. This is permanent.",
        "Se borran tu cuenta, tus pases y tu historial. El registro de donaciones se conserva sin datos que te identifiquen. Es definitivo.",
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
    : restrictionsEnabled && health.engineActive && !health.issue;
  const restrictionAction = shortcutMode
    ? chosenApps.length === 0
      ? localize("Choose apps", "Elegir apps")
      : localize("Apps with a pause", "Apps con pausa")
    : !restrictionsEnabled
      ? localize(
          "Pauses temporarily disabled",
          "Pausas deshabilitadas temporalmente",
        )
      : health.authorization !== "authorized" || health.selectedCount === 0
        ? localize("Set up Android", "Configurar Android")
        : localize("Review Android setup", "Revisar configuración Android");
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
            {shortcutMode
              ? `${connectedApps.length}/${chosenApps.length} ${localize("APPS", "APPS")}`
              : `${health?.selectedCount ?? 0} ${localize("APPS", "APPS")}`}
          </Mono>
        </View>
        <View style={styles.health}>
          <View style={[styles.indicator, restrictionHealthy && styles.on]} />
          <View style={styles.healthCopy}>
            <Heading style={styles.sectionTitle}>
              {restrictionHealthy
                ? shortcutMode
                  ? localize(
                      "Shortcut mode is active",
                      "El modo Atajos está activo",
                    )
                  : localize("Still is active", "Still está activo")
                : !restrictionsEnabled
                  ? localize(
                      "Pauses are temporarily disabled",
                      "Las pausas están deshabilitadas temporalmente",
                    )
                  : shortcutMode && chosenApps.length === 0
                    ? localize("Choose your apps", "Elige tus apps")
                    : shortcutMode && connectedApps.length === 0
                      ? localize(
                          "Shortcuts is not connected yet",
                          "Atajos todavía no está conectado",
                        )
                      : shortcutMode
                        ? localize(
                            `${connectedApps.length} of ${chosenApps.length} apps connected`,
                            `${connectedApps.length} de ${chosenApps.length} apps conectadas`,
                          )
                        : localize("Action needed", "Requiere atención")}
            </Heading>
            <Body style={styles.muted}>
              {!restrictionsEnabled
                ? localize(
                    "Your on-device selection is preserved.",
                    "Tu selección en el dispositivo se conserva.",
                  )
                : shortcutMode
                  ? restrictionHealthy
                    ? localize(
                        "Your apps and automations stay private on this iPhone.",
                        "Tus apps y automatizaciones permanecen privadas en este iPhone.",
                      )
                    : localize(
                        "An app is connected once you test it from the Shortcuts setup.",
                        "Una app queda conectada cuando la pruebas desde la configuración de Atajos.",
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
              : router.push("/android-setup")
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
          <Eyebrow>02 / {localize("PASS LIMITS", "LÍMITES DE PASES")}</Eyebrow>
          <Mono>{localize("PER DAY", "POR DÍA")}</Mono>
        </View>
        <Heading style={styles.sectionTitle}>
          {localize("Choose your guardrails.", "Elige tus límites.")}
        </Heading>
        <Body style={styles.muted}>
          {localize(
            "Passes reset at midnight UTC. Emergency access remains separate.",
            "Los pases se reinician a medianoche UTC. Los accesos de emergencia se mantienen separados.",
          )}
        </Body>
        <Stepper
          label={localize("Daily passes", "Pases diarios")}
          value={draftPreferences.dailyPassLimit}
          minimum={1}
          maximum={20}
          onChange={(dailyPassLimit) =>
            setDraftPreferences((current) => ({
              ...current,
              dailyPassLimit,
            }))
          }
        />
        <Body style={styles.muted}>
          {localize(
            "How long each pass keeps an app open is chosen when you use it, not here: anything from 1 minute to the rest of the day.",
            "Cuánto tiempo mantiene abierta una app cada pase se elige al usarlo, no aquí: desde 1 minuto hasta el resto del día.",
          )}
        </Body>
        <Stepper
          label={localize("Maximum ads", "Máximo de anuncios")}
          value={draftPreferences.maxRewardedAdsPerUtcDay}
          minimum={0}
          maximum={config.maxRewardedAdsPerUtcDay}
          onChange={(maxRewardedAdsPerUtcDay) =>
            setDraftPreferences((current) => ({
              ...current,
              maxRewardedAdsPerUtcDay,
            }))
          }
        />
        <PrimaryButton
          disabled={preferencesBusy || syncStatus === "offline"}
          onPress={() => void persistPreferences()}
          variant="secondary"
        >
          {preferencesBusy
            ? localize("Saving…", "Guardando…")
            : localize("Save pass limits", "Guardar límites de pases")}
        </PrimaryButton>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <Eyebrow>03 / {localize("IDENTITY", "IDENTIDAD")}</Eyebrow>
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
            linkedIdentities.includes("google") && styles.identityLinked,
            pressed && styles.pressed,
            !googleEnabled && styles.disabled,
          ]}
          onPress={() => link("google")}
        >
          <Text style={styles.identityText}>
            {linkedIdentities.includes("google")
              ? localize("✓  Google connected", "✓  Google conectado")
              : !googleEnabled
                ? localize(
                    "G  Google setup pending",
                    "G  Configuración de Google pendiente",
                  )
                : identityBusy === "google"
                  ? localize("G  Opening Google…", "G  Abriendo Google…")
                  : localize(
                      "G  Continue with Google",
                      "G  Continuar con Google",
                    )}
          </Text>
        </Pressable>
        {linkedIdentities.includes("google") ? (
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
          <Eyebrow>04 / {localize("DATA", "DATOS")}</Eyebrow>
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
          05 / {localize("PRIVACY BY DESIGN", "PRIVACIDAD POR DISEÑO")}
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
  identityLinked: {
    borderColor: colors.success,
    backgroundColor: colors.chalkRaised,
  },
  identityConfirmation: {
    color: colors.success,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.42 },
  between: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  switchCopy: { flex: 1, paddingRight: spacing.md, gap: spacing.xs },
  stepperRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  stepperLabel: {
    flex: 1,
    color: colors.graphite,
    fontFamily: fonts.brandSemiBold,
    fontSize: 14,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.fog,
    borderRadius: radius.control,
    overflow: "hidden",
  },
  stepperButton: {
    width: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.chalkRaised,
  },
  stepperButtonLabel: {
    color: colors.graphite,
    fontFamily: fonts.brandMedium,
    fontSize: 22,
  },
  stepperValue: {
    minWidth: 42,
    color: colors.graphite,
    fontFamily: fonts.mono,
    fontSize: 15,
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
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

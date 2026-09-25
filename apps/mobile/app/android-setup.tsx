import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";

import { FieldApertureMark } from "@/components/field-aperture-mark";
import { EXAMPLE_APP } from "@/components/guide/app-icons";
import { ANDROID_SCREENS } from "@/components/guide/android-settings-screens";
import { GuideCard } from "@/components/guide/guide-card";
import {
  DISCLOSURE_ACCEPTED_KEY,
  confirmAccessibilityDisclosure,
  permissionGuide,
  q,
} from "@/components/setup/android-accessibility";
import { PrimaryButton } from "@/components/primary-button";
import { Screen } from "@/components/screen";
import {
  closeAction,
  notNowAction,
  retryAction,
  useStillSheet,
} from "@/components/still-sheet";
import { Body, Eyebrow, Heading, Mono } from "@/components/typography";
import { androidSys, localize } from "@/i18n";
import { isPauseFeatureEnabled } from "@/lib/restriction-mode";
import { setJson } from "@/lib/storage";
import {
  restrictionEngine,
  type InstallEnvironment,
  type RestrictionHealth,
  type SelectedAppState,
} from "@/native/restriction-engine";
import { useAppState } from "@/state/app-state";
import { colors, spacing } from "@/theme/tokens";

// One step = one action, quoting Android's own labels (docs/ui-clarity-plan.md §4.5).
const steps = [
  {
    title: localize("Turn on Still", "Activa Still"),
    body: localize(
      `Find Still in the list, turn it on and tap ${q(androidSys("allow"))}.`,
      `Busca Still en la lista, actívalo y toca ${q(androidSys("allow"))}.`,
    ),
  },
  {
    title: localize("Choose your apps", "Elige tus apps"),
    body: localize(
      `Check the apps where you want a pause, for example ${EXAMPLE_APP.name}.`,
      `Marca las apps donde quieres una pausa, por ejemplo ${EXAMPLE_APP.name}.`,
    ),
  },
  {
    title: localize("Done", "Listo"),
    body: localize(
      "When you open one of those apps, Still asks whether you want to go in and for how long.",
      "Cuando abras una de esas apps, Still te pregunta si quieres entrar y por cuánto tiempo.",
    ),
  },
] as const;

function formatLastPause(iso: string | undefined, locale: "en" | "es"): string {
  if (!iso) return locale === "es" ? "sin pausa aún" : "no pause yet";
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return locale === "es" ? "sin pausa aún" : "no pause yet";
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (minutes < 1) return locale === "es" ? "última pausa: ahora" : "last pause: just now";
  if (minutes < 60) {
    return locale === "es"
      ? `última pausa: hace ${minutes} min`
      : `last pause: ${minutes} min ago`;
  }
  const hours = Math.round(minutes / 60);
  return locale === "es"
    ? `última pausa: hace ${hours} h`
    : `last pause: ${hours} h ago`;
}

export default function AndroidSetupScreen() {
  const { config, health, refresh } = useAppState();
  const sheet = useStillSheet();
  const [localHealth, setLocalHealth] = useState<RestrictionHealth>(health);
  const [appsState, setAppsState] = useState<SelectedAppState[]>([]);
  const [restrictedSettings, setRestrictedSettings] = useState(false);
  const [setupBusy, setSetupBusy] = useState(false);
  const restrictionsEnabled = isPauseFeatureEnabled("android", config);
  const ready =
    restrictionsEnabled &&
    localHealth.authorization === "authorized" &&
    localHealth.selectedCount > 0;

  const refreshHealth = useCallback(async () => {
    const next = await restrictionEngine.getHealth().catch(() => null);
    if (next) setLocalHealth(next);
    const apps = await restrictionEngine.getSelectedAppsState?.().catch(() => []);
    if (apps) setAppsState(apps);
    const env: InstallEnvironment | undefined = await restrictionEngine
      .getInstallEnvironment?.()
      .catch(() => undefined);
    if (env) setRestrictedSettings(env.likelyRestricted);
  }, []);

  useEffect(() => setLocalHealth(health), [health]);
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === "android") void refreshHealth();
    }, [refreshHealth]),
  );

  function showSetupFailed() {
    void sheet.show({
      title: localize("We couldn't finish", "No pudimos terminar"),
      message: localize(
        "Your chosen apps are still saved.",
        "Tus apps elegidas siguen guardadas.",
      ),
      actions: [retryAction(() => runRequiredSetup()), closeAction()],
    });
  }

  function showStillInactive() {
    void sheet.show({
      title: localize("Still isn't on yet", "Falta activar Still"),
      message: localize(
        "In Accessibility, tap Still and turn on “Use Still”. Then come back here.",
        "En Accesibilidad, toca Still y activa «Usar Still». Después vuelve aquí.",
      ),
      actions: [
        {
          label: localize("Open Accessibility", "Abrir Accesibilidad"),
          variant: "signal",
          onPress: () => {
            void restrictionEngine.openAccessibilitySettings?.();
          },
        },
        ...(restrictedSettings
          ? [
              {
                label: localize("Open Still's app info", "Abrir información de Still"),
                variant: "secondary" as const,
                onPress: () => {
                  void restrictionEngine.openAppInfo?.();
                },
              },
            ]
          : []),
        notNowAction(),
      ],
    });
  }

  async function chooseApps() {
    setSetupBusy(true);
    try {
      const selection = await restrictionEngine.presentAppPicker();
      if (selection.count > 0) {
        await restrictionEngine.applyRestrictions(selection);
      }
      await refreshHealth();
      void refresh();
      if (selection.count === 0) {
        void sheet.show({
          title: localize("Choose your apps", "Elige tus apps"),
          message: localize(
            "Check the apps where you want to see the pause.",
            "Marca las apps donde quieres ver la pausa.",
          ),
          actions: [
            {
              label: localize("Choose apps", "Elegir apps"),
              variant: "signal",
              onPress: () => chooseApps(),
            },
            notNowAction(),
          ],
        });
      }
    } catch {
      showSetupFailed();
    } finally {
      setSetupBusy(false);
    }
  }

  async function runRequiredSetup() {
    if (Platform.OS !== "android") {
      router.replace("/shortcut-setup");
      return;
    }
    let authorization = localHealth.authorization;
    if (authorization !== "authorized") {
      const consented = await confirmAccessibilityDisclosure(sheet);
      if (!consented) return;
      await setJson(DISCLOSURE_ACCEPTED_KEY, new Date().toISOString());
      setSetupBusy(true);
      try {
        authorization = await restrictionEngine.requestAuthorization();
      } catch {
        showSetupFailed();
        return;
      } finally {
        setSetupBusy(false);
      }
    }
    if (authorization !== "authorized") {
      await refreshHealth();
      showStillInactive();
      return;
    }
    await chooseApps();
  }

  const requiredAction =
    localHealth.authorization !== "authorized"
      ? localize(
          "Activate Still and choose apps",
          "Activar Still y elegir apps",
        )
      : localHealth.selectedCount === 0
        ? localize("Choose apps", "Elegir apps")
        : localize("Change selected apps", "Cambiar apps elegidas");

  return (
    <Screen contentContainerStyle={styles.screen}>
      <View style={styles.topline}>
        <FieldApertureMark size={34} />
        <Eyebrow>{localize("GET STARTED", "EMPEZAR")}</Eyebrow>
      </View>

      <View style={styles.header}>
        <Heading style={styles.title}>
          {localize("Turn on the pause in a minute.", "Activa la pausa en un minuto.")}
        </Heading>
        <Body style={styles.lede}>
          {localize(
            "Tap the button and follow the steps. Still brings you back when you're done.",
            "Toca el botón y sigue los pasos. Still te trae de vuelta al terminar.",
          )}
        </Body>
      </View>

      <View style={styles.status}>
        <View style={styles.statusRow}>
          <Mono>STILL</Mono>
          <Mono>
            {localHealth.authorization === "authorized"
              ? localize("ON", "ACTIVO")
              : localize("NOT ON YET", "FALTA ACTIVAR")}
          </Mono>
        </View>
        <View style={styles.statusRow}>
          <Mono>{localize("YOUR APPS", "TUS APPS")}</Mono>
          <Mono>{localHealth.selectedCount}</Mono>
        </View>
      </View>

      <PrimaryButton
        disabled={!restrictionsEnabled || setupBusy}
        onPress={() => void runRequiredSetup()}
        variant={ready ? "secondary" : "signal"}
      >
        {setupBusy
          ? localize("One moment…", "Un momento…")
          : requiredAction}
      </PrimaryButton>

      <View style={styles.steps}>
        {steps.map((step, index) => (
          <View key={step.title} style={styles.step}>
            <Mono>{String(index + 1).padStart(2, "0")}</Mono>
            <View style={styles.stepCopy}>
              <Heading style={styles.stepTitle}>{step.title}</Heading>
              <Body style={styles.stepBody}>{step.body}</Body>
              {index === 0 ? (
                <View style={styles.guide}>
                  {permissionGuide.map((frame) => {
                    const Drawn = ANDROID_SCREENS[frame.id];
                    return (
                      <GuideCard
                        key={frame.id}
                        accessibilityLabel={frame.label}
                        actionLabel={frame.caption}
                        onPress={() => void runRequiredSetup()}
                      >
                        <Drawn />
                      </GuideCard>
                    );
                  })}
                  {restrictedSettings &&
                  localHealth.authorization !== "authorized" ? (
                    <View style={styles.restricted}>
                      <Body style={styles.restrictedNote}>
                        {localize(
                          `Is the switch greyed out? In Still's app info, open the ⋮ menu and tap ${q(androidSys("allowRestrictedSettings"))}.`,
                          `¿El interruptor está gris? En la información de Still, abre el menú ⋮ y toca ${q(androidSys("allowRestrictedSettings"))}.`,
                        )}
                      </Body>
                      <PrimaryButton
                        onPress={() => void restrictionEngine.openAppInfo?.()}
                        variant="secondary"
                      >
                        {localize("Open Still's app info", "Abrir información de Still")}
                      </PrimaryButton>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>
        ))}
      </View>

      {appsState.length > 0 ? (
        <View style={styles.appsState}>
          <Eyebrow>{localize("YOUR APPS TODAY", "TUS APPS HOY")}</Eyebrow>
          {appsState.map((app) => (
            <View key={app.packageName} style={styles.appStateRow}>
              <Body style={styles.appStateName}>{app.label}</Body>
              <Body style={styles.appStateDetail}>
                {localize(
                  `${app.avoidedOpensToday} avoided · ${formatLastPause(app.lastPauseAt, "en")}`,
                  `${app.avoidedOpensToday} evitadas · ${formatLastPause(app.lastPauseAt, "es")}`,
                )}
              </Body>
            </View>
          ))}
        </View>
      ) : null}

      <PrimaryButton
        disabled={!ready}
        onPress={() => {
          void refresh();
          router.replace("/(tabs)/(settings)");
        }}
        variant="quiet"
      >
        {ready
          ? localize("Done", "Listo")
          : localize(
              "Complete required setup first",
              "Completa primero lo requerido",
            )}
      </PrimaryButton>

      <PrimaryButton
        variant="quiet"
        onPress={() => router.push("/android-repair")}
      >
        {localize("Not seeing the pause?", "¿No aparece la pausa?")}
      </PrimaryButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { minHeight: 760, gap: spacing.xl },
  topline: {
    minHeight: 58,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  header: { gap: spacing.lg },
  title: { fontSize: 30, lineHeight: 33 },
  lede: { color: colors.graphiteSoft },
  status: {
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.chalkRaised,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  steps: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.fog },
  guide: { gap: spacing.md, marginTop: spacing.sm },
  appsState: {
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.chalkRaised,
  },
  appStateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  restricted: { gap: spacing.sm },
  restrictedNote: { color: colors.graphiteSoft, fontSize: 13, lineHeight: 19 },
  appStateName: { fontSize: 15 },
  appStateDetail: { color: colors.graphiteSoft, fontSize: 13 },
  step: {
    paddingVertical: spacing.lg,
    flexDirection: "row",
    gap: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
  },
  stepCopy: { flex: 1, gap: spacing.sm },
  stepTitle: { fontSize: 18, lineHeight: 22 },
  stepBody: { color: colors.graphiteSoft, fontSize: 14, lineHeight: 21 },
});

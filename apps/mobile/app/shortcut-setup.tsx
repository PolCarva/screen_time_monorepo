import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FieldApertureMark } from "@/components/field-aperture-mark";
import { EXAMPLE_APP, FAKE_APP } from "@/components/guide/app-icons";
import { ShortcutConnectList } from "@/components/ios/shortcut-connect-list";
import { ShortcutGuide, useOpenShortcuts } from "@/components/ios/shortcut-guide";
import { PressableScale } from "@/components/motion";
import { PrimaryButton } from "@/components/primary-button";
import { Screen } from "@/components/screen";
import { useStillSheet } from "@/components/still-sheet";
import { Body, Eyebrow, Heading, Mono } from "@/components/typography";
import { localize } from "@/i18n";
import {
  type SetupTier,
  IOS_SHORTCUT_IMPORT_URL,
  SHORTCUTS_CREATE_AUTOMATION_URL,
  guideSteps,
  hasReadyActions,
  resolveSetupTier,
} from "@/lib/ios-shortcut-setup";
import { isPauseFeatureEnabled } from "@/lib/restriction-mode";
import { activeTargets, returnShortcutName } from "@/lib/shortcut-targets";
import { type ShortcutTarget } from "@/lib/shortcut-targets";
import { useAppState } from "@/state/app-state";
import { useShortcutTargets } from "@/state/shortcut-targets";
import { colors, fonts, spacing } from "@/theme/tokens";

function tierLede(tier: SetupTier) {
  switch (tier) {
    case "import":
      return localize(
        "One shortcut, added with a tap. Shortcuts tells Still when you open one of your apps.",
        "Un solo atajo, añadido con un toque. Atajos avisa a Still cuando abres una de tus apps.",
      );
    case "per_app":
      return localize(
        "One automation per app, with Still's action ready made: nothing to type or pick inside it. About 30 seconds each.",
        "Una automatización por app, con la acción de Still ya lista: no hay que escribir ni elegir nada dentro. Unos 30 segundos cada una.",
      );
  }
}

export default function ShortcutSetupScreen() {
  const { tested, onboarding } = useLocalSearchParams<{
    tested?: string;
    onboarding?: string;
  }>();
  const { targets, health } = useShortcutTargets();
  const { config } = useAppState();
  const sheet = useStillSheet();
  const insets = useSafeAreaInsets();
  const open = useOpenShortcuts();
  const pausesEnabled = isPauseFeatureEnabled(Platform.OS, config);
  const [footerHeight, setFooterHeight] = useState(160);

  const chosen = activeTargets(targets);
  const schemeless = chosen.filter((target) => !target.urlScheme);
  const tier = resolveSetupTier({ iosVersion: Platform.Version });
  const readyActions = hasReadyActions(Platform.Version);
  const allSteps = guideSteps(tier, { needsReturnShortcut: schemeless.length > 0 });
  // The custom-app steps (Tilo) get their own section after the guide.
  const steps = allSteps.filter((step) => !step.id.startsWith("return_"));
  const returnSteps = allSteps.filter((step) => step.id.startsWith("return_"));

  // The guide names the next app still to connect.
  const pending = chosen.filter((target) => !health[target.id]?.verifiedAt);
  const next = pending[0] ?? chosen[0];
  const appName = next?.name ?? EXAMPLE_APP.name;
  // Open while nothing is connected; afterwards the steps are known and fold away.
  const [showSteps, setShowSteps] = useState<boolean | null>(null);
  const stepsOpen = showSteps ?? pending.length === chosen.length;

  async function copyShortcutName(target: ShortcutTarget) {
    await Clipboard.setStringAsync(returnShortcutName(target.name));
    sheet.toast({
      message: localize("Name copied.", "Nombre copiado."),
      tone: "success",
    });
  }

  return (
    <View style={styles.root}>
      <Screen contentContainerStyle={[styles.screen, { paddingBottom: footerHeight + spacing.xl }]}>
        <View style={styles.topline}>
          <FieldApertureMark size={34} />
          <Eyebrow>{localize("SHORTCUTS", "ATAJOS")}</Eyebrow>
        </View>

        <View style={styles.header}>
          <Heading style={styles.title}>
            {localize("Connect your apps.", "Conecta tus apps.")}
          </Heading>
          <Body style={styles.lede}>{tierLede(tier)}</Body>
        </View>

        {pausesEnabled ? null : (
          <View accessibilityLiveRegion="polite" style={styles.note}>
            <Eyebrow>{localize("PAUSED", "EN PAUSA")}</Eyebrow>
            <Body style={styles.small}>
              {localize(
                "Pauses on iPhone are coming back soon. You can get the automations ready now.",
                "Las pausas en iPhone vuelven pronto. Puedes dejar listas las automatizaciones.",
              )}
            </Body>
          </View>
        )}

        {tested ? (
          <View accessibilityLiveRegion="polite" style={styles.banner}>
            <Eyebrow style={styles.bannerLabel}>
              {localize("CONNECTED", "CONECTADA")}
            </Eyebrow>
            <Body style={styles.bannerBody}>
              {localize(
                `${tested} now pauses in Still before it opens.`,
                `${tested} ahora hace una pausa en Still antes de abrirse.`,
              )}
            </Body>
          </View>
        ) : null}

        {chosen.length === 0 ? (
          <View style={styles.note}>
            <Eyebrow>{localize("FIRST", "PRIMERO")}</Eyebrow>
            <Body style={styles.small}>
              {localize(
                "Choose the apps you want Still to pause.",
                "Elige las apps que quieres que Still pause.",
              )}
            </Body>
            <PrimaryButton onPress={() => router.push("/ios-apps")} variant="signal">
              {localize("Choose apps", "Elegir apps")}
            </PrimaryButton>
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <ShortcutConnectList pausesEnabled={pausesEnabled} />
              <PressableScale
                accessibilityRole="button"
                dimTo={0.62}
                onPress={() =>
                  router.push({
                    pathname: "/ios-apps",
                    params: { from: "setup", ...(onboarding ? { onboarding } : {}) },
                  })
                }
                scaleTo={1}
                style={styles.linkRow}
              >
                <Body style={styles.linkLabel}>
                  {localize("Add or remove apps", "Añadir o quitar apps")}
                </Body>
                <Mono>→</Mono>
              </PressableScale>
            </View>

            <View style={styles.section}>
              <PressableScale
                accessibilityRole="button"
                accessibilityState={{ expanded: stepsOpen }}
                dimTo={0.62}
                onPress={() => setShowSteps(!stepsOpen)}
                scaleTo={1}
                style={styles.guideHeading}
              >
                <View style={styles.guideTitle}>
                  <Heading style={styles.sectionTitle}>
                    {pending.length === 0
                      ? localize("How to connect an app", "Cómo conectar una app")
                      : localize(`How to connect ${appName}`, `Cómo conectar ${appName}`)}
                  </Heading>
                  <Body style={styles.small}>
                    {localize(
                      `${steps.length} taps in Shortcuts, the same for every app. Come back with “◀ Still” at the top left.`,
                      `${steps.length} toques en Atajos, iguales para cada app. Vuelve con «◀ Still», arriba a la izquierda.`,
                    )}
                  </Body>
                </View>
                <Body style={styles.linkLabel}>
                  {stepsOpen
                    ? localize("Hide", "Ocultar")
                    : localize("Show steps", "Ver pasos")}
                </Body>
              </PressableScale>
              {stepsOpen ? (
                <ShortcutGuide
                  app={appName}
                  appNames={chosen.map((target) => target.name)}
                  readyActions={readyActions}
                  steps={steps}
                />
              ) : null}
            </View>

            {returnSteps.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionIntro}>
                  <Heading style={styles.sectionTitle}>
                    {localize(
                      "So Still can open your other apps",
                      "Para que Still abra tus otras apps",
                    )}
                  </Heading>
                  <Body style={styles.small}>
                    {localize(
                      `Optional. Some apps need a shortcut so Still can open them after the ad; without it you open them from the Home Screen. Follow the example with ${FAKE_APP.name} and repeat it for each app in the list.`,
                      `Opcional. Algunas apps necesitan un atajo para que Still las abra después del anuncio; sin él, las abres desde la pantalla de inicio. Mira el ejemplo con ${FAKE_APP.name} y repítelo con cada app de la lista.`,
                    )}
                  </Body>
                </View>
                <ShortcutGuide
                  app={FAKE_APP.name}
                  appNames={chosen.map((target) => target.name)}
                  readyActions={readyActions}
                  steps={returnSteps}
                />
                <Eyebrow>{localize("YOUR APPS", "TUS APPS")}</Eyebrow>
                {schemeless.map((target) => (
                  <View key={target.id} style={styles.copyRow}>
                    <View style={styles.copyText}>
                      <Body style={styles.copyName}>{target.name}</Body>
                      <Mono>{returnShortcutName(target.name)}</Mono>
                    </View>
                    <PrimaryButton
                      accessibilityLabel={localize(
                        `Copy “${returnShortcutName(target.name)}”`,
                        `Copiar «${returnShortcutName(target.name)}»`,
                      )}
                      onPress={() => void copyShortcutName(target)}
                      variant="secondary"
                    >
                      {localize("Copy", "Copiar")}
                    </PrimaryButton>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}

        <View style={styles.note}>
          <Eyebrow>{localize("GOOD TO KNOW", "CONVIENE SABER")}</Eyebrow>
          <Body style={styles.small}>
            {localize(
              "You'll see the app for an instant before the pause: that's normal. After restarting your iPhone, the pause takes about two minutes to come back.",
              "Verás la app un instante antes que la pausa: es normal. Después de reiniciar el iPhone, la pausa tarda unos dos minutos en volver.",
            )}
          </Body>
        </View>

        <PrimaryButton onPress={() => router.push("/shortcut-repair")} variant="quiet">
          {localize("The pause doesn't show up", "¿No aparece la pausa?")}
        </PrimaryButton>
      </Screen>

      {/* Always in reach: the way into Shortcuts and the way out. */}
      <View
        onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
        style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
      >
        {tier === "import" ? (
          <PrimaryButton onPress={() => void open(IOS_SHORTCUT_IMPORT_URL)} variant="signal">
            {localize("Add to Shortcuts", "Añadir a Atajos")}
          </PrimaryButton>
        ) : chosen.length > 0 && pending.length > 0 ? (
          <PrimaryButton
            onPress={() => void open(SHORTCUTS_CREATE_AUTOMATION_URL)}
            variant="signal"
          >
            {localize(`Connect ${appName} in Shortcuts`, `Conectar ${appName} en Atajos`)}
          </PrimaryButton>
        ) : null}
        <PrimaryButton
          onPress={() =>
            router.replace(onboarding ? "/(tabs)/(today)" : "/(tabs)/(settings)")
          }
          variant="quiet"
        >
          {localize("Done", "Listo")}
        </PrimaryButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  screen: { gap: spacing.xl },
  topline: {
    minHeight: 58,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  header: { gap: spacing.lg },
  title: { fontSize: 30, lineHeight: 33 },
  lede: { color: colors.graphiteSoft },
  banner: {
    padding: spacing.lg,
    gap: spacing.xs,
    backgroundColor: colors.graphite,
  },
  bannerLabel: { color: colors.mineralLight },
  bannerBody: { color: colors.chalk },
  section: { gap: spacing.md },
  sectionIntro: { gap: spacing.sm },
  sectionTitle: { fontSize: 20, lineHeight: 24 },
  small: { color: colors.graphiteSoft, fontSize: 14, lineHeight: 21 },
  linkRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  linkLabel: { fontFamily: fonts.brandSemiBold, fontSize: 15 },
  guideHeading: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  guideTitle: { flex: 1, gap: spacing.xs },
  copyRow: {
    minHeight: 64,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
  },
  copyText: { flex: 1, gap: 2 },
  copyName: { fontSize: 16 },
  note: {
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.chalkRaised,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
    backgroundColor: colors.paper,
  },
});

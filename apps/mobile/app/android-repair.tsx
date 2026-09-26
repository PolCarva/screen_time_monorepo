import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";

import { FieldApertureMark } from "@/components/field-aperture-mark";
import { PrimaryButton } from "@/components/primary-button";
import { Screen } from "@/components/screen";
import {
  keepAliveAction,
  reopenAccessibility,
  useOpenKeepAlive,
} from "@/components/setup/android-settings";
import { NumberedLine } from "@/components/setup/setup-bits";
import { Body, Eyebrow, Heading } from "@/components/typography";
import { androidSys, localize } from "@/i18n";
import {
  AUTOSTART_NEEDED,
  needsAutostart,
  oemGuidance,
  tipsToShow,
  type AutostartState,
  type KeepAliveTarget,
  type OemTip,
} from "@/lib/android-oem";
import {
  restrictionEngine,
  type InstallEnvironment,
} from "@/native/restriction-engine";
import { colors, spacing } from "@/theme/tokens";

const DEFAULT_ENV: InstallEnvironment = {
  sdkInt: 0,
  packageSource: -1,
  likelyRestricted: false,
  manufacturer: "",
};

/**
 * Probable reasons the pause is not showing, most likely first, each with a link
 * to the exact system screen. Product voice: Still is the subject and the copy
 * leads with what to do, not with the platform mechanism.
 */
export default function AndroidRepairScreen() {
  const openKeepAlive = useOpenKeepAlive();
  const [authorized, setAuthorized] = useState(true);
  const [stopped, setStopped] = useState(false);
  const [autostart, setAutostart] = useState<AutostartState | undefined>();
  const [env, setEnv] = useState<InstallEnvironment>(DEFAULT_ENV);

  const load = useCallback(async () => {
    if (Platform.OS !== "android") return;
    const health = await restrictionEngine.getHealth().catch(() => null);
    if (health) {
      setAuthorized(health.authorization === "authorized");
      // On in Settings but not running: the phone closed Still (§13).
      setStopped(health.authorization === "authorized" && health.serviceRunning === false);
      setAutostart(health.autostart);
    }
    const environment = await restrictionEngine.getInstallEnvironment?.().catch(
      () => DEFAULT_ENV,
    );
    if (environment) setEnv(environment);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const oem = oemGuidance(env.manufacturer);

  return (
    <Screen contentContainerStyle={styles.screen}>
      <View style={styles.topline}>
        <FieldApertureMark size={34} />
        <Eyebrow>{localize("FIX THE PAUSE", "ARREGLAR LA PAUSA")}</Eyebrow>
      </View>

      <View style={styles.header}>
        <Heading style={styles.title}>
          {localize("Not seeing the pause?", "¿No aparece la pausa?")}
        </Heading>
        <Body style={styles.lede}>
          {localize(
            "Try these in order. The most common reason is first.",
            "Prueba esto en orden. La causa más común va primero.",
          )}
        </Body>
      </View>

      {stopped ? (
        <Cause
          title={localize("Turn Still off and on again", "Apaga y vuelve a encender Still")}
          body={
            oem.name
              ? localize(
                  `Its switch is on, but your phone closed Still. ${oem.name} phones do it when Still is closed from Recents. Turn it off and on again in Accessibility, then follow the step below so it doesn't happen again.`,
                  `Su interruptor está activado, pero tu teléfono cerró Still. Los ${oem.name} lo hacen al cerrar Still desde Recientes. Apágalo y vuelve a encenderlo en Accesibilidad, y sigue el paso de abajo para que no vuelva a pasar.`,
                )
              : localize(
                  "Its switch is on, but your phone closed Still. Turn it off and on again in Accessibility.",
                  "Su interruptor está activado, pero tu teléfono cerró Still. Apágalo y vuelve a encenderlo en Accesibilidad.",
                )
          }
          action={localize("Open Accessibility", "Abrir Accesibilidad")}
          onPress={() => void reopenAccessibility()}
        />
      ) : null}

      {needsAutostart(autostart) ? (
        <Cause
          title={localize(AUTOSTART_NEEDED.title.en, AUTOSTART_NEEDED.title.es)}
          body={localize(AUTOSTART_NEEDED.body.en, AUTOSTART_NEEDED.body.es)}
          action={localize(AUTOSTART_NEEDED.action.en, AUTOSTART_NEEDED.action.es)}
          onPress={() => void openKeepAlive(AUTOSTART_NEEDED.opens)}
        />
      ) : null}

      {!authorized ? (
        <Cause
          title={localize("Turn Still back on", "Vuelve a activar Still")}
          body={localize(
            "Still needs its permission to step in. Switch it on, then come back.",
            "Still necesita su permiso para aparecer. Actívalo y vuelve.",
          )}
          action={localize("Open Accessibility", "Abrir Accesibilidad")}
          onPress={() => void reopenAccessibility()}
        />
      ) : null}

      {env.likelyRestricted ? (
        <Cause
          title={localize("Unlock the switch first", "Desbloquea el interruptor")}
          body={localize(
            `If the switch is greyed out: in Still's ${androidSys("appInfo")}, open the ⋮ menu and tap “${androidSys("allowRestrictedSettings")}”. Then turn Still on.`,
            `Si el interruptor está gris: en ${androidSys("appInfo")} de Still, abre el menú ⋮ y toca «${androidSys("allowRestrictedSettings")}». Después activa Still.`,
          )}
          action={localize("Open app info", "Abrir información de la app")}
          onPress={() => void restrictionEngine.openAppInfo?.()}
        />
      ) : null}

      <Cause
        title={localize(
          "Keep Still awake in the background",
          "Mantén a Still despierto en segundo plano",
        )}
        body={
          oem.name
            ? localize(
                `On ${oem.name} phones, a few settings keep Still from being closed:`,
                `En los ${oem.name}, unos ajustes evitan que Still se cierre:`,
              )
            : localize(
                "If the pause is late or missing, allow Still to run freely:",
                "Si la pausa llega tarde o no aparece, deja que Still funcione con libertad:",
              )
        }
        tips={tipsToShow(oem.tips, autostart)}
        onTip={(target) => void openKeepAlive(target)}
      />

      <PrimaryButton variant="quiet" onPress={() => router.back()}>
        {localize("Done", "Listo")}
      </PrimaryButton>
    </Screen>
  );
}

/** One reason, and a way to the setting that fixes it: its button, or each tip. */
function Cause({
  title,
  body,
  tips,
  onTip,
  action,
  onPress,
}: {
  title: string;
  body: string;
  tips?: OemTip[];
  onTip?: (target: KeepAliveTarget) => void;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.cause}>
      <Heading style={styles.causeTitle}>{title}</Heading>
      <Body style={styles.causeBody}>{body}</Body>
      {tips?.length ? (
        <View style={styles.tips}>
          {tips.map((tip, index) => (
            <NumberedLine
              action={keepAliveAction(tip.opens)}
              index={index + 1}
              key={tip.en}
              onPress={onTip ? () => onTip(tip.opens) : undefined}
            >
              {localize(tip.en, tip.es)}
            </NumberedLine>
          ))}
        </View>
      ) : null}
      {action && onPress ? (
        <PrimaryButton variant="secondary" onPress={onPress}>
          {action}
        </PrimaryButton>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { minHeight: 760, gap: spacing.lg },
  topline: {
    minHeight: 58,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  header: { gap: spacing.sm },
  title: { fontSize: 28, lineHeight: 31 },
  lede: { color: colors.graphiteSoft },
  cause: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.chalkRaised,
  },
  causeTitle: { fontSize: 18, lineHeight: 22 },
  causeBody: { color: colors.graphiteSoft, fontSize: 14, lineHeight: 21 },
  tips: { gap: spacing.xs },
});

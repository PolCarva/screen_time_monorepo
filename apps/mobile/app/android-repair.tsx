import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";

import { FieldApertureMark } from "@/components/field-aperture-mark";
import { PrimaryButton } from "@/components/primary-button";
import { Screen } from "@/components/screen";
import { Body, Eyebrow, Heading } from "@/components/typography";
import { androidSys, localize } from "@/i18n";
import { oemGuidance } from "@/lib/android-oem";
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
  const [authorized, setAuthorized] = useState(true);
  const [env, setEnv] = useState<InstallEnvironment>(DEFAULT_ENV);

  const load = useCallback(async () => {
    if (Platform.OS !== "android") return;
    const health = await restrictionEngine.getHealth().catch(() => null);
    if (health) setAuthorized(health.authorization === "authorized");
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

      {!authorized ? (
        <Cause
          title={localize("Turn Still back on", "Vuelve a activar Still")}
          body={localize(
            "Still needs its permission to step in. Switch it on, then come back.",
            "Still necesita su permiso para aparecer. Actívalo y vuelve.",
          )}
          action={localize("Open settings", "Abrir ajustes")}
          onPress={() => void restrictionEngine.openAccessibilitySettings?.()}
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
        tips={oem.tips.map((tip) => localize(tip.en, tip.es))}
        action={localize("Open app info", "Abrir información de la app")}
        onPress={() => void restrictionEngine.openAppInfo?.()}
      />

      <PrimaryButton variant="quiet" onPress={() => router.back()}>
        {localize("Done", "Listo")}
      </PrimaryButton>
    </Screen>
  );
}

function Cause({
  title,
  body,
  tips,
  action,
  onPress,
}: {
  title: string;
  body: string;
  tips?: string[];
  action: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.cause}>
      <Heading style={styles.causeTitle}>{title}</Heading>
      <Body style={styles.causeBody}>{body}</Body>
      {tips?.length ? (
        <View style={styles.tips}>
          {tips.map((tip) => (
            <Body key={tip} style={styles.tip}>
              {`•  ${tip}`}
            </Body>
          ))}
        </View>
      ) : null}
      <PrimaryButton variant="secondary" onPress={onPress}>
        {action}
      </PrimaryButton>
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
  tip: { color: colors.graphite, fontSize: 14, lineHeight: 21 },
});

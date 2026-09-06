import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Platform, StyleSheet, View } from "react-native";

import {
  AndroidSetupVisual,
  type AndroidSetupVisualVariant,
} from "@/components/android-setup-visual";
import { FieldApertureMark } from "@/components/field-aperture-mark";
import { PrimaryButton } from "@/components/primary-button";
import { Screen } from "@/components/screen";
import { Body, Eyebrow, Heading, Mono } from "@/components/typography";
import { localize } from "@/i18n";
import { isPauseFeatureEnabled } from "@/lib/restriction-mode";
import {
  restrictionEngine,
  type RestrictionHealth,
} from "@/native/restriction-engine";
import { useAppState } from "@/state/app-state";
import { colors, spacing } from "@/theme/tokens";

const steps = [
  {
    visual: "accessibility" satisfies AndroidSetupVisualVariant,
    visualLabel: localize(
      "Image showing Still switched on in Android Accessibility settings.",
      "Imagen que muestra Still activado en los ajustes de Accesibilidad de Android.",
    ),
    title: localize("Enable Still once", "Activa Still una vez"),
    body: localize(
      "Android asks for Accessibility permission so Still can notice only when a selected app opens and place the pause in front.",
      "Android pide permiso de Accesibilidad para que Still detecte únicamente cuándo se abre una app elegida y ponga la pausa delante.",
    ),
  },
  {
    visual: "apps" satisfies AndroidSetupVisualVariant,
    visualLabel: localize(
      "Image showing YouTube and Instagram selected in Still's private Android app picker.",
      "Imagen que muestra YouTube e Instagram seleccionadas en el selector privado de apps de Still para Android.",
    ),
    title: localize("Choose the apps", "Elige las apps"),
    body: localize(
      "Pick them in Still. The package names and per-app activity remain on this device.",
      "Elígelas en Still. Los identificadores y la actividad por app permanecen en este dispositivo.",
    ),
  },
  {
    visual: "return" satisfies AndroidSetupVisualVariant,
    visualLabel: localize(
      "Diagram showing YouTube opening, Still pausing for an ad, and Android returning directly to YouTube.",
      "Diagrama que muestra cómo se abre YouTube, Still hace una pausa con anuncio y Android vuelve directamente a YouTube.",
    ),
    title: localize("Android returns for you", "Android vuelve por ti"),
    body: localize(
      "Open an app, choose Watch ad or use a pass, and Still reopens that exact app for the configured time. No Shortcut or browser is involved.",
      "Abre una app, elige Ver anuncio o usa un pase, y Still reabre esa app exacta durante el tiempo configurado. No intervienen Atajos ni el navegador.",
    ),
  },
] as const;

function confirmAccessibilityDisclosure(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      localize("Accessibility access", "Acceso de Accesibilidad"),
      localize(
        "Still uses Android Accessibility to detect the identifier of the app that enters the foreground, only so it can show a pause for apps you choose. It cannot read screen content or type for you. Selected app identifiers and per-app counters stay on this device and are not collected or shared. You can turn this access off at any time in Android Settings.",
        "Still usa la Accesibilidad de Android para detectar el identificador de la app que entra en primer plano, únicamente para mostrar una pausa en las apps que tú eliges. No puede leer el contenido de la pantalla ni escribir por ti. Los identificadores elegidos y los contadores por app permanecen en este dispositivo y no se recopilan ni comparten. Puedes desactivar este acceso en cualquier momento desde los Ajustes de Android.",
      ),
      [
        {
          text: localize("Not now", "Ahora no"),
          style: "cancel",
          onPress: () => resolve(false),
        },
        {
          text: localize("I agree and continue", "Aceptar y continuar"),
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export default function AndroidSetupScreen() {
  const { config, health, refresh } = useAppState();
  const [localHealth, setLocalHealth] = useState<RestrictionHealth>(health);
  const [setupBusy, setSetupBusy] = useState(false);
  const [statsBusy, setStatsBusy] = useState(false);
  const restrictionsEnabled = isPauseFeatureEnabled("android", config);
  const ready =
    restrictionsEnabled &&
    localHealth.authorization === "authorized" &&
    localHealth.selectedCount > 0;
  const statsEnabled = localHealth.wellbeingAuthorization === "authorized";

  const refreshHealth = useCallback(async () => {
    const next = await restrictionEngine.getHealth().catch(() => null);
    if (next) setLocalHealth(next);
  }, []);

  useEffect(() => setLocalHealth(health), [health]);
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === "android") void refreshHealth();
    }, [refreshHealth]),
  );

  async function runRequiredSetup() {
    if (Platform.OS !== "android") {
      router.replace("/shortcut-setup");
      return;
    }
    setSetupBusy(true);
    try {
      let authorization = localHealth.authorization;
      if (authorization !== "authorized") {
        const consented = await confirmAccessibilityDisclosure();
        if (!consented) return;
        authorization = await restrictionEngine.requestAuthorization();
      }
      if (authorization !== "authorized") {
        Alert.alert(
          localize("Still is not active yet", "Still todavía no está activo"),
          localize(
            "In Accessibility, open Still, switch it on, then return. Android will continue setup automatically.",
            "En Accesibilidad, abre Still, actívalo y vuelve. Android continuará la configuración automáticamente.",
          ),
        );
        await refreshHealth();
        return;
      }

      const selection = await restrictionEngine.presentAppPicker();
      if (selection.count > 0) {
        await restrictionEngine.applyRestrictions(selection);
      }
      await refreshHealth();
      void refresh();
      if (selection.count === 0) {
        Alert.alert(
          localize("Choose at least one app", "Elige al menos una app"),
          localize(
            "Nothing is paused until you select an app.",
            "No se mostrará ninguna pausa hasta que selecciones una app.",
          ),
        );
      }
    } catch {
      Alert.alert(
        localize("Could not finish setup", "No se pudo terminar"),
        localize(
          "No selection was lost. Try the setup button again.",
          "No se perdió ninguna selección. Prueba otra vez el botón de configuración.",
        ),
      );
    } finally {
      setSetupBusy(false);
    }
  }

  async function enableRealStats() {
    setStatsBusy(true);
    try {
      const status = await restrictionEngine.requestWellbeingAuthorization();
      await refreshHealth();
      if (status !== "authorized") {
        Alert.alert(
          localize(
            "Real stats remain off",
            "Las estadísticas reales siguen apagadas",
          ),
          localize(
            "This is optional. Pauses and per-app opening counts still work without Usage Access.",
            "Esto es opcional. Las pausas y los conteos de aperturas por app siguen funcionando sin Acceso al uso.",
          ),
        );
      } else {
        void refresh();
      }
    } catch {
      Alert.alert(
        localize(
          "Could not open Usage Access",
          "No se pudo abrir Acceso al uso",
        ),
        localize(
          "You can enable it later from Android Settings.",
          "Puedes activarlo más tarde desde los Ajustes de Android.",
        ),
      );
    } finally {
      setStatsBusy(false);
    }
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
        <Eyebrow>
          {localize("ANDROID / SETUP", "ANDROID / CONFIGURACIÓN")}
        </Eyebrow>
      </View>

      <View style={styles.header}>
        <Heading style={styles.title}>
          {localize(
            "Two steps once. Then Android does the rest.",
            "Dos pasos una vez. Luego Android hace el resto.",
          )}
        </Heading>
        <Body style={styles.lede}>
          {localize(
            "The main button opens the right Android screen, waits for you to return, and continues to app selection automatically.",
            "El botón principal abre la pantalla correcta de Android, espera a que vuelvas y continúa automáticamente con la selección de apps.",
          )}
        </Body>
      </View>

      <View style={styles.status}>
        <View style={styles.statusRow}>
          <Mono>{localize("ACCESSIBILITY", "ACCESIBILIDAD")}</Mono>
          <Mono>
            {localHealth.authorization === "authorized"
              ? localize("READY", "LISTO")
              : localize("REQUIRED", "REQUERIDO")}
          </Mono>
        </View>
        <View style={styles.statusRow}>
          <Mono>{localize("SELECTED APPS", "APPS ELEGIDAS")}</Mono>
          <Mono>{localHealth.selectedCount}</Mono>
        </View>
      </View>

      <PrimaryButton
        disabled={!restrictionsEnabled || setupBusy}
        onPress={() => void runRequiredSetup()}
        variant={ready ? "secondary" : "signal"}
      >
        {setupBusy
          ? localize("Waiting for Android…", "Esperando a Android…")
          : requiredAction}
      </PrimaryButton>

      <View style={styles.steps}>
        {steps.map((step, index) => (
          <View key={step.title} style={styles.step}>
            <Mono>{String(index + 1).padStart(2, "0")}</Mono>
            <View style={styles.stepCopy}>
              <Heading style={styles.stepTitle}>{step.title}</Heading>
              <Body style={styles.stepBody}>{step.body}</Body>
              <AndroidSetupVisual
                accessibilityLabel={step.visualLabel}
                variant={step.visual}
              />
            </View>
          </View>
        ))}
      </View>

      <View style={styles.optional}>
        <View style={styles.statusRow}>
          <Eyebrow>
            {localize("OPTIONAL / REAL TIME", "OPCIONAL / TIEMPO REAL")}
          </Eyebrow>
          <Mono>
            {statsEnabled
              ? localize("ON", "ACTIVO")
              : localize("OFF", "APAGADO")}
          </Mono>
        </View>
        <Body style={styles.stepBody}>
          {localize(
            "Usage Access adds Android's real foreground-time totals. It is not required for pauses, ads, returns, or individual opening counts.",
            "Acceso al uso añade los totales reales de tiempo en primer plano de Android. No es necesario para las pausas, anuncios, retornos ni conteos individuales de aperturas.",
          )}
        </Body>
        {!statsEnabled ? (
          <PrimaryButton
            disabled={statsBusy}
            onPress={() => void enableRealStats()}
            variant="quiet"
          >
            {statsBusy
              ? localize("Waiting for Android…", "Esperando a Android…")
              : localize(
                  "Enable real screen-time stats",
                  "Activar estadísticas reales",
                )}
          </PrimaryButton>
        ) : null}
      </View>

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
  optional: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.chalkRaised,
  },
});

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
      "Image showing Still switched on, with the toggle to turn it on circled.",
      "Imagen que muestra Still activado, con el interruptor para activarlo rodeado.",
    ),
    title: localize("Give Still permission", "Dale permiso a Still"),
    body: localize(
      "One permission lets Still step in with a calm pause before the apps you choose.",
      "Un permiso deja que Still aparezca con una pausa serena antes de las apps que elijas.",
    ),
  },
  {
    visual: "apps" satisfies AndroidSetupVisualVariant,
    visualLabel: localize(
      "Image showing YouTube and Instagram chosen in Still's private app list.",
      "Imagen que muestra YouTube e Instagram elegidas en la lista privada de apps de Still.",
    ),
    title: localize("Choose your apps", "Elige tus apps"),
    body: localize(
      "Pick the ones that pull you in. Your choice stays on this phone, only yours.",
      "Elige las que te absorben. Tu elección se queda en este teléfono, solo tuya.",
    ),
  },
  {
    visual: "return" satisfies AndroidSetupVisualVariant,
    visualLabel: localize(
      "Image showing an app opening, Still pausing for an ad, and the app opening right after.",
      "Imagen que muestra una app abriéndose, Still con una pausa y anuncio, y la app abriéndose justo después.",
    ),
    title: localize("You're back in a tap", "Vuelves en un toque"),
    body: localize(
      "Open an app, watch a short ad or use a pass, and Still opens it for the time you chose.",
      "Abre una app, mira un anuncio corto o usa un pase, y Still la abre por el tiempo que elijas.",
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
            "Find Still in the list, switch it on, then come back. Still takes it from there.",
            "Busca Still en la lista, actívalo y vuelve. Still sigue desde ahí.",
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
            "It is optional. Pauses and your per-app counts work without it.",
            "Es opcional. Las pausas y tus conteos por app funcionan sin esto.",
          ),
        );
      } else {
        void refresh();
      }
    } catch {
      Alert.alert(
        localize(
          "Couldn't open that screen",
          "No se pudo abrir esa pantalla",
        ),
        localize(
          "You can turn it on later from Settings.",
          "Puedes activarlo más tarde desde Ajustes.",
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
        <Eyebrow>{localize("GET STARTED", "EMPEZAR")}</Eyebrow>
      </View>

      <View style={styles.header}>
        <Heading style={styles.title}>
          {localize(
            "A moment of setup, then Still takes it from here.",
            "Un momento de setup y Still se encarga del resto.",
          )}
        </Heading>
        <Body style={styles.lede}>
          {localize(
            "Tap once. Still walks you through it and brings you right back.",
            "Toca una vez. Still te guía y te trae de vuelta enseguida.",
          )}
        </Body>
      </View>

      <View style={styles.status}>
        <View style={styles.statusRow}>
          <Mono>{localize("PERMISSION", "PERMISO")}</Mono>
          <Mono>
            {localHealth.authorization === "authorized"
              ? localize("READY", "LISTO")
              : localize("NEEDED", "FALTA")}
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
            {localize("OPTIONAL", "OPCIONAL")}
          </Eyebrow>
          <Mono>
            {statsEnabled
              ? localize("ON", "ACTIVO")
              : localize("OFF", "APAGADO")}
          </Mono>
        </View>
        <Body style={styles.stepBody}>
          {localize(
            "See your real screen-time totals next to Still's own counts. Everything else works without it.",
            "Mira tus totales reales de tiempo de pantalla junto a los conteos de Still. Todo lo demás funciona sin esto.",
          )}
        </Body>
        {!statsEnabled ? (
          <PrimaryButton
            disabled={statsBusy}
            onPress={() => void enableRealStats()}
            variant="quiet"
          >
            {statsBusy
              ? localize("One moment…", "Un momento…")
              : localize(
                  "Show my real screen time",
                  "Mostrar mi tiempo real",
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

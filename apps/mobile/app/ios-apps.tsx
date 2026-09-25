import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FieldApertureMark } from "@/components/field-aperture-mark";
import { IosAppPicker } from "@/components/ios/ios-app-picker";
import { PrimaryButton } from "@/components/primary-button";
import { Screen } from "@/components/screen";
import { Body, Eyebrow, Heading } from "@/components/typography";
import { localize } from "@/i18n";
import { activeTargets } from "@/lib/shortcut-targets";
import { useShortcutTargets } from "@/state/shortcut-targets";
import { colors, spacing } from "@/theme/tokens";

export default function IosAppsScreen() {
  const { onboarding, from } = useLocalSearchParams<{
    onboarding?: string;
    /** Opened from the setup screen: continuing goes back to it. */
    from?: string;
  }>();
  const { targets } = useShortcutTargets();
  const insets = useSafeAreaInsets();
  const chosen = activeTargets(targets);
  const [footerHeight, setFooterHeight] = useState(160);

  function next() {
    if (from === "setup" && router.canGoBack()) {
      router.back();
      return;
    }
    router.push({
      pathname: "/shortcut-setup",
      params: onboarding ? { onboarding } : {},
    });
  }

  return (
    <View style={styles.root}>
      <Screen
        contentContainerStyle={[styles.screen, { paddingBottom: footerHeight + spacing.xl }]}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topline}>
          <FieldApertureMark size={34} />
          <Eyebrow>{localize("YOUR APPS", "TUS APPS")}</Eyebrow>
        </View>

        <View style={styles.header}>
          <Heading style={styles.title}>
            {localize(
              "Which apps do you want to open more intentionally?",
              "¿Qué apps quieres abrir con más intención?",
            )}
          </Heading>
          <Body style={styles.lede}>
            {localize(
              "Still pauses before these apps. Each one gets its own “Pause” action in Shortcuts. Your choice stays on this iPhone.",
              "Still hace una pausa antes de estas apps. Cada una tiene su acción «Pausar» en Atajos. Tu elección se queda en este iPhone.",
            )}
          </Body>
        </View>

        <IosAppPicker />
      </Screen>

      {/* Always in reach: nobody should scroll the whole list to move on. */}
      <View
        onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
        style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
      >
        <PrimaryButton disabled={chosen.length === 0} onPress={next} variant="signal">
          {chosen.length === 0
            ? localize("Choose at least one app", "Elige al menos una app")
            : localize(
                `Continue · ${chosen.length} ${chosen.length === 1 ? "app" : "apps"}`,
                `Continuar · ${chosen.length} ${chosen.length === 1 ? "app" : "apps"}`,
              )}
        </PrimaryButton>
        {onboarding || from === "setup" ? null : (
          <PrimaryButton onPress={() => router.back()} variant="quiet">
            {localize("Done", "Listo")}
          </PrimaryButton>
        )}
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

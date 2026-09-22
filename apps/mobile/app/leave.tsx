import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AppState, StyleSheet, View } from "react-native";

import { FieldApertureMark } from "@/components/field-aperture-mark";
import { PrimaryButton } from "@/components/primary-button";
import { Screen } from "@/components/screen";
import { Body, Eyebrow, Heading } from "@/components/typography";
import { localize } from "@/i18n";
import { colors, spacing } from "@/theme/tokens";

/**
 * Shown only when Still cannot send the user to the Home Screen itself. iOS
 * has no public API for that, so the last resort is to say how to leave.
 */
export default function LeaveScreen() {
  useEffect(() => {
    // Once the user has left, the next launch should start from Today.
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background") router.replace("/(tabs)/(today)");
    });
    return () => subscription.remove();
  }, []);

  return (
    <Screen contentContainerStyle={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.topline}>
        <FieldApertureMark size={34} />
        <Eyebrow>{localize("OPENING AVOIDED", "APERTURA EVITADA")}</Eyebrow>
      </View>
      <View style={styles.copy}>
        <Heading style={styles.title}>
          {localize("Done. You stayed out.", "Listo. Te quedaste fuera.")}
        </Heading>
        <Body style={styles.body}>
          {localize(
            "Swipe up from the bottom of the screen to go back to your Home Screen.",
            "Desliza hacia arriba desde el borde inferior para volver a tu pantalla de inicio.",
          )}
        </Body>
      </View>
      <PrimaryButton
        onPress={() => router.replace("/(tabs)/(today)")}
        variant="quiet"
      >
        {localize("See today in Still", "Ver el día en Still")}
      </PrimaryButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { minHeight: 640, gap: spacing.xl, justifyContent: "space-between" },
  topline: {
    minHeight: 58,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  copy: { gap: spacing.lg },
  title: { fontSize: 30, lineHeight: 33 },
  body: { color: colors.graphiteSoft },
});

import { router, useLocalSearchParams } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";

import { PrimaryButton } from "@/components/primary-button";
import { Screen } from "@/components/screen";
import { Surface } from "@/components/surface";
import { Body, Display, Eyebrow } from "@/components/typography";
import { localize } from "@/i18n";
import { colors, spacing } from "@/theme/tokens";

export default function UnlockReadyScreen() {
  const { endsAt } = useLocalSearchParams<{ endsAt?: string }>();
  const endTime = endsAt
    ? new Date(endsAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <Screen>
      <View style={styles.copy}>
        <Eyebrow>{localize("INTENTION RESTORED", "INTENCIÓN RECUPERADA")}</Eyebrow>
        <Display>{localize("Your app is unlocked", "Tu app está desbloqueada")}</Display>
        <Body>
          {Platform.OS === "ios"
            ? localize(
                "Return with the ‹ previous app shortcut at the top-left, or use the app switcher. iOS keeps the selected app private, so Still cannot relaunch it by name.",
                "Volvé con el acceso ‹ a la app anterior arriba a la izquierda, o usá el selector de apps. iOS mantiene privada la app elegida, por eso Still no puede relanzarla por nombre.",
              )
            : localize(
                "Still reopened the app you were trying to use.",
                "Still volvió a abrir la app que querías usar.",
              )}
        </Body>
      </View>
      <Surface style={styles.status}>
        <Eyebrow>{localize("UNLOCK ACTIVE", "DESBLOQUEO ACTIVO")}</Eyebrow>
        <Body>
          {endTime
            ? localize(`Available until ${endTime}`, `Disponible hasta las ${endTime}`)
            : localize("Available for 10 minutes", "Disponible por 10 minutos")}
        </Body>
      </Surface>
      <PrimaryButton onPress={() => router.replace("/(tabs)/(today)")}>
        {localize("Back to Still", "Volver a Still")}
      </PrimaryButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  copy: { gap: spacing.md, marginTop: spacing.xl },
  status: {
    borderColor: colors.sage,
    borderWidth: 1,
    gap: spacing.sm,
  },
});

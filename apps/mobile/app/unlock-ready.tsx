import { router, useLocalSearchParams } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";

import { IntervalMark } from "@/components/interval-mark";
import { PrimaryButton } from "@/components/primary-button";
import { Screen } from "@/components/screen";
import { Body, Data, Display, Eyebrow, Mono } from "@/components/typography";
import { localize } from "@/i18n";
import { colors, spacing } from "@/theme/tokens";

export default function UnlockReadyScreen() {
  const { endsAt } = useLocalSearchParams<{ endsAt?: string }>();
  const endTime = endsAt
    ? new Date(endsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <Screen contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <Eyebrow>{localize("PASS ACTIVE / UNTIL", "PASE ACTIVO / HASTA")}</Eyebrow>
        <Data style={styles.time}>{endTime ?? "10 MIN"}</Data>
      </View>

      <IntervalMark label={localize("OPEN", "ABIERTO")} />

      <View style={styles.copy}>
        <Display>{localize("The app is\nopen for now.", "La app está\nabierta por ahora.")}</Display>
        <Body style={styles.body}>
          {Platform.OS === "ios"
            ? localize(
                "Return with the previous-app shortcut at the top left, or use the app switcher. Still can’t see or relaunch the app by name.",
                "Vuelve con el acceso a la app anterior, arriba a la izquierda, o usa el selector de apps. Still no puede ver ni abrir la app por su nombre.",
              )
            : localize(
                "Still reopened the app you were trying to use. The pause returns when the pass ends.",
                "Still volvió a abrir la app que querías usar. La pausa regresa cuando termina el pase.",
              )}
        </Body>
      </View>

      <View style={styles.status}>
        <View>
          <Eyebrow>{localize("NEXT STATE", "SIGUIENTE ESTADO")}</Eyebrow>
          <Mono>{localize("PAUSE RETURNS", "VUELVE LA PAUSA")}</Mono>
        </View>
        <Mono>{endTime ?? localize("IN 10 MIN", "EN 10 MIN")}</Mono>
      </View>

      <PrimaryButton onPress={() => router.replace("/(tabs)/(today)")} variant="secondary">
        {localize("Back to Today", "Volver a Hoy")}
      </PrimaryButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, minHeight: 700, justifyContent: "space-between", paddingVertical: spacing.lg },
  header: { gap: spacing.md },
  time: { fontSize: 58, lineHeight: 60, letterSpacing: -3 },
  copy: { gap: spacing.lg },
  body: { color: colors.muted },
  status: {
    minHeight: 88,
    paddingVertical: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: spacing.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.ink,
  },
});

import { router, useLocalSearchParams } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";

import { AttentionField } from "@/components/attention-field";
import { FieldApertureMark } from "@/components/field-aperture-mark";
import { PrimaryButton } from "@/components/primary-button";
import { Screen } from "@/components/screen";
import { Body, Data, Eyebrow, Heading, Mono } from "@/components/typography";
import { localize } from "@/i18n";
import { colors, spacing } from "@/theme/tokens";

export default function UnlockReadyScreen() {
  const { endsAt } = useLocalSearchParams<{ endsAt?: string }>();
  const endTime = endsAt ? new Date(endsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <Screen contentContainerStyle={styles.screen}>
      <View style={styles.topline}>
        <FieldApertureMark size={34} />
        <Eyebrow>{localize("PASS ACTIVE", "PASE ACTIVO")}</Eyebrow>
      </View>

      <View style={styles.hero}>
        <Eyebrow>{localize("OPEN UNTIL", "ABIERTO HASTA")}</Eyebrow>
        <Data style={styles.time}>{endTime ?? "10 MIN"}</Data>
        <AttentionField accessibilityLabel={localize("One intentional pass is active.", "Hay un pase intencional activo.")} values={[0, 0, 0, 0, 0, 0, 1]} passes={1} />
      </View>

      <View style={styles.copy}>
        <Heading style={styles.title}>{localize("The app is open for a fixed amount of time.", "La app está abierta durante un tiempo definido.")}</Heading>
        <Body style={styles.body}>
          {Platform.OS === "ios"
            ? localize("Return with the previous-app shortcut or the app switcher. Still cannot see or relaunch the app by name.", "Vuelve con el acceso a la app anterior o el selector de apps. Still no puede ver ni abrir la app por su nombre.")
            : localize("Still reopened the app you chose. The pause returns when the pass ends.", "Still volvió a abrir la app que elegiste. La pausa regresa cuando termina el pase.")}
        </Body>
      </View>

      <View style={styles.status}>
        <View style={styles.statusCopy}><Eyebrow>{localize("NEXT STATE", "SIGUIENTE ESTADO")}</Eyebrow><Mono>{localize("PAUSE RETURNS", "VUELVE LA PAUSA")}</Mono></View>
        <Mono>{endTime ?? localize("IN 10 MIN", "EN 10 MIN")}</Mono>
      </View>

      <PrimaryButton onPress={() => router.replace("/(tabs)/(today)")} variant="secondary">
        {localize("Back to Today", "Volver a Hoy")}
      </PrimaryButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, minHeight: 720, justifyContent: "space-between", paddingVertical: spacing.lg },
  topline: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  hero: { paddingVertical: spacing.xl, gap: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.fog },
  time: { fontSize: 68, lineHeight: 68, letterSpacing: -3.4 },
  copy: { gap: spacing.lg },
  title: { fontSize: 30, lineHeight: 33 },
  body: { color: colors.graphiteSoft },
  status: { minHeight: 88, paddingVertical: spacing.lg, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.fog },
  statusCopy: { gap: spacing.xs },
});

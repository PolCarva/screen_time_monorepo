import { StyleSheet, View } from "react-native";

import { FieldApertureMark } from "@/components/field-aperture-mark";
import { Mono } from "@/components/typography";
import { colors, spacing } from "@/theme/tokens";

export function IntervalMark({ label = "00:01" }: { label?: string }) {
  return (
    <View style={styles.root} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <FieldApertureMark size={30} />
      <View style={styles.line} />
      <Mono style={styles.label}>{label}</Mono>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  line: { height: StyleSheet.hairlineWidth, flex: 1, backgroundColor: colors.ink },
  label: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    color: colors.graphite,
    fontFamily: "Recursive_600SemiBold",
    fontSize: 10,
  },
});

import { StyleSheet, View } from "react-native";

import { Mono } from "@/components/typography";
import { colors, spacing } from "@/theme/tokens";

export function IntervalMark({ label = "00:01" }: { label?: string }) {
  return (
    <View style={styles.root} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.line} />
      <Mono style={styles.label}>{label}</Mono>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  line: { height: StyleSheet.hairlineWidth, flex: 1, backgroundColor: colors.ink },
  label: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    color: colors.ink,
    backgroundColor: colors.signal,
    fontFamily: "IBMPlexMono_600SemiBold",
    fontSize: 10,
  },
});

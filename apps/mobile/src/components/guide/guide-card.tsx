import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts, radius, spacing } from "@/theme/tokens";

/**
 * A guide step's picture: a system screen drawn in code with the control to
 * tap ringed. The whole card is one button that jumps to that screen, so the
 * drawing is hidden from screen readers and the label describes it instead.
 */
export function GuideCard({
  accessibilityLabel,
  actionLabel,
  onPress,
  children,
}: {
  accessibilityLabel: string;
  /** What tapping does, e.g. "Tap to open this screen in Shortcuts". */
  actionLabel: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityHint={actionLabel}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="imagebutton"
      onPress={onPress}
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
      >
        {children}
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerLabel}>{actionLabel}</Text>
        <Text style={styles.footerArrow}>↗</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.mineralLight,
    borderRadius: radius.modal,
    borderCurve: "continuous",
    backgroundColor: colors.white,
  },
  pressed: { opacity: 0.78 },
  footer: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
    backgroundColor: colors.chalkRaised,
  },
  footerLabel: {
    flex: 1,
    color: colors.graphite,
    fontFamily: fonts.brandMedium,
    fontSize: 12,
  },
  footerArrow: { color: colors.mineral, fontSize: 15 },
});

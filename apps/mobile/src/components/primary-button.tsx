import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

import { colors, fonts, radius, spacing } from "@/theme/tokens";

type ButtonVariant = "primary" | "secondary" | "quiet" | "signal" | "danger";
type PrimaryButtonProps = Omit<PressableProps, "children" | "style"> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: ButtonVariant;
};

export function PrimaryButton({ children, style, variant = "primary", disabled, ...props }: PrimaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      {...props}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.label, variant === "primary" || variant === "signal" || variant === "danger" ? styles.labelLight : styles.labelDark]}>
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderRadius: radius.control,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { borderColor: colors.graphite, backgroundColor: colors.graphite },
  secondary: { borderColor: colors.graphite, backgroundColor: "transparent" },
  quiet: { borderColor: colors.fog, backgroundColor: colors.chalkRaised },
  signal: { borderColor: colors.mineral, backgroundColor: colors.mineral },
  danger: { borderColor: colors.danger, backgroundColor: colors.danger },
  pressed: { opacity: 0.84, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.42 },
  label: { fontFamily: fonts.brandSemiBold, fontSize: 15 },
  labelLight: { color: colors.chalkRaised },
  labelDark: { color: colors.graphite },
});

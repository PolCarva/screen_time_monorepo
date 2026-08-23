import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

import { colors, fonts, radius, spacing } from "@/theme/tokens";

type PrimaryButtonProps = Omit<PressableProps, "children" | "style"> & { children: ReactNode; style?: StyleProp<ViewStyle> };
export function PrimaryButton({ children, style, ...props }: PrimaryButtonProps) {
  return <Pressable {...props} style={({ pressed }) => [styles.button, pressed && styles.pressed, style]}><Text style={styles.label}>{children}</Text></Pressable>;
}
const styles = StyleSheet.create({ button: { minHeight: 52, paddingHorizontal: spacing.lg, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.ink }, pressed: { opacity: .82, transform: [{ scale: .985 }] }, label: { fontFamily: fonts.sansMedium, color: colors.white, fontSize: 14 } });

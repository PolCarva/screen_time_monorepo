import type { PropsWithChildren } from "react";
import { StyleSheet, View, type ViewProps } from "react-native";

import { colors, radius, spacing } from "@/theme/tokens";

export function Surface({ children, style, ...props }: PropsWithChildren<ViewProps>) { return <View {...props} style={[styles.surface, style]}>{children}</View>; }
const styles = StyleSheet.create({ surface: { padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: radius.lg, backgroundColor: colors.white, shadowColor: colors.ink, shadowOpacity: .06, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 2 } });

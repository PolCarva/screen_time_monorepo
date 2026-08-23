import type { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, View, type ScrollViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "@/theme/tokens";

export function Screen({ children, contentContainerStyle, ...props }: PropsWithChildren<ScrollViewProps>) {
  const insets = useSafeAreaInsets();
  return <ScrollView style={styles.root} contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, spacing.lg), paddingBottom: insets.bottom + 110 }, contentContainerStyle]} {...props}>{children}</ScrollView>;
}

export function Hairline() { return <View style={styles.line} />; }
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.linen }, content: { paddingHorizontal: spacing.lg, gap: spacing.lg }, line: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line } });

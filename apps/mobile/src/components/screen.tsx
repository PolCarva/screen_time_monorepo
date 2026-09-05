import type { PropsWithChildren } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "@/theme/tokens";

export function Screen({
  children,
  contentContainerStyle,
  ...props
}: PropsWithChildren<ScrollViewProps>) {
  const insets = useSafeAreaInsets();
  const topPadding =
    Platform.OS === "android"
      ? insets.top + spacing.xxxl
      : Math.max(insets.top, spacing.lg);
  return (
    <ScrollView
      style={styles.root}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: topPadding,
          paddingBottom: insets.bottom + 118,
        },
        contentContainerStyle,
      ]}
      {...props}
    >
      {children}
    </ScrollView>
  );
}

export function Hairline() {
  return <View style={styles.line} />;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: spacing.lg, gap: spacing.xl },
  line: { height: StyleSheet.hairlineWidth, backgroundColor: colors.rule },
});

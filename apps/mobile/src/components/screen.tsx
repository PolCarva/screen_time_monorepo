import { StatusBar } from "expo-status-bar";
import {
  Children,
  isValidElement,
  useRef,
  type PropsWithChildren,
} from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
} from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { rise, staggerDelay } from "@/components/motion";
import { colors, spacing } from "@/theme/tokens";

/** Blocks that mount after this (loaded data, a new state) arrive at once. */
const REVEAL_WINDOW_MS = 900;

type ScreenProps = PropsWithChildren<ScrollViewProps> & {
  /**
   * A single moment rather than a page: the content fills the space between
   * the system bars (no room kept for a tab bar) and scrolls only when it
   * truly does not fit.
   */
  fit?: boolean;
  /**
   * Each top-level block rises into place in order the first time. A
   * <StatusBar> child is left unwrapped: it draws nothing, and a wrapper would
   * be one more item in the layout (another gap, a share of the free space).
   */
  reveal?: boolean;
};

export function Screen({
  children,
  contentContainerStyle,
  fit = false,
  reveal = true,
  ...props
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const mountedAt = useRef(Date.now());
  const topPadding = fit
    ? insets.top + spacing.lg
    : Platform.OS === "android"
      ? insets.top + spacing.xxxl
      : Math.max(insets.top, spacing.lg);
  const bottomPadding = fit
    ? Math.max(insets.bottom, spacing.md) + spacing.md
    : insets.bottom + 118;

  // Only the first blocks wait their turn; anything that appears later (data
  // that loaded, a section that became relevant) rises in without a delay.
  const staggering = Date.now() - mountedAt.current < REVEAL_WINDOW_MS;
  let order = 0;
  const content = reveal
    ? Children.map(children, (child) => {
        if (!isValidElement(child) || child.type === StatusBar) return child;
        const delay = staggering ? staggerDelay(order++) : 0;
        return <Animated.View entering={rise(delay)}>{child}</Animated.View>;
      })
    : children;

  return (
    <ScrollView
      style={styles.root}
      // A fitted screen pads itself for the safe area; letting iOS add the
      // insets again would make every fitted screen scroll by that much.
      contentInsetAdjustmentBehavior={fit ? "never" : "automatic"}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.content,
        fit && styles.fit,
        {
          paddingTop: topPadding,
          paddingBottom: bottomPadding,
        },
        contentContainerStyle,
      ]}
      {...props}
    >
      {content}
    </ScrollView>
  );
}

export function Hairline() {
  return <View style={styles.line} />;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: spacing.lg, gap: spacing.xl },
  fit: { flexGrow: 1 },
  line: { height: StyleSheet.hairlineWidth, backgroundColor: colors.rule },
});

import type { ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FieldApertureMark } from "@/components/field-aperture-mark";
import { GrowFill } from "@/components/motion";
import { PrimaryButton } from "@/components/primary-button";
import { Body, Display, Eyebrow } from "@/components/typography";
import { localize } from "@/i18n";
import { colors, fonts, radius, spacing } from "@/theme/tokens";

/**
 * How much room the phone leaves between its system bars. Every step must fit
 * without scrolling on a common phone, so smaller ones get smaller type.
 */
export type Density = "regular" | "compact" | "tight";

export function densityFor(room: number): Density {
  if (room < 700) return "tight";
  if (room < 820) return "compact";
  return "regular";
}

/** Story titles are questions and sentences, a size under the app's display. */
export const storyTitleSizes = {
  regular: { fontSize: 34, lineHeight: 37, letterSpacing: -1.2 },
  compact: { fontSize: 30, lineHeight: 33, letterSpacing: -1 },
  tight: { fontSize: 26, lineHeight: 29, letterSpacing: -0.8 },
} as const;

/** Where the phone is and how big the story can draw. */
export function useStoryMetrics() {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const density = densityFor(height - insets.top - insets.bottom);
  return {
    density,
    compact: density !== "regular",
    /** Width between the side margins. */
    contentWidth: width - insets.left - insets.right - spacing.lg * 2,
    /** Height between the system bars. */
    room: height - insets.top - insets.bottom,
  };
}

/**
 * The frame every onboarding step shares: Still's mark, a progress bar that
 * grows as the steps go by, and "Skip" while there is story left to skip. It
 * stays put while the steps change inside it.
 */
export function OnboardingChrome({
  progress,
  onSkip,
  children,
}: {
  /** 0 on the first step, 1 on the last. */
  progress: number;
  onSkip?: () => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { compact } = useStoryMetrics();
  const percent = Math.round(progress * 100);
  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top + (compact ? spacing.sm : spacing.md),
          paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.xs,
          paddingLeft: insets.left + spacing.lg,
          paddingRight: insets.right + spacing.lg,
        },
      ]}
    >
      <View style={styles.top}>
        <FieldApertureMark size={24} />
        <View
          accessible
          accessibilityLabel={localize("Progress", "Progreso")}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: percent }}
          style={styles.track}
        >
          <GrowFill color={colors.graphite} value={Math.max(0.04, progress)} />
        </View>
        <View style={styles.skipSlot}>
          {onSkip ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={12}
              onPress={onSkip}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text style={styles.skip}>{localize("Skip", "Saltar")}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

/**
 * One idea per step: a title (with an optional eyebrow and body) at the top,
 * the step's picture in the middle, its buttons at the bottom. The middle
 * scrolls only on a very small screen or with very large text.
 */
export function StoryLayout({
  eyebrow,
  title,
  body,
  children,
  footer,
  centerVisual = true,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  children?: ReactNode;
  footer: ReactNode;
  /** Center the picture in the room left; false keeps it under the copy. */
  centerVisual?: boolean;
}) {
  const { density, compact } = useStoryMetrics();
  return (
    <View style={styles.layout}>
      <ScrollView
        bounces={false}
        contentContainerStyle={[
          styles.scrollContent,
          compact && styles.scrollContentCompact,
        ]}
        contentInsetAdjustmentBehavior="never"
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <View style={[styles.copy, compact && styles.copyCompact]}>
          {eyebrow ? <Eyebrow style={styles.eyebrow}>{eyebrow}</Eyebrow> : null}
          <Display
            accessibilityRole="header"
            style={storyTitleSizes[density]}
            textBreakStrategy="balanced"
          >
            {title}
          </Display>
          {body ? (
            <Body style={[styles.bodyText, density === "tight" && styles.bodyTight]}>
              {body}
            </Body>
          ) : null}
        </View>
        {children ? (
          <View style={[styles.visual, centerVisual && styles.visualCentered]}>
            {children}
          </View>
        ) : null}
      </ScrollView>
      {footer}
    </View>
  );
}

type FooterAction = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

/** The step's primary button, an optional quiet second way, and a hint above them. */
export function StoryFooter({
  primary,
  secondary,
  note,
}: {
  primary: FooterAction;
  secondary?: FooterAction;
  note?: string;
}) {
  const { compact } = useStoryMetrics();
  return (
    <View style={[styles.footer, compact && styles.footerCompact]}>
      {note ? <Text style={styles.note}>{note}</Text> : null}
      <PrimaryButton disabled={primary.disabled} onPress={primary.onPress}>
        {primary.label}
      </PrimaryButton>
      {secondary ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: secondary.disabled }}
          disabled={secondary.disabled}
          hitSlop={8}
          onPress={secondary.onPress}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryLabel}>{secondary.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  top: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  track: {
    flex: 1,
    height: 4,
    overflow: "hidden",
    borderRadius: radius.xs,
    backgroundColor: colors.fog,
  },
  skipSlot: { minWidth: 44, alignItems: "flex-end" },
  skip: {
    color: colors.graphiteSoft,
    fontFamily: fonts.brandMedium,
    fontSize: 13,
  },
  pressed: { opacity: 0.5 },
  body: { flex: 1 },
  layout: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    gap: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  scrollContentCompact: {
    gap: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  copy: { gap: spacing.md },
  copyCompact: { gap: spacing.sm },
  eyebrow: { color: colors.mineral },
  bodyText: { maxWidth: 520, color: colors.graphiteSoft },
  bodyTight: { fontSize: 15, lineHeight: 22 },
  visual: { gap: spacing.md },
  visualCentered: { flexGrow: 1, justifyContent: "center" },
  footer: { gap: spacing.sm, paddingTop: spacing.sm },
  footerCompact: { gap: spacing.xs },
  note: {
    textAlign: "center",
    color: colors.graphiteSoft,
    fontFamily: fonts.brand,
    fontSize: 13,
    lineHeight: 19,
    paddingBottom: spacing.xs,
  },
  secondary: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryLabel: {
    color: colors.graphite,
    fontFamily: fonts.brandSemiBold,
    fontSize: 14,
    textDecorationLine: "underline",
    textDecorationColor: colors.mineralLight,
  },
});

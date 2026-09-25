import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { gotItAction, useStillSheet } from "@/components/still-sheet";
import { localize } from "@/i18n";
import { colors, fonts, motion, radius, spacing } from "@/theme/tokens";

export type CheckState = "verified" | "pending" | "waiting" | "warning";

/**
 * What the phone says about a setup step: verified (the signal is there),
 * waiting (a test is running), warning (half done) or pending. It is the only
 * thing that turns a step green (docs/onboarding-v2-plan.md, D7).
 */
export function CheckRow({ state, label }: { state: CheckState; label: string }) {
  const icon =
    state === "verified"
      ? "checkmark-circle"
      : state === "warning"
        ? "alert-circle"
        : state === "waiting"
          ? "time-outline"
          : "ellipse-outline";
  const color =
    state === "verified"
      ? colors.success
      : state === "warning"
        ? colors.warning
        : colors.mineral;
  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      entering={FadeIn.duration(motion.standard)}
      key={state}
      style={styles.row}
    >
      <Ionicons color={color} name={icon} size={22} />
      <Text style={[styles.label, state === "verified" && styles.labelVerified]}>
        {label}
      </Text>
    </Animated.View>
  );
}

/**
 * "Does it look different?": Settings differ by maker and version, so the
 * drawn guide is not the only guide. The sheet gives the step's goal in plain
 * words, the maker's usual path when known, and the way that always works.
 */
export function LooksDifferent({ lines }: { lines: string[] }) {
  const sheet = useStillSheet();
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={8}
      onPress={() =>
        void sheet.show({
          title: localize(
            "Your phone may look different",
            "Tu teléfono puede verse distinto",
          ),
          message: localize(
            "Settings change from one phone to another. What matters is the goal; Still checks it by itself.",
            "Ajustes cambia de un teléfono a otro. Lo que importa es la meta; Still la comprueba solo.",
          ),
          bullets: lines,
          actions: [gotItAction()],
        })
      }
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
    >
      <Text style={styles.linkLabel}>
        {localize("Does it look different?", "¿Se ve distinto?")}
      </Text>
    </Pressable>
  );
}

/** A numbered line of a short checklist. */
export function NumberedLine({ index, children }: { index: number; children: string }) {
  return (
    <View style={styles.numbered}>
      <Text style={styles.number}>{index}</Text>
      <Text style={styles.numberedText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.control,
    backgroundColor: colors.chalkRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
  },
  label: {
    flex: 1,
    color: colors.graphiteSoft,
    fontFamily: fonts.brandMedium,
    fontSize: 15,
    lineHeight: 21,
  },
  labelVerified: { color: colors.graphite },
  link: { alignSelf: "flex-start", paddingVertical: spacing.xs },
  linkLabel: {
    color: colors.graphite,
    fontFamily: fonts.brandSemiBold,
    fontSize: 14,
    textDecorationLine: "underline",
    textDecorationColor: colors.mineralLight,
  },
  pressed: { opacity: 0.5 },
  numbered: { flexDirection: "row", gap: spacing.sm },
  number: {
    width: 18,
    color: colors.mineral,
    fontFamily: fonts.monoMedium,
    fontSize: 14,
    lineHeight: 21,
  },
  numberedText: {
    flex: 1,
    color: colors.graphite,
    fontFamily: fonts.brand,
    fontSize: 14,
    lineHeight: 21,
  },
});

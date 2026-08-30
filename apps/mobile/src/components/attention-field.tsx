import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { colors, motion, radius, spacing } from "@/theme/tokens";

type AttentionFieldProps = {
  mode?: "progress" | "intervention" | "impact";
  values?: number[];
  passes?: number;
  dark?: boolean;
  animate?: boolean;
  accessibilityLabel: string;
};

const DAYS = 7;
const MODULES_PER_DAY = 5;

function ProgressField({ values, passes = 0, dark = false }: Pick<AttentionFieldProps, "values" | "passes" | "dark">) {
  const normalized = values?.length === DAYS ? values : Array(DAYS).fill(0);
  const maximum = Math.max(...normalized, 1);
  const ink = dark ? colors.mineralLight : colors.mineral;
  const inactive = dark ? colors.graphiteSoft : colors.fog;

  return (
    <View style={styles.progressField}>
      {normalized.map((value, dayIndex) => {
        const count = value === 0 ? 0 : Math.max(1, Math.round((value / maximum) * MODULES_PER_DAY));
        return (
          <View key={dayIndex} style={styles.dayColumn}>
            {Array.from({ length: MODULES_PER_DAY }).map((_, moduleIndex) => {
              const active = moduleIndex < count;
              const passModule = dayIndex === DAYS - 1 && passes > 0 && moduleIndex === Math.min(count, MODULES_PER_DAY - 1);
              return (
                <View
                  key={moduleIndex}
                  style={[
                    styles.progressModule,
                    { backgroundColor: active ? ink : inactive, opacity: active ? 0.56 + moduleIndex * 0.09 : 0.5 },
                    passModule && { backgroundColor: colors.peach, opacity: 1 },
                  ]}
                />
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

function InterventionHalf({ side, dark }: { side: "left" | "right"; dark: boolean }) {
  const base = dark ? colors.mineralLight : colors.mineral;
  return (
    <View style={[styles.interventionHalf, side === "left" ? styles.alignRight : styles.alignLeft]}>
      {Array.from({ length: 6 }).map((_, row) => (
        <View key={row} style={styles.interventionRow}>
          {Array.from({ length: 3 }).map((__, column) => {
            const choice = row === 3 && column === (side === "left" ? 2 : 0);
            return (
              <View
                key={column}
                style={[
                  styles.interventionModule,
                  { backgroundColor: choice ? colors.peach : base, opacity: choice ? 0.9 : 0.48 + ((row + column) % 3) * 0.16 },
                ]}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

function InterventionField({ dark = true, animate = true }: Pick<AttentionFieldProps, "dark" | "animate">) {
  const reducedMotion = useReducedMotion();
  const opening = useSharedValue(reducedMotion || !animate ? 1 : 0);

  useEffect(() => {
    if (reducedMotion || !animate) {
      opening.value = 1;
      return;
    }
    opening.value = withTiming(1, {
      duration: motion.fieldOpen,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });
    const haptic = setTimeout(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }, motion.fieldOpen);
    return () => clearTimeout(haptic);
  }, [animate, opening, reducedMotion]);

  const leftStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -18 * opening.value }] }));
  const rightStyle = useAnimatedStyle(() => ({ transform: [{ translateX: 18 * opening.value }] }));

  return (
    <View style={styles.interventionField}>
      <Animated.View style={[styles.halfWrap, leftStyle]}><InterventionHalf side="left" dark={dark} /></Animated.View>
      <View style={[styles.aperture, { backgroundColor: dark ? colors.chalk : colors.graphite }]} />
      <Animated.View style={[styles.halfWrap, rightStyle]}><InterventionHalf side="right" dark={dark} /></Animated.View>
    </View>
  );
}

function ImpactField({ values, dark = false }: Pick<AttentionFieldProps, "values" | "dark">) {
  const source = values?.slice(0, 10) ?? [];
  const maximum = Math.max(...source, 1);
  return (
    <View style={styles.impactField}>
      {source.map((value, index) => (
        <View
          key={index}
          style={[
            styles.impactModule,
            {
              height: 12 + (value / maximum) * 64,
              backgroundColor: index === source.length - 1 ? colors.peach : dark ? colors.mineralLight : colors.mineral,
              opacity: index === source.length - 1 ? 1 : 0.38 + index * 0.045,
            },
          ]}
        />
      ))}
    </View>
  );
}

export function AttentionField({ mode = "progress", values, passes, dark = false, animate = true, accessibilityLabel }: AttentionFieldProps) {
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={styles.root}>
      {mode === "progress" ? <ProgressField values={values} passes={passes} dark={dark} /> : null}
      {mode === "intervention" ? <InterventionField dark={dark} animate={animate} /> : null}
      {mode === "impact" ? <ImpactField values={values} dark={dark} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: "100%" },
  progressField: { minHeight: 110, flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  dayColumn: { flex: 1, gap: spacing.xs, justifyContent: "flex-end" },
  progressModule: { width: "100%", height: 11, borderRadius: radius.xs },
  interventionField: { height: 152, flexDirection: "row", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  halfWrap: { flex: 1 },
  interventionHalf: { gap: 7 },
  interventionRow: { flexDirection: "row", gap: 7 },
  interventionModule: { width: 25, height: 11, borderRadius: 3 },
  alignRight: { alignItems: "flex-end" },
  alignLeft: { alignItems: "flex-start" },
  aperture: { width: 1, height: 136, opacity: 0.14 },
  impactField: { height: 92, flexDirection: "row", alignItems: "flex-end", gap: spacing.xs },
  impactModule: { flex: 1, minWidth: 8, borderTopLeftRadius: radius.xs, borderTopRightRadius: radius.xs },
});

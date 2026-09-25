import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { settle } from "@/components/motion";
import { colors, fonts, motion, spacing } from "@/theme/tokens";

const KNOB = 30;
const TRACK_HEIGHT = 3;

/** The stop nearest to [value]; values between stops snap to the closest. */
function nearestIndex(steps: readonly number[], value: number): number {
  let best = 0;
  steps.forEach((step, index) => {
    if (Math.abs(step - value) < Math.abs(steps[best]! - value)) best = index;
  });
  return best;
}

type Props = {
  /** The stops, in order; the value is always one of them. */
  steps: readonly number[];
  value: number;
  onChange: (value: number) => void;
  /** How a stop reads, on screen and to screen readers. */
  format: (value: number) => string;
  accessibilityLabel: string;
  /** The value above the track; off when the screen shows it bigger itself. */
  showValue?: boolean;
  disabled?: boolean;
  /** `dark` for the intervention shield, `light` for Still's own screens. */
  tone?: "dark" | "light";
};

/**
 * A slider that only lands on its stops: there is no free-form value to
 * mistype and no way to land between two stops. Each new stop ticks under the
 * finger (a selection haptic) and the knob glides to it.
 */
export function SteppedSlider({
  steps,
  value,
  onChange,
  format,
  accessibilityLabel,
  showValue = true,
  disabled = false,
  tone = "dark",
}: Props) {
  const palette = tone === "dark" ? darkPalette : lightPalette;
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const lastIndex = steps.length - 1;
  const index = nearestIndex(steps, value);
  // The knob glides from stop to stop and grows a little under the finger.
  const knobX = useSharedValue(0);
  const touching = useSharedValue(0);
  const placed = useRef(false);
  // The gesture reads these instead of closing over them, so the responder can
  // stay the same object while the value changes under an active drag. A new
  // responder mid-drag starts counting the drag from zero again, which threw
  // the knob back to where the finger first landed. `onChange` is read here
  // too: callers pass a fresh arrow on every render.
  const gesture = useRef({
    width,
    disabled,
    startX: 0,
    sent: value,
    steps,
    onChange,
  });
  gesture.current.width = width;
  gesture.current.disabled = disabled;
  gesture.current.sent = value;
  gesture.current.steps = steps;
  gesture.current.onChange = onChange;

  const commit = useCallback((next: number) => {
    const stops = gesture.current.steps;
    const stop = stops[Math.max(0, Math.min(stops.length - 1, next))]!;
    if (stop === gesture.current.sent) return;
    gesture.current.sent = stop;
    void Haptics.selectionAsync().catch(() => undefined);
    gesture.current.onChange(stop);
  }, []);

  const indexFromX = useCallback((x: number) => {
    const usable = Math.max(1, gesture.current.width - KNOB);
    const ratio = Math.max(0, Math.min(1, (x - KNOB / 2) / usable));
    return Math.round(ratio * (gesture.current.steps.length - 1));
  }, []);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !gesture.current.disabled,
        onMoveShouldSetPanResponder: () => !gesture.current.disabled,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          touching.value = withTiming(1, { duration: motion.pressIn });
          gesture.current.startX = event.nativeEvent.locationX;
          commit(indexFromX(gesture.current.startX));
        },
        onPanResponderMove: (_event, drag) => {
          commit(indexFromX(gesture.current.startX + drag.dx));
        },
        onPanResponderRelease: () => {
          touching.value = withTiming(0, { duration: motion.pressOut });
        },
        onPanResponderTerminate: () => {
          touching.value = withTiming(0, { duration: motion.pressOut });
        },
      }),
    [commit, indexFromX, touching],
  );

  const onTrackLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  }, []);

  const label = format(steps[index]!);
  const knobLeft =
    width > 0 ? (index / Math.max(1, lastIndex)) * Math.max(1, width - KNOB) : 0;

  useEffect(() => {
    if (width === 0) return;
    // The first placement (and every move under Reduce Motion) is immediate.
    if (!placed.current || reduceMotion) {
      placed.current = true;
      knobX.value = knobLeft;
      return;
    }
    knobX.value = withTiming(knobLeft, { duration: 180, easing: settle });
  }, [knobLeft, knobX, reduceMotion, width]);

  const knobStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: knobX.value },
      { scale: 1 + touching.value * 0.14 },
    ],
  }));
  const filledStyle = useAnimatedStyle(() => ({
    width: knobX.value + KNOB / 2,
  }));

  return (
    <View style={[styles.root, disabled && styles.rootDisabled]}>
      {showValue ? (
        <Text style={[styles.value, { color: palette.value }]}>{label}</Text>
      ) : null}
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ text: label }}
        accessibilityState={{ disabled }}
        accessibilityActions={[
          { name: "increment" },
          { name: "decrement" },
        ]}
        onAccessibilityAction={(event) => {
          if (disabled) return;
          if (event.nativeEvent.actionName === "increment") commit(index + 1);
          if (event.nativeEvent.actionName === "decrement") commit(index - 1);
        }}
        style={styles.touchArea}
        {...responder.panHandlers}
      >
        <View onLayout={onTrackLayout} style={styles.track}>
          <View style={[styles.rail, { backgroundColor: palette.rail }]} />
          <Animated.View
            style={[
              styles.filled,
              { backgroundColor: palette.filled },
              filledStyle,
            ]}
          />
          <View style={styles.ticks} pointerEvents="none">
            {steps.map((step, tickIndex) => (
              <View
                key={step}
                style={[
                  styles.tick,
                  {
                    backgroundColor:
                      tickIndex <= index ? palette.tickPassed : palette.tick,
                  },
                ]}
              />
            ))}
          </View>
          <Animated.View
            style={[
              styles.knob,
              {
                backgroundColor: palette.knob,
                borderColor: palette.knobRing,
              },
              knobStyle,
            ]}
            pointerEvents="none"
          />
        </View>
      </View>
      <View style={styles.ends}>
        <Text style={[styles.endLabel, { color: palette.endLabel }]}>
          {format(steps[0]!)}
        </Text>
        <Text style={[styles.endLabel, { color: palette.endLabel }]}>
          {format(steps[lastIndex]!)}
        </Text>
      </View>
    </View>
  );
}

const darkPalette = {
  value: colors.chalk,
  rail: colors.graphiteSoft,
  filled: colors.chalk,
  tick: colors.graphiteSoft,
  tickPassed: colors.mineralLight,
  knob: colors.chalk,
  knobRing: colors.graphite,
  endLabel: colors.mineralLight,
} as const;

const lightPalette = {
  value: colors.graphite,
  rail: colors.fog,
  filled: colors.graphite,
  tick: colors.fog,
  tickPassed: colors.mineral,
  knob: colors.graphite,
  knobRing: colors.chalk,
  endLabel: colors.graphiteSoft,
} as const;

const styles = StyleSheet.create({
  root: { gap: spacing.xs },
  rootDisabled: { opacity: 0.42 },
  value: {
    fontFamily: fonts.brandSemiBold,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -1.1,
  },
  touchArea: { paddingVertical: spacing.sm, justifyContent: "center" },
  track: { height: KNOB, justifyContent: "center" },
  rail: { height: TRACK_HEIGHT, borderRadius: TRACK_HEIGHT },
  filled: {
    position: "absolute",
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT,
  },
  ticks: {
    position: "absolute",
    left: KNOB / 2,
    right: KNOB / 2,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  tick: { width: 1, height: 9 },
  knob: {
    position: "absolute",
    left: 0,
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    borderWidth: 6,
  },
  ends: { flexDirection: "row", justifyContent: "space-between" },
  endLabel: {
    fontFamily: fonts.brandMedium,
    fontSize: 11,
    letterSpacing: 0.4,
  },
});

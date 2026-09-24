import {
  ACCESS_DURATION_STEPS,
  formatAccessDuration,
  nearestAccessDurationStep,
} from "@screen-time/contracts";
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
import { localize } from "@/i18n";
import { colors, fonts, motion, spacing } from "@/theme/tokens";

const KNOB = 30;
const TRACK_HEIGHT = 3;
const LAST_INDEX = ACCESS_DURATION_STEPS.length - 1;

function indexOfSeconds(seconds: number): number {
  return ACCESS_DURATION_STEPS.indexOf(
    nearestAccessDurationStep(seconds) as (typeof ACCESS_DURATION_STEPS)[number],
  );
}

type Props = {
  value: number;
  onChange: (seconds: number) => void;
  disabled?: boolean;
  /** `dark` for the intervention shield, `light` for Still's own screens. */
  tone?: "dark" | "light";
};

/**
 * The stepped slider the user drags to choose how long access lasts, from one
 * minute to the rest of the day. Stops come from `ACCESS_DURATION_STEPS`, so
 * the scale gives minutes most of the travel; there is no free-form value to
 * mistype and no way to land between two stops.
 */
export function DurationSlider({
  value,
  onChange,
  disabled = false,
  tone = "dark",
}: Props) {
  const palette = tone === "dark" ? darkPalette : lightPalette;
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const index = indexOfSeconds(value);
  // The knob glides from stop to stop and grows a little under the finger.
  const knobX = useSharedValue(0);
  const touching = useSharedValue(0);
  const placed = useRef(false);
  // The gesture reads these instead of closing over them, so the responder can
  // stay the same object while the value changes under an active drag.
  const gesture = useRef({ width, disabled, startX: 0, sent: value });
  gesture.current.width = width;
  gesture.current.disabled = disabled;
  gesture.current.sent = value;

  const commit = useCallback(
    (next: number) => {
      const seconds =
        ACCESS_DURATION_STEPS[Math.max(0, Math.min(LAST_INDEX, next))];
      if (seconds === gesture.current.sent) return;
      gesture.current.sent = seconds;
      void Haptics.selectionAsync().catch(() => undefined);
      onChange(seconds);
    },
    [onChange],
  );

  const indexFromX = useCallback((x: number) => {
    const usable = Math.max(1, gesture.current.width - KNOB);
    const ratio = Math.max(0, Math.min(1, (x - KNOB / 2) / usable));
    return Math.round(ratio * LAST_INDEX);
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

  const label = localize(
    formatAccessDuration(value, "en"),
    formatAccessDuration(value, "es"),
  );
  const knobLeft =
    width > 0 ? (index / LAST_INDEX) * Math.max(1, width - KNOB) : 0;

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
      <Text style={[styles.value, { color: palette.value }]}>{label}</Text>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={localize(
          "How long access lasts",
          "Cuánto dura el acceso",
        )}
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
            {ACCESS_DURATION_STEPS.map((step, tickIndex) => (
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
          {localize(
            formatAccessDuration(ACCESS_DURATION_STEPS[0], "en"),
            formatAccessDuration(ACCESS_DURATION_STEPS[0], "es"),
          )}
        </Text>
        <Text style={[styles.endLabel, { color: palette.endLabel }]}>
          {localize(
            formatAccessDuration(ACCESS_DURATION_STEPS[LAST_INDEX], "en"),
            formatAccessDuration(ACCESS_DURATION_STEPS[LAST_INDEX], "es"),
          )}
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

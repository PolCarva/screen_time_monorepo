import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ComponentType,
  type PropsWithChildren,
} from "react";
import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  FadeInLeft,
  FadeInRight,
  FadeInUp,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { Data } from "@/components/typography";
import { motion } from "@/theme/tokens";

/**
 * Still's motion. One curve for everything that arrives (fast out of the gate,
 * a long quiet settle) and short, small distances: things settle into place,
 * they never fly in. Every layout animation here follows the system's Reduce
 * Motion setting (Reanimated's default), and the hooks below check it too.
 */
export const settle = Easing.bezier(0.16, 1, 0.3, 1);
/** For things that go and come back, like a breath. */
export const sway = Easing.bezier(0.45, 0, 0.55, 1);

/** How far a block rises as it appears. */
const RISE = 12;
/** Blocks after this one arrive together, so long screens are not slow. */
const MAX_STAGGER_STEPS = 6;

/**
 * Fade and rise a few points: how every block arrives. A negative distance
 * drops in from above instead.
 */
export function rise(delay = 0, distance = RISE, duration: number = motion.reveal) {
  return FadeInUp.duration(duration)
    .delay(delay)
    .easing(settle)
    .withInitialValues({ opacity: 0, transform: [{ translateY: distance }] });
}

/** Fade and slide in from one side, for content that replaces other content. */
export function slideIn(direction: 1 | -1, delay = 0, distance = 18) {
  return (direction === 1 ? FadeInRight : FadeInLeft)
    .duration(motion.reveal)
    .delay(delay)
    .easing(settle)
    .withInitialValues({
      opacity: 0,
      transform: [{ translateX: distance * direction }],
    });
}

/** Delay for the n-th block of a screen revealing in order. */
export function staggerDelay(index: number, base = 0) {
  return base + Math.min(index, MAX_STAGGER_STEPS) * motion.stagger;
}

type RevealProps = ComponentProps<typeof Animated.View> & {
  /** Position in the screen's order; each step waits a little longer. */
  index?: number;
  delay?: number;
};

/** A block that rises into place when it mounts. */
export function Reveal({ index = 0, delay = 0, ...props }: RevealProps) {
  return <Animated.View entering={rise(staggerDelay(index, delay))} {...props} />;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PressableScaleProps = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  /** How small it gets under the finger; 1 keeps its size (rows, links). */
  scaleTo?: number;
  /** How much it dims under the finger. */
  dimTo?: number;
};

/**
 * A Pressable that answers the finger at once (it sinks and dims a little)
 * and eases back when released. Buttons shrink; wide rows only dim.
 */
export function PressableScale({
  style,
  scaleTo = 0.97,
  dimTo = 0.86,
  onPressIn,
  onPressOut,
  children,
  ...props
}: PressableScaleProps) {
  const reduceMotion = useReducedMotion();
  const pressed = useSharedValue(0);
  // The resting opacity (e.g. a disabled button's) is kept and dimmed from.
  const flat = StyleSheet.flatten(style);
  const resting = typeof flat?.opacity === "number" ? flat.opacity : 1;
  const scale = reduceMotion ? 1 : scaleTo;
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: resting * interpolate(pressed.value, [0, 1], [1, dimTo]),
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, scale]) }],
  }));

  return (
    <AnimatedPressable
      {...props}
      onPressIn={(event) => {
        pressed.value = withTiming(1, {
          duration: motion.pressIn,
          easing: Easing.out(Easing.quad),
        });
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressed.value = withTiming(0, {
          duration: motion.pressOut,
          easing: settle,
        });
        onPressOut?.(event);
      }}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}

/**
 * Counts from the value it last showed (zero on first show) to [value]. Only
 * the text re-renders; with Reduce Motion it shows the value straight away.
 */
export function useCountUp(value: number, duration: number = motion.count) {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(reduceMotion ? value : 0);
  const shownRef = useRef(shown);

  useEffect(() => {
    const from = shownRef.current;
    if (reduceMotion || from === value || !Number.isFinite(value)) {
      shownRef.current = value;
      setShown(value);
      return;
    }
    let frame = 0;
    const start = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      // Ease-out cubic: most of the count happens early, the end settles.
      const eased = 1 - (1 - t) ** 3;
      const next = from + (value - from) * eased;
      shownRef.current = t >= 1 ? value : next;
      setShown(shownRef.current);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, reduceMotion, value]);

  return shown;
}

type AnimatedNumberProps = TextProps & {
  value: number;
  /** Formats the number on screen; whole numbers by default. */
  format?: (value: number) => string;
  /** The text component to render; Still's `Data` by default. */
  as?: ComponentType<TextProps>;
};

/** A number that counts to its value instead of jumping. */
export function AnimatedNumber({
  value,
  format = (current) => String(Math.round(current)),
  as: Component = Data,
  ...props
}: AnimatedNumberProps) {
  const shown = useCountUp(value);
  return <Component {...props}>{format(shown)}</Component>;
}

/** A placeholder that breathes while its content loads. */
export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const reduceMotion = useReducedMotion();
  const phase = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    phase.value = withRepeat(withTiming(1, { duration: 900, easing: sway }), -1, true);
  }, [phase, reduceMotion]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(phase.value, [0, 1], [0.45, 0.85]),
  }));
  return <Animated.View style={[style, animatedStyle]} />;
}

/**
 * Swells and settles slowly while [active]: for "Breathe." and for things
 * that are live, like a pause that is on.
 */
export function Breathing({
  active = true,
  scaleTo = 1.05,
  opacityTo = 1,
  period = 3_000,
  delay = 0,
  style,
  children,
}: PropsWithChildren<{
  active?: boolean;
  scaleTo?: number;
  opacityTo?: number;
  /** One way, in ms: in for this long, out for this long. */
  period?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}>) {
  const reduceMotion = useReducedMotion();
  const phase = useSharedValue(0);
  useEffect(() => {
    if (!active || reduceMotion) {
      phase.value = withTiming(0, { duration: motion.standard });
      return;
    }
    phase.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: period, easing: sway }), -1, true),
    );
  }, [active, delay, period, phase, reduceMotion]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(phase.value, [0, 1], [1, opacityTo]),
    transform: [{ scale: interpolate(phase.value, [0, 1], [1, scaleTo]) }],
  }));
  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

/**
 * A check box or radio that fills and pops its tick when chosen. The caller
 * draws the box (border, size, radius); this animates what is inside it.
 */
export function CheckFill({
  checked,
  color,
  children,
}: PropsWithChildren<{ checked: boolean; color: string }>) {
  const reduceMotion = useReducedMotion();
  const on = useSharedValue(checked ? 1 : 0);
  useEffect(() => {
    on.value = reduceMotion
      ? checked
        ? 1
        : 0
      : withTiming(checked ? 1 : 0, {
          duration: checked ? 260 : 160,
          easing: checked ? Easing.out(Easing.back(2.2)) : Easing.in(Easing.quad),
        });
  }, [checked, on, reduceMotion]);
  const fillStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, on.value * 1.4),
    transform: [{ scale: interpolate(on.value, [0, 1], [0.4, 1]) }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.fill, { backgroundColor: color }, fillStyle]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * A 0…1 fill that grows from the start edge: progress segments and the like.
 * [delay] lets a row of them fill one after another.
 */
export function GrowFill({
  value,
  color,
  delay = 0,
  duration = motion.grow,
  style,
}: {
  value: number;
  color: string;
  delay?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? value : 0);
  const tint = useSharedValue(color);
  useEffect(() => {
    progress.value = reduceMotion
      ? value
      : withDelay(delay, withTiming(value, { duration, easing: settle }));
    tint.value = reduceMotion ? color : withTiming(color, { duration });
  }, [color, delay, duration, progress, reduceMotion, tint, value]);
  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: tint.value,
    transform: [{ scaleX: progress.value }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.grow, style, animatedStyle]}
    />
  );
}

/**
 * Grows from its base when it mounts: bars from the bottom, rows of modules
 * from the left. Only its scale moves, so its own opacity and colour stay.
 */
export function GrowIn({
  axis = "y",
  delay = 0,
  style,
  children,
}: PropsWithChildren<{
  axis?: "x" | "y";
  delay?: number;
  style?: StyleProp<ViewStyle>;
}>) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: motion.grow, easing: settle }),
    );
    // Grows once, when it first shows; later changes of size are immediate.
  }, []);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      axis === "y" ? { scaleY: progress.value } : { scaleX: progress.value },
    ],
  }));
  return (
    <Animated.View
      style={[
        { transformOrigin: axis === "y" ? "bottom" : "left" },
        style,
        animatedStyle,
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { alignItems: "center", justifyContent: "center" },
  grow: { transformOrigin: "left" },
});

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type ViewStyle,
} from "react-native";

import { colors, fonts } from "@/theme/tokens";

/**
 * Code replicas of system screens (Apple's Shortcuts, Android's Settings) for
 * the setup guides. A replica is laid out at the width of the phone it copies
 * (iPhone 15: 393 pt; Pixel 6: 411 dp) and scaled to fit, so it looks exactly
 * like a screenshot at any width while staying text and vector.
 */

type Rect = { x: number; y: number; width: number; height: number };

type ReplicaApi = {
  scale: number;
  root: React.RefObject<View | null>;
  register(n: number, rect: Rect): void;
  /** Re-measure when the replica reflows (a text that wraps moves what follows). */
  track(measure: () => void): () => void;
};

const ReplicaContext = createContext<ReplicaApi | null>(null);

function sameRect(a: Rect | undefined, b: Rect) {
  return (
    a !== undefined &&
    Math.abs(a.x - b.x) < 0.5 &&
    Math.abs(a.y - b.y) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

/** Text inside a replica: a picture, so it ignores Dynamic Type. */
export function MockText(props: TextProps) {
  return <Text allowFontScaling={false} {...props} />;
}

/**
 * The control to tap, ringed and numbered like the guide always did. The ring
 * is measured from this element's own layout, wherever it sits in the replica,
 * and drawn above every band so no band clips it (docs/ui-clarity-plan.md D10).
 */
export function Tap({
  n,
  style,
  children,
}: PropsWithChildren<{ n: number; style?: StyleProp<ViewStyle> }>) {
  const replica = useContext(ReplicaContext);
  const ref = useRef<View>(null);
  const measure = useCallback(() => {
    const root = replica?.root.current;
    if (!ref.current || !root) return;
    ref.current.measureLayout(root, (x, y, width, height) =>
      replica.register(n, { x, y, width, height }),
    );
  }, [n, replica]);
  useEffect(() => replica?.track(measure), [measure, replica]);
  return (
    <View collapsable={false} onLayout={measure} ref={ref} style={style}>
      {children}
    </View>
  );
}

function Ring({
  rect,
  index,
  numbered,
  scale,
  pulse,
}: {
  rect: Rect;
  index: number;
  numbered: boolean;
  scale: number;
  pulse: Animated.Value | null;
}) {
  // The ring keeps the guide's on-screen size (3 pt, radius 12) at any scale.
  const unit = 1 / scale;
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: rect.x - 3 * unit,
        top: rect.y - 3 * unit,
        width: rect.width + 6 * unit,
        height: rect.height + 6 * unit,
      }}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            borderWidth: 3 * unit,
            borderColor: colors.peach,
            borderRadius: 12 * unit,
            borderCurve: "continuous",
          },
          pulse
            ? {
                opacity: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 0.45],
                }),
              }
            : null,
        ]}
      />
      {numbered ? (
        <View
          style={{
            position: "absolute",
            left: -7 * unit,
            top: -7 * unit,
            width: 22 * unit,
            height: 22 * unit,
            borderRadius: 11 * unit,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.peach,
          }}
        >
          <Text
            allowFontScaling={false}
            style={{
              color: colors.graphite,
              fontFamily: fonts.brandSemiBold,
              fontSize: 12 * unit,
              lineHeight: 15 * unit,
            }}
          >
            {index}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Lays its children out at `width` and scales them to the available width.
 * Children are bands (see Band / BandGap) stacked top to bottom.
 */
export function Replica({ width, children }: { width: number; children: ReactNode }) {
  const root = useRef<View>(null);
  const [frameWidth, setFrameWidth] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [taps, setTaps] = useState<Record<number, Rect>>({});
  const [reduceMotion, setReduceMotion] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current;
  const measures = useRef(new Set<() => void>()).current;
  const scale = frameWidth > 0 ? frameWidth / width : 1;

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  // A ring can report its layout before the replica has finished mounting (or
  // after it unmounted): keep those measures and apply them once it is mounted.
  const mounted = useRef(false);
  const pending = useRef<Record<number, Rect>>({});
  const apply = useCallback((n: number, rect: Rect) => {
    setTaps((current) =>
      sameRect(current[n], rect) ? current : { ...current, [n]: rect },
    );
  }, []);
  useEffect(() => {
    mounted.current = true;
    for (const [n, rect] of Object.entries(pending.current)) apply(Number(n), rect);
    pending.current = {};
    return () => {
      mounted.current = false;
    };
  }, [apply]);
  const register = useCallback(
    (n: number, rect: Rect) => {
      if (mounted.current) apply(n, rect);
      else pending.current[n] = rect;
    },
    [apply],
  );

  const track = useCallback(
    (measure: () => void) => {
      measures.add(measure);
      return () => {
        measures.delete(measure);
      };
    },
    [measures],
  );

  const entries = Object.entries(taps).sort(([a], [b]) => Number(a) - Number(b));

  return (
    <View
      onLayout={(event) => setFrameWidth(event.nativeEvent.layout.width)}
      style={[styles.frame, contentHeight > 0 ? { height: contentHeight * scale } : null]}
    >
      <View
        collapsable={false}
        onLayout={(event) => {
          setContentHeight(event.nativeEvent.layout.height);
          // A band that grew moves the rings below it: measure them again.
          measures.forEach((measure) => measure());
        }}
        ref={root}
        style={{
          width,
          transformOrigin: "top left",
          transform: [{ scale }],
        }}
      >
        <ReplicaContext.Provider value={{ scale, root, register, track }}>
          {children}
        </ReplicaContext.Provider>
        {entries.map(([n, rect]) => (
          <Ring
            index={Number(n)}
            key={n}
            numbered={entries.length > 1}
            pulse={reduceMotion ? null : pulse}
            rect={rect}
            scale={scale}
          />
        ))}
      </View>
    </View>
  );
}

/** One horizontal slice of the copied screen, clipped like the original crop. */
export function Band({
  height,
  background,
  style,
  children,
}: PropsWithChildren<{
  height: number;
  background: string;
  style?: StyleProp<ViewStyle>;
}>) {
  return (
    <View style={[{ height, overflow: "hidden", backgroundColor: background }, style]}>
      {children}
    </View>
  );
}

/** The strip between two bands: "the screen continues here". */
export function BandGap() {
  return (
    <View style={styles.gap}>
      {[0, 1, 2].map((dot) => (
        <View key={dot} style={styles.dot} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: "100%", overflow: "hidden" },
  gap: {
    height: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "#D5D4DA",
  },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: "#74747F" },
});

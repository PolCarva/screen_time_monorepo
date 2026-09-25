import { useEffect, type ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import {
  AppIcon,
  EXAMPLE_APP,
  type GuideAppIcon,
} from "@/components/guide/app-icons";
import { sway } from "@/components/motion";
import { formatClockTime, localize } from "@/i18n";
import { colors, fonts } from "@/theme/tokens";

/**
 * The app the onboarding's demo opens: the user's most used app with its real
 * icon on Android when usage access was given, Instagram otherwise
 * (docs/onboarding-v2-plan.md, D10). The icon is only ever held in memory.
 */
export type DemoApp = {
  label: string;
  icon: { kind: "example"; name: GuideAppIcon } | { kind: "image"; uri: string };
};

export const EXAMPLE_DEMO_APP: DemoApp = {
  label: EXAMPLE_APP.name,
  icon: { kind: "example", name: EXAMPLE_APP.icon },
};

/** A phone's screen colour: dark, a little mineral, like a home screen at night. */
const SCREEN = "#2C3336";
const SCREEN_BACKGROUND =
  "linear-gradient(180deg, #3B454A 0%, #2C3336 45%, #242826 100%)";

export function DemoAppIcon({ app, size }: { app: DemoApp; size: number }) {
  if (app.icon.kind === "image") {
    return (
      <Image
        accessibilityIgnoresInvertColors
        source={{ uri: app.icon.uri }}
        style={{ width: size, height: size, borderRadius: size * 0.225 }}
      />
    );
  }
  return <AppIcon icon={app.icon.name} size={size} />;
}

/** Height of the replica status bar for a phone [width] wide. */
function statusHeight(width: number) {
  return 34 * (width / 280);
}

/** Room left under the fade, so content fitted to the visible part stays tappable. */
const FADE = 64;

/**
 * A generic phone (no maker's shape or logo) showing its top part; the rest
 * fades into the page. Its clock is the real time.
 */
export function PhoneFrame({
  width,
  visibleHeight,
  fit = false,
  children,
}: {
  width: number;
  /** How much of the phone shows before it fades out. */
  visibleHeight: number;
  /**
   * Fit the content to the visible part (above the fade) instead of the whole
   * phone: for the pause, whose buttons must be seen and tapped.
   */
  fit?: boolean;
  children: ReactNode;
}) {
  const bezel = Math.max(5, Math.round(width * 0.022));
  const fittedHeight =
    visibleHeight - bezel - statusHeight(width - bezel * 2) - FADE * 0.35;
  return (
    <View
      accessible={false}
      style={[styles.window, { width, height: visibleHeight }]}
    >
      <View
        style={[
          styles.phone,
          {
            width,
            height: width * 2.05,
            borderRadius: width * 0.14,
            borderWidth: bezel,
            experimental_backgroundImage: SCREEN_BACKGROUND,
          },
        ]}
      >
        <StatusRow width={width - bezel * 2} />
        <View style={fit ? { height: fittedHeight } : styles.screen}>
          {children}
        </View>
      </View>
      <View
        pointerEvents="none"
        style={[styles.fade, fit && styles.fadeShort]}
      />
    </View>
  );
}

function StatusRow({ width }: { width: number }) {
  const scale = width / 280;
  return (
    <View
      style={[
        styles.status,
        { height: statusHeight(width), paddingHorizontal: 22 * scale },
      ]}
    >
      <Text style={[styles.clock, { fontSize: 12 * scale }]}>
        {formatClockTime(new Date())}
      </Text>
      <View
        style={[
          styles.camera,
          { width: 11 * scale, height: 11 * scale, borderRadius: 6 * scale },
        ]}
      />
      <View style={[styles.indicators, { gap: 4 * scale }]}>
        {[5, 7, 9].map((height) => (
          <View
            key={height}
            style={[
              styles.signalBar,
              { width: 3 * scale, height: height * scale },
            ]}
          />
        ))}
        <View
          style={[
            styles.battery,
            { width: 18 * scale, height: 9 * scale, borderRadius: 2 * scale },
          ]}
        />
      </View>
    </View>
  );
}

const COLUMNS = 4;
/** The demo app sits in the second row, third column: room above for the arrow. */
const TARGET_INDEX = 6;
const CELLS = 16;

/**
 * A home screen of plain, unnamed icons with the demo app lit. No other real
 * app's logo is drawn (D10).
 */
export function HomeGrid({
  width,
  app,
  pointer = false,
  onPressApp,
}: {
  /** Width of the phone's screen. */
  width: number;
  app: DemoApp;
  /** Draws the arrow that points at the app. */
  pointer?: boolean;
  onPressApp?: () => void;
}) {
  const cell = width / COLUMNS;
  const icon = Math.round(cell * 0.62);
  return (
    <View style={[styles.grid, { paddingTop: cell * 0.2 }]}>
      {Array.from({ length: CELLS }, (_, index) => {
        const isTarget = index === TARGET_INDEX;
        return (
          <View
            key={index}
            style={[styles.cell, { width: cell, height: cell * 1.18 }]}
          >
            {isTarget ? (
              <Pressable
                accessibilityHint={localize(
                  "Opens the example app.",
                  "Abre la app de ejemplo.",
                )}
                accessibilityLabel={app.label}
                accessibilityRole="button"
                disabled={!onPressApp}
                hitSlop={8}
                onPress={onPressApp}
                style={({ pressed }) => [styles.target, pressed && styles.pressed]}
              >
                <DemoAppIcon app={app} size={icon} />
                <Text
                  numberOfLines={1}
                  style={[styles.appLabel, { fontSize: Math.max(9, cell * 0.14), maxWidth: cell }]}
                >
                  {app.label}
                </Text>
                {pointer ? <Pointer height={cell * 0.9} /> : null}
              </Pressable>
            ) : (
              <>
                <View
                  style={[
                    styles.plainIcon,
                    {
                      width: icon,
                      height: icon,
                      borderRadius: icon * 0.225,
                      opacity: index % 3 === 0 ? 0.16 : index % 2 === 0 ? 0.11 : 0.13,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.plainLabel,
                    { width: icon * 0.72, height: Math.max(3, cell * 0.06) },
                  ]}
                />
              </>
            )}
          </View>
        );
      })}
    </View>
  );
}

/** A peach arrow over the app, bobbing a little. */
function Pointer({ height }: { height: number }) {
  const reduceMotion = useReducedMotion();
  const phase = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    phase.value = withRepeat(withTiming(1, { duration: 900, easing: sway }), -1, true);
  }, [phase, reduceMotion]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: phase.value * 6 }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.pointer, { top: -height - 6, height }, style]}
    >
      <View style={[styles.pointerLine, { height: height - 12 }]} />
      <View style={styles.pointerHead} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  window: { overflow: "hidden", alignSelf: "center" },
  phone: {
    overflow: "hidden",
    borderColor: colors.graphite,
    backgroundColor: SCREEN,
  },
  screen: { flex: 1 },
  fade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: FADE,
    experimental_backgroundImage:
      "linear-gradient(180deg, rgba(241, 239, 232, 0) 0%, #F1EFE8 100%)",
  },
  fadeShort: { height: FADE * 0.35 },
  status: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  clock: { color: colors.white, fontFamily: fonts.brandSemiBold },
  camera: { backgroundColor: "#111413" },
  indicators: { flexDirection: "row", alignItems: "flex-end" },
  signalBar: { backgroundColor: colors.white, borderRadius: 1 },
  battery: { borderWidth: 1.5, borderColor: colors.white },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { alignItems: "center", gap: 6 },
  target: { alignItems: "center", gap: 6 },
  pressed: { opacity: 0.6 },
  appLabel: {
    color: colors.white,
    fontFamily: fonts.brandMedium,
    textAlign: "center",
  },
  plainIcon: { backgroundColor: colors.white },
  plainLabel: {
    borderRadius: 2,
    backgroundColor: "rgba(255, 253, 248, 0.14)",
  },
  pointer: { position: "absolute", alignItems: "center" },
  pointerLine: {
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.peach,
  },
  pointerHead: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 12,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: colors.peach,
  },
});

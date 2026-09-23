import { MaterialIcons } from "@expo/vector-icons";
import type { ComponentProps, PropsWithChildren } from "react";
import { View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

import { MockText } from "@/components/guide/replica";

/**
 * Pieces of Android 14's Settings (light theme) as the Pixel 6 emulator draws
 * them, measured on the captures the Android guide used to show. Sizes are dp
 * on a 411.43-dp-wide screen (1080 px at 2.625 px/dp).
 */
export const ANDROID = {
  background: "#F1F0F7",
  primary: "#495D92",
  onSurface: "#1A1B21",
  onSurfaceVariant: "#45464F",
  arrow: "#1F1F20",
  card: "#DAE2FF",
  onCard: "#001849",
  outline: "#757781",
  trackInner: "#E1E0E7",
  dialog: "#FAF8FF",
  divider: "#C6C6CD",
  iconBackground: "#F1EFE8",
  /** Black at 61% over the page: #F1F0F7 becomes #5E5E61. */
  scrim: "rgba(0, 0, 0, 0.61)",
} as const;

/** Roboto's ascent: where the first baseline sits below a text's top. */
export const ROBOTO_ASCENT = 0.928;

export function at(x: number, y: number, width?: number, height?: number): ViewStyle {
  return {
    position: "absolute",
    left: x,
    top: y,
    ...(width === undefined ? null : { width }),
    ...(height === undefined ? null : { height }),
  };
}

/** Text placed by its first baseline, without Android's font padding. */
export function ALine({
  x,
  baseline,
  size,
  color = ANDROID.onSurface,
  width,
  lineHeight,
  align = "left",
  style,
  onLines,
  children,
}: PropsWithChildren<{
  x: number;
  baseline: number;
  size: number;
  color?: string;
  /** Set to let the text wrap inside this width. */
  width?: number;
  lineHeight?: number;
  align?: "left" | "center";
  style?: StyleProp<TextStyle>;
  /** Reports how many lines the text wrapped to. */
  onLines?: (count: number) => void;
}>) {
  // With a line height, Android centers the glyphs in the line: the first
  // baseline moves down by half the extra leading.
  const natural = size * (ROBOTO_ASCENT + 0.244);
  const lead = lineHeight ? (lineHeight - natural) / 2 : 0;
  return (
    <View pointerEvents="none" style={at(x, baseline - size * ROBOTO_ASCENT - lead, width)}>
      <MockText
        numberOfLines={width ? undefined : 1}
        onTextLayout={onLines && ((event) => onLines(Math.max(1, event.nativeEvent.lines.length)))}
        style={[
          {
            color,
            fontSize: size,
            includeFontPadding: false,
            textAlign: align,
            ...(lineHeight ? { lineHeight } : null),
          },
          style,
        ]}
      >
        {children}
      </MockText>
    </View>
  );
}

/** A Material icon (the Settings app draws its glyphs from the same set). */
export function AIcon({
  name,
  size,
  color = ANDROID.onSurface,
  style,
}: {
  name: ComponentProps<typeof MaterialIcons>["name"];
  size: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View pointerEvents="none" style={style}>
      <MaterialIcons color={color} name={name} size={size} />
    </View>
  );
}

/**
 * Still's launcher icon as Android masks it: the adaptive icon's vector
 * (android/app/src/main/res/drawable/ic_launcher_foreground.xml, a 160-unit
 * viewport over 108 dp) inside a circle that shows its central 72 dp.
 */
const STILL_BARS: { x: number; y: number; color: string }[] = [
  { x: 45, y: 48, color: "#242826" },
  { x: 87, y: 48, color: "#242826" },
  { x: 39, y: 73, color: "#697F8C" },
  { x: 93, y: 73, color: "#D39A83" },
  { x: 45, y: 98, color: "#242826" },
  { x: 87, y: 98, color: "#242826" },
];

export function StillLauncherIcon({ size, style }: { size: number; style?: StyleProp<ViewStyle> }) {
  const unit = (size / 72) * (108 / 160);
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: "hidden",
          backgroundColor: ANDROID.iconBackground,
        },
        style,
      ]}
    >
      {STILL_BARS.map((bar) => (
        <View
          key={`${bar.x}-${bar.y}`}
          style={at(
            size / 2 + (bar.x - 80) * unit,
            size / 2 + (bar.y - 80) * unit,
            28 * unit,
            11 * unit,
          )}
        >
          <View style={{ flex: 1, backgroundColor: bar.color }} />
        </View>
      ))}
    </View>
  );
}

/** Android 14's Material switch, off: outlined track, small grey thumb. */
export function SwitchOffM3({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        {
          width: 55.62,
          height: 27.81,
          borderRadius: 13.9,
          borderWidth: 1.9,
          borderColor: ANDROID.outline,
          backgroundColor: ANDROID.trackInner,
        },
        style,
      ]}
    >
      <View
        style={{
          position: "absolute",
          left: 1.91,
          top: 1.91,
          width: 20.19,
          height: 20.19,
          borderRadius: 10.1,
          backgroundColor: "#767781",
        }}
      />
    </View>
  );
}

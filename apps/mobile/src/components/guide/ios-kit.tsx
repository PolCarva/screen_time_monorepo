import { SymbolView, type SFSymbol } from "expo-symbols";
import type { PropsWithChildren } from "react";
import {
  StyleSheet,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { MockText } from "@/components/guide/replica";

/**
 * Pieces of iOS 26 (light mode) as Apple's Shortcuts draws them, measured on
 * the iPhone 15 simulator captures the guide used to show. Colors are the
 * system's own values; sizes are points on a 393-pt-wide screen.
 */
export const IOS = {
  groupedBackground: "#F2F2F7",
  sheetBackdrop: "#C2C2C6",
  card: "#FFFFFF",
  glass: "#FBFBFF",
  label: "#000000",
  secondaryLabel: "rgba(60, 60, 67, 0.6)",
  tertiaryLabel: "rgba(60, 60, 67, 0.3)",
  separator: "rgba(60, 60, 67, 0.2)",
  blue: "#0087FE",
  blueGlyph: "#85FFFF",
  gray: "#8E8E93",
  gray2: "#AEAEB2",
  gray3: "#C7C7CC",
  gray4: "#D1D1D6",
  gray5: "#E5E5EA",
  searchFill: "rgba(118, 118, 128, 0.12)",
  tokenFill: "rgba(0, 136, 255, 0.12)",
  purple: "#6155F5",
  triggerGray: "#636366",
  bandGap: "#D5D4DA",
} as const;

/**
 * An SF Symbol (iOS only; the guides that use it are iOS only). It is drawn
 * to fit its frame: size × size, or width × height for wide symbols.
 */
export function Sym({
  name,
  size,
  width,
  height,
  color = IOS.label,
  weight = "regular",
  style,
}: {
  name: SFSymbol;
  size: number;
  width?: number;
  height?: number;
  color?: string;
  weight?: "light" | "regular" | "medium" | "semibold" | "bold";
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <SymbolView
      name={name}
      resizeMode="scaleAspectFit"
      size={size}
      style={[{ width: width ?? size, height: height ?? size }, style]}
      tintColor={color}
      type="monochrome"
      weight={weight}
    />
  );
}

/** System-font text as UIKit sets it (SF Pro, optical sizes by the OS). */
export function IText({
  size,
  weight = "400",
  color = IOS.label,
  style,
  children,
  numberOfLines,
}: PropsWithChildren<{
  size: number;
  weight?: "400" | "500" | "600" | "700";
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}>) {
  return (
    <MockText
      numberOfLines={numberOfLines}
      style={[{ fontSize: size, fontWeight: weight, color }, style]}
    >
      {children}
    </MockText>
  );
}

/** Top of a presented sheet: rounded corners over the dimmed screen behind. */
export function SheetTop({
  top,
  background = IOS.groupedBackground,
  backdrop = IOS.sheetBackdrop,
  radius = 38,
  inset = 0,
}: {
  /** Where the sheet's top edge sits, relative to the band. */
  top: number;
  background?: string;
  /** What shows around the corners: the dimmed screen or a sheet below. */
  backdrop?: string;
  radius?: number;
  /** A sheet at a medium detent floats a few points in from the sides. */
  inset?: number;
}) {
  return (
    <>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: backdrop }]} />
      <View
        style={{
          position: "absolute",
          top,
          left: inset,
          right: inset,
          bottom: -200,
          backgroundColor: background,
          borderTopLeftRadius: radius,
          borderTopRightRadius: radius,
          borderCurve: "continuous",
        }}
      />
    </>
  );
}

/** A glass circle button (back, close) as iOS 26 floats it over content. */
export function GlassCircle({
  symbol,
  size = 44,
  glyph = 21,
  shadow = "0 4px 24px rgba(0, 0, 0, 0.08)",
  fill = IOS.glass,
  style,
}: {
  symbol: SFSymbol;
  size?: number;
  glyph?: number;
  /** Glass casts a darker halo where the bar floats over scrolled content. */
  shadow?: string;
  /** Over a white sheet the glass reads pure white. */
  fill?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: fill,
          borderWidth: 0.67,
          borderColor: "#FFFFFF",
          boxShadow: shadow,
        },
        style,
      ]}
    >
      <Sym color="#19191D" name={symbol} size={glyph} weight="regular" />
    </View>
  );
}

/** The blue confirm button (✓) of an editor or chooser. */
export function ProminentCircle({
  size = 44,
  style,
}: {
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: IOS.blue,
          borderWidth: 0.67,
          borderColor: "rgba(133, 255, 255, 0.75)",
          boxShadow: "0 4px 18px rgba(0, 0, 0, 0.08)",
        },
        style,
      ]}
    >
      <Sym color={IOS.blueGlyph} name="checkmark" size={24} style={{ marginTop: 1 }} weight="regular" />
    </View>
  );
}

/** "Next" as a pill: grey while disabled, blue once it can be tapped. */
export function Pill({
  label,
  enabled,
  shadow = "0 4px 18px rgba(0, 0, 0, 0.07)",
  style,
}: {
  label: string;
  enabled: boolean;
  shadow?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          height: 43.7,
          paddingHorizontal: 11.17,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: enabled ? IOS.blue : "#CBCBCF",
          borderWidth: 0.67,
          borderColor: enabled ? "rgba(133, 255, 255, 0.75)" : "#E3E3E3",
          boxShadow: shadow,
        },
        style,
      ]}
    >
      <IText color={enabled ? IOS.blueGlyph : "#FFFFFF"} size={17} weight="600">
        {label}
      </IText>
    </View>
  );
}

/**
 * A rounded rhombus (a rounded square turned 45° and flattened), the shape of
 * Shortcuts' layers. Centered at (cx, cy) with half-width hw and half-height hh.
 */
export function Rhombus({
  cx,
  cy,
  hw,
  hh,
  radius = 0,
  color,
  gradient,
  style,
}: {
  cx: number;
  cy: number;
  hw: number;
  hh: number;
  radius?: number;
  color?: string;
  /** A CSS gradient; angles are in the unturned square (45deg reads left→right). */
  gradient?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const side = Math.SQRT2 * (hw + (Math.SQRT2 - 1) * radius);
  return (
    <View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: cx - side / 2,
          top: cy - side / 2,
          width: side,
          height: side,
          borderRadius: radius,
          backgroundColor: color,
          experimental_backgroundImage: gradient,
          transform: [{ scaleY: hh / hw }, { rotate: "45deg" }],
        },
        style,
      ]}
    />
  );
}

/** A white inset-grouped card. */
export function Card({
  style,
  children,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return (
    <View
      style={[
        { backgroundColor: IOS.card, borderRadius: 26, borderCurve: "continuous" },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** A search field: glass capsule (bottom bar) or grey fill (action sheet). */
export function SearchField({
  text,
  placeholder,
  typed = false,
  glass = false,
  clear = false,
  mic = false,
  leading = 14,
  trailing = 14,
  gap = 8,
  iconSize = 19,
  clearSize = 18,
  micSize = 19,
  textSize = 17,
  textWeight = "400",
  tint,
  fill,
  style,
}: {
  text?: string;
  placeholder?: string;
  typed?: boolean;
  glass?: boolean;
  clear?: boolean;
  mic?: boolean;
  /** Insets and icon gap differ between the bottom bar and the action sheet. */
  leading?: number;
  trailing?: number;
  gap?: number;
  iconSize?: number;
  clearSize?: number;
  micSize?: number;
  textSize?: number;
  textWeight?: "400" | "500";
  /** Glyph and placeholder grey; the system's differs per surface. */
  tint?: string;
  fill?: string;
  style?: StyleProp<ViewStyle>;
}) {
  // Glass tints its glyphs a touch darker than the plain system grey.
  const glyph = tint ?? (glass ? "#88888E" : IOS.gray);
  return (
    <View
      style={[
        {
          height: 44,
          borderRadius: 22,
          flexDirection: "row",
          alignItems: "center",
          paddingLeft: leading,
          paddingRight: trailing,
          gap,
          backgroundColor: fill ?? (glass ? IOS.glass : "#E3E3E8"),
          borderWidth: glass ? 0.67 : 0,
          borderColor: "#FFFFFF",
          boxShadow: glass ? "0 4px 24px rgba(0, 0, 0, 0.08)" : undefined,
        },
        style,
      ]}
    >
      <Sym color={glyph} name="magnifyingglass" size={iconSize} weight="medium" />
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
        {text ? (
          <IText size={textSize} weight={textWeight}>
            {text}
          </IText>
        ) : (
          <IText color={glyph} size={textSize} weight={textWeight}>
            {placeholder}
          </IText>
        )}
        {typed ? (
          <View style={{ width: 2, height: 22, marginLeft: -0.5, borderRadius: 1, backgroundColor: IOS.blue }} />
        ) : null}
      </View>
      {clear ? <Sym color={glyph} name="xmark.circle.fill" size={clearSize} /> : null}
      {mic ? <Sym color={glyph} name="mic" size={micSize} /> : null}
    </View>
  );
}

/** The round ⓘ on the right of an action result (SF Symbol "info"). */
export function InfoButton({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        {
          width: 22,
          height: 22,
          borderRadius: 11,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F2F2F7",
        },
        style,
      ]}
    >
      <Sym name="info" size={14.5} weight="semibold" />
    </View>
  );
}

/** The grey ⓧ that removes an action from the editor (a 22-pt circle). */
export function RemoveButton({ style }: { style?: StyleProp<ViewStyle> }) {
  // The symbol's circle is ~83% of its frame: a 26-pt symbol draws 22 pt.
  return (
    <View style={[{ width: 22, height: 22, alignItems: "center", justifyContent: "center" }, style]}>
      <Sym color="#DDDDDE" name="xmark.circle.fill" size={26} style={{ margin: -2 }} />
    </View>
  );
}

/** A floating menu (App name list, Variables…, the shortcut's title menu). */
export function Popover({
  style,
  children,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return (
    <View
      style={[
        {
          borderRadius: 34,
          backgroundColor: "#F6F7FB",
          borderWidth: 0.67,
          borderColor: "#FDFFFF",
          boxShadow: "0 8px 40px rgba(0, 0, 0, 0.12)",
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** An iOS 26 switch, off: grey track, flat white knob inset 2 pt. */
export function SwitchOff({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        {
          width: 63,
          height: 28,
          borderRadius: 14,
          padding: 2,
          backgroundColor: "#C5C5C7",
        },
        style,
      ]}
    >
      <View style={{ width: 36.8, height: 24, borderRadius: 12, backgroundColor: "#FFFFFF" }} />
    </View>
  );
}

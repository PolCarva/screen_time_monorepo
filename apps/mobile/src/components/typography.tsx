import { StyleSheet, Text, type TextProps } from "react-native";
import { colors, fonts, type } from "@/theme/tokens";

export function Eyebrow(props: TextProps) { return <Text selectable {...props} style={[styles.eyebrow, props.style]} />; }
export function Display(props: TextProps) { return <Text selectable {...props} style={[styles.display, props.style]} />; }
export function Heading(props: TextProps) { return <Text selectable {...props} style={[styles.heading, props.style]} />; }
export function Body(props: TextProps) { return <Text selectable {...props} style={[styles.body, props.style]} />; }
export function Mono(props: TextProps) { return <Text selectable {...props} style={[styles.mono, props.style]} />; }
export function Data(props: TextProps) { return <Text selectable {...props} style={[styles.data, props.style]} />; }

const styles = StyleSheet.create({
  eyebrow: {
    fontFamily: fonts.monoSemiBold,
    color: colors.muted,
    fontSize: type.label.fontSize,
    lineHeight: type.label.lineHeight,
    textTransform: "uppercase",
    letterSpacing: type.label.letterSpacing,
  },
  display: {
    fontFamily: fonts.brandSemiBold,
    color: colors.ink,
    fontSize: type.display.fontSize,
    lineHeight: type.display.lineHeight,
    letterSpacing: type.display.letterSpacing,
  },
  heading: {
    fontFamily: fonts.brandSemiBold,
    color: colors.ink,
    fontSize: type.heading.fontSize,
    lineHeight: type.heading.lineHeight,
    letterSpacing: type.heading.letterSpacing,
  },
  body: {
    fontFamily: fonts.brand,
    color: colors.ink,
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
  },
  mono: {
    fontFamily: fonts.mono,
    color: colors.ink,
    fontSize: type.bodySmall.fontSize,
    lineHeight: type.bodySmall.lineHeight,
    fontVariant: ["tabular-nums"],
  },
  data: {
    fontFamily: fonts.monoMedium,
    color: colors.ink,
    fontSize: type.data.fontSize,
    lineHeight: type.data.lineHeight,
    letterSpacing: type.data.letterSpacing,
    fontVariant: ["tabular-nums"],
  },
});

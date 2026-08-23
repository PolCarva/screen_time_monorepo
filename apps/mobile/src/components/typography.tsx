import { StyleSheet, Text, type TextProps } from "react-native";
import { colors, fonts } from "@/theme/tokens";

export function Eyebrow(props: TextProps) { return <Text {...props} style={[styles.eyebrow, props.style]} />; }
export function Display(props: TextProps) { return <Text {...props} style={[styles.display, props.style]} />; }
export function Body(props: TextProps) { return <Text {...props} style={[styles.body, props.style]} />; }

const styles = StyleSheet.create({
  eyebrow: { fontFamily: fonts.sansBold, color: colors.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1.6 },
  display: { fontFamily: fonts.display, color: colors.forest, fontSize: 42, lineHeight: 44, letterSpacing: -1.4 },
  body: { fontFamily: fonts.sans, color: colors.ink, fontSize: 15, lineHeight: 23 },
});

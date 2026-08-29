import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, radius } from "@/theme/tokens";

export function FieldApertureMark({
  size = 44,
  dark = false,
  style,
}: {
  size?: number;
  dark?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const unit = size / 12;
  const moduleWidth = unit * 4.4;
  const moduleHeight = unit * 1.85;
  const corner = Math.max(radius.xs, unit * 0.38);
  const ink = dark ? colors.chalk : colors.graphite;

  return (
    <View
      accessible
      accessibilityLabel="Still"
      style={[styles.root, { width: size, height: size }, style]}
    >
      <View style={[styles.module, { left: 0, top: 0, width: moduleWidth, height: moduleHeight, borderRadius: corner, backgroundColor: ink }]} />
      <View style={[styles.module, { left: unit * 5.6, top: 0, width: moduleWidth, height: moduleHeight, borderRadius: corner, backgroundColor: ink }]} />
      <View style={[styles.module, { left: -unit * 1.1, top: unit * 3.15, width: moduleWidth, height: moduleHeight, borderRadius: corner, backgroundColor: dark ? colors.mineralLight : colors.mineral }]} />
      <View style={[styles.module, { left: unit * 6.7, top: unit * 3.15, width: moduleWidth, height: moduleHeight, borderRadius: corner, backgroundColor: colors.peach }]} />
      <View style={[styles.module, { left: 0, top: unit * 6.3, width: moduleWidth, height: moduleHeight, borderRadius: corner, backgroundColor: ink }]} />
      <View style={[styles.module, { left: unit * 5.6, top: unit * 6.3, width: moduleWidth, height: moduleHeight, borderRadius: corner, backgroundColor: ink }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: "relative" },
  module: { position: "absolute" },
});

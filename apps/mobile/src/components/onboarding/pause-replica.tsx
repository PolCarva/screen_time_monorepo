import { Pressable, StyleSheet, Text, View } from "react-native";

import { FieldApertureMark } from "@/components/field-aperture-mark";
import { locale } from "@/i18n";
import {
  PAUSE_COPY,
  openedTodayHeadline,
  pauseDeclineLabel,
  type PausePlatform,
} from "@/lib/pause-copy";
import { colors, fonts } from "@/theme/tokens";

/**
 * The first screen of Still's pause, drawn small inside the onboarding's phone
 * with the real pause's own words (lib/pause-copy). iOS names the app on top
 * and breaks its headline; Android centres the mark over it.
 */
export function PauseReplica({
  platform,
  appLabel,
  attempts = 4,
  width,
  onDecline,
  onWatchAd,
}: {
  platform: PausePlatform;
  appLabel: string;
  attempts?: number;
  /** Width of the phone's screen. */
  width: number;
  onDecline: () => void;
  onWatchAd: () => void;
}) {
  const scale = width / 280;
  return (
    <View
      style={[
        styles.root,
        { paddingHorizontal: 20 * scale, paddingVertical: 14 * scale, gap: 8 * scale },
      ]}
    >
      {platform === "ios" ? (
        <Text style={[styles.appName, { fontSize: 9 * scale }]}>
          {appLabel.toUpperCase()}
        </Text>
      ) : null}
      <View style={[styles.mark, platform === "android" && styles.markCentered]}>
        <FieldApertureMark dark size={34 * scale} />
      </View>
      <Text
        style={[
          styles.headline,
          { fontSize: 21 * scale, lineHeight: 24 * scale },
          platform === "android" && styles.centered,
        ]}
      >
        {openedTodayHeadline(appLabel, attempts, platform, locale)}
      </Text>
      <Text
        style={[
          styles.question,
          { fontSize: 12 * scale, lineHeight: 17 * scale },
          platform === "android" && styles.centered,
        ]}
      >
        {PAUSE_COPY.question[locale]}
      </Text>
      <View style={styles.spacer} />
      <Pressable
        accessibilityRole="button"
        onPress={onDecline}
        style={({ pressed }) => [
          styles.primary,
          { minHeight: 40 * scale, borderRadius: 6 * scale },
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.primaryLabel, { fontSize: 13 * scale }]}>
          {pauseDeclineLabel(platform, locale)}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        hitSlop={6}
        onPress={onWatchAd}
        style={({ pressed }) => [
          styles.secondary,
          { minHeight: 34 * scale },
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.secondaryLabel, { fontSize: 13 * scale }]}>
          {PAUSE_COPY.watchAd[locale]}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.graphite },
  appName: {
    color: colors.mineralLight,
    fontFamily: fonts.brandSemiBold,
    letterSpacing: 1.1,
  },
  mark: { paddingVertical: 2 },
  markCentered: { alignItems: "center", paddingTop: 8 },
  headline: {
    color: colors.chalk,
    fontFamily: fonts.brandSemiBold,
    letterSpacing: -0.4,
  },
  question: { color: colors.mineralLight, fontFamily: fonts.brand },
  centered: { textAlign: "center" },
  spacer: { flexGrow: 1, minHeight: 8 },
  primary: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.chalk,
  },
  primaryLabel: { color: colors.graphite, fontFamily: fonts.brandSemiBold },
  secondary: { alignItems: "center", justifyContent: "center" },
  secondaryLabel: { color: colors.chalk, fontFamily: fonts.brandSemiBold },
  pressed: { opacity: 0.6 },
});

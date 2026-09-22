import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  ANDROID_GUIDE_IMAGES,
  type AndroidGuideId,
} from "@/components/android-guide-assets";
import { colors, fonts, radius, spacing } from "@/theme/tokens";

type AndroidGuideImageProps = {
  image: AndroidGuideId;
  accessibilityLabel: string;
  /** Says what tapping the picture does, e.g. "Open this screen". */
  actionLabel: string;
  onPress: () => void;
};

/**
 * A real capture of Android's Accessibility settings with the exact control to
 * tap ringed. The ring is drawn from a fraction in the generated manifest, never
 * burned into the image, so the pictures carry no annotations (mirrors the iOS
 * ShortcutGuideImage). The whole picture is a button.
 */
export function AndroidGuideImage({
  image,
  accessibilityLabel,
  actionLabel,
  onPress,
}: AndroidGuideImageProps) {
  const asset = ANDROID_GUIDE_IMAGES[image];
  const pulse = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

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

  const { highlight } = asset;

  return (
    <Pressable
      accessibilityHint={actionLabel}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="imagebutton"
      onPress={onPress}
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}
    >
      <View style={[styles.frame, { aspectRatio: asset.aspectRatio }]}>
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="cover"
          source={asset.source}
          style={styles.image}
        />
        <View
          pointerEvents="none"
          style={[
            styles.target,
            {
              left: `${highlight.x * 100}%`,
              top: `${highlight.y * 100}%`,
              width: `${highlight.width * 100}%`,
              height: `${highlight.height * 100}%`,
            },
          ]}
        >
          <Animated.View
            style={[
              styles.ring,
              reduceMotion
                ? null
                : {
                    opacity: pulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 0.45],
                    }),
                  },
            ]}
          />
        </View>
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerLabel}>{actionLabel}</Text>
        <Text style={styles.footerArrow}>↗</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.mineralLight,
    borderRadius: radius.modal,
    borderCurve: "continuous",
    backgroundColor: colors.white,
  },
  pressed: { opacity: 0.78 },
  frame: { width: "100%" },
  image: { width: "100%", height: "100%" },
  target: { position: "absolute" },
  ring: {
    position: "absolute",
    top: -3,
    right: -3,
    bottom: -3,
    left: -3,
    borderWidth: 3,
    borderColor: colors.peach,
    borderRadius: radius.lg,
    borderCurve: "continuous",
  },
  footer: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
    backgroundColor: colors.chalkRaised,
  },
  footerLabel: {
    flex: 1,
    color: colors.graphite,
    fontFamily: fonts.brandMedium,
    fontSize: 12,
  },
  footerArrow: { color: colors.mineral, fontSize: 15 },
});

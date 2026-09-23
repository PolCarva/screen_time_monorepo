import { Ionicons } from "@expo/vector-icons";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { FieldApertureMark } from "@/components/field-aperture-mark";
import { IOS, Rhombus, Sym } from "@/components/guide/ios-kit";

/**
 * App icons drawn in code for the guide replicas. Instagram is the example app
 * of every normal step and "Tilo" is the made-up app of the custom-app steps
 * (docs/ui-clarity-plan.md D8), so neither ever shows a real app of the user.
 */
export type GuideAppIcon =
  | "instagram"
  | "messages"
  | "still"
  | "shortcuts"
  | "tilo"
  | "trigger"
  | "openApp"
  | "currentApp";

/** Where each example app's name comes from; the name is not translated. */
export const EXAMPLE_APP = { name: "Instagram", icon: "instagram" } as const;
export const FAKE_APP = { name: "Tilo", icon: "tilo" } as const;

function mask(size: number, radius?: number): ViewStyle {
  return {
    width: size,
    height: size,
    borderRadius: radius ?? size * 0.225,
    borderCurve: "continuous",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  };
}

export function AppIcon({
  icon,
  size,
  radius,
  style,
}: {
  icon: GuideAppIcon;
  size: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  switch (icon) {
    case "instagram":
      return (
        <View
          style={[
            mask(size, radius),
            {
              experimental_backgroundImage:
                "radial-gradient(circle at 28% 107%, #FFDD55 0%, #FFDD55 10%, #FF543E 50%, #C837AB 100%)",
            },
            style,
          ]}
        >
          <View
            style={[
              { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
              {
                experimental_backgroundImage:
                  "radial-gradient(circle at -10% -8%, #3771C8 0%, #3771C8 12%, rgba(102, 0, 255, 0) 55%)",
              },
            ]}
          />
          <Ionicons color="#FFFFFF" name="logo-instagram" size={size * 0.68} />
        </View>
      );
    case "messages": {
      // iOS 26's Messages: an oval bubble, white fading to mint, and a tail at
      // its lower left (a sheared square tucked under the bubble, tip out).
      const bubble = size * 0.73;
      const tail = size / 29;
      return (
        <View
          style={[
            mask(size, radius),
            { experimental_backgroundImage: "linear-gradient(180deg, #57F170 0%, #25BF40 100%)" },
            style,
          ]}
        >
          <View
            style={{
              position: "absolute",
              left: 5.06 * tail,
              top: (22.53 - 3.99) * tail,
              width: 5.5 * tail,
              height: 3.99 * tail,
              borderBottomLeftRadius: 0.6 * tail,
              backgroundColor: "#A6E7B0",
              transformOrigin: "0% 100%",
              transform: [{ rotate: "-13.5deg" }, { skewX: "-27.6deg" }],
            }}
          />
          <View
            style={{
              position: "absolute",
              left: size * 0.135,
              top: size * 0.1885 - (bubble - size * 0.603) / 2,
              width: bubble,
              height: bubble,
              borderRadius: bubble / 2,
              transform: [{ scaleY: 0.603 / 0.73 }],
              experimental_backgroundImage: "linear-gradient(180deg, #FFFFFF 0%, #FFFFFF 12%, #9CE4A8 100%)",
            }}
          />
        </View>
      );
    }
    case "still": {
      // The app icon's geometry (assets/icon.png): the mark spans 56.7% of the
      // icon, centered. It is drawn large and scaled down so its corners keep
      // the icon's proportions instead of FieldApertureMark's 2-pt minimum.
      const unit = size * 0.04728;
      const drawn = 100;
      return (
        <View
          style={[
            mask(size, radius),
            // Large icons get iOS 26's bright rim.
            { backgroundColor: "#F1EFE8", borderWidth: size >= 40 ? 0.67 : 0, borderColor: "#FFFFF8" },
            style,
          ]}
        >
          <View
            style={{
              position: "absolute",
              left: size / 2 - 5 * unit,
              top: size / 2 - 4.075 * unit,
            }}
          >
            <FieldApertureMark
              size={drawn}
              style={{ transformOrigin: "top left", transform: [{ scale: (12 * unit) / drawn }] }}
            />
          </View>
        </View>
      );
    }
    case "shortcuts": {
      // iOS 26's Shortcuts: two glossy layers, pink over blue-to-pink.
      const u = size / 28.33;
      return (
        <View
          style={[
            mask(size, radius),
            { experimental_backgroundImage: "linear-gradient(180deg, #512997 0%, #2B1A65 100%)" },
            style,
          ]}
        >
          <Rhombus
            cx={14.17 * u}
            cy={17.25 * u}
            gradient="linear-gradient(45deg, #474AB0 0%, #8A5CC2 50%, #F489D8 100%)"
            hh={7.35 * u}
            hw={9.1 * u}
            radius={3.2 * u}
          />
          <Rhombus
            cx={14.17 * u}
            cy={10.85 * u}
            gradient="linear-gradient(45deg, #FF72A4 0%, #D24E92 55%, #9C3677 100%)"
            hh={7.35 * u}
            hw={9.17 * u}
            radius={3.2 * u}
            style={{ boxShadow: `0 ${u}px ${2.5 * u}px rgba(35, 12, 80, 0.45)` }}
          />
        </View>
      );
    }
    case "tilo":
      return (
        <View
          style={[
            mask(size, radius),
            { experimental_backgroundImage: "linear-gradient(160deg, #3CCFB0 0%, #16877F 100%)" },
            style,
          ]}
        >
          <Ionicons color="#FFFFFF" name="leaf" size={size * 0.58} />
        </View>
      );
    case "trigger":
      return (
        <View style={[mask(size, radius ?? size * 0.24), { backgroundColor: IOS.triggerGray }, style]}>
          <Sym color="#FFFFFF" name="arrow.up.right" size={size * 0.58} weight="semibold" />
        </View>
      );
    case "openApp":
      return (
        <View style={[mask(size, radius ?? size * 0.24), { backgroundColor: IOS.purple }, style]}>
          <Sym color="#FFFFFF" name="arrow.up.right" size={size * 0.58} weight="semibold" />
        </View>
      );
    case "currentApp":
      return (
        <View style={[mask(size, radius ?? size * 0.24), { backgroundColor: IOS.purple }, style]}>
          <Sym color="#FFFFFF" name="app.dashed" size={size * 0.66} weight="medium" />
        </View>
      );
  }
}

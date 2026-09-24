import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useEffect, useState } from "react";
import {
  Animated as NavigationAnimated,
  Easing as NavigationEasing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { t } from "@/i18n";
import { colors, fonts, spacing } from "@/theme/tokens";

/** Room between the bar's edge and the tabs (the bar's padding). */
const TAB_BAR_INSET = 4;

/**
 * Switching tabs: the old screen fades out in place while the new one fades
 * in and settles a few points from the side it sits on, never a full slide.
 */
function forSettle({ current }: {
  current: { progress: NavigationAnimated.Value };
}) {
  return {
    sceneStyle: {
      opacity: current.progress.interpolate({
        inputRange: [-1, -0.4, 0, 0.4, 1],
        outputRange: [0, 0, 1, 0, 0],
      }),
      transform: [
        {
          translateX: current.progress.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [-14, 0, 14],
          }),
        },
      ],
    },
  };
}

const androidTabs = [
  { name: "(today)", label: () => t("today"), icon: "clock-outline" },
  { name: "(impact)", label: () => t("impact"), icon: "receipt-text-outline" },
  { name: "(settings)", label: () => t("settings"), icon: "tune-variant" },
] as const;

function AndroidFloatingTabBar({
  state,
  navigation,
}: Parameters<NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]>>[0]) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [barWidth, setBarWidth] = useState(0);
  const tabWidth =
    barWidth > 0 ? (barWidth - TAB_BAR_INSET * 2) / state.routes.length : 0;
  // The selected tab's wash glides to the tab that was tapped.
  const position = useSharedValue(state.index);
  useEffect(() => {
    position.value = reduceMotion
      ? state.index
      : withSpring(state.index, { damping: 22, stiffness: 240, mass: 0.9 });
  }, [position, reduceMotion, state.index]);
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.value * tabWidth }],
  }));

  return (
    <View pointerEvents="box-none" style={styles.androidTabLayer}>
      <View
        accessibilityRole="tablist"
        onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
        style={[
          styles.androidTabBar,
          { marginBottom: Math.max(insets.bottom, spacing.sm) },
        ]}
      >
        {tabWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.androidTabIndicator, { width: tabWidth }, indicatorStyle]}
          />
        ) : null}
        {state.routes.map((route, index) => {
          const definition = androidTabs[index];
          if (!definition) return null;
          const selected = state.index === index;
          const label = definition.label();

          return (
            <Pressable
              accessibilityLabel={`${label}, tab, ${index + 1} of ${state.routes.length}`}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={route.key}
              onLongPress={() =>
                navigation.emit({ type: "tabLongPress", target: route.key })
              }
              onPress={() => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!selected && !event.defaultPrevented)
                  navigation.navigate(route.name);
              }}
              style={({ pressed }) => [
                styles.androidTab,
                selected && tabWidth === 0 && styles.androidTabSelected,
                pressed && styles.androidTabPressed,
              ]}
            >
              <MaterialCommunityIcons
                color={selected ? colors.mineral : colors.graphite}
                name={definition.icon}
                size={27}
              />
              <Text
                style={[
                  styles.androidTabLabel,
                  selected && styles.androidTabLabelSelected,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  if (Platform.OS === "android") {
    return (
      <Tabs
        backBehavior="history"
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.chalk },
          animation: "shift",
          sceneStyleInterpolator: forSettle,
          transitionSpec: {
            animation: "timing",
            config: {
              duration: 260,
              easing: NavigationEasing.bezier(0.2, 0, 0, 1),
            },
          },
        }}
        tabBar={(props) => <AndroidFloatingTabBar {...props} />}
      >
        {androidTabs.map((tab) => (
          <Tabs.Screen key={tab.name} name={tab.name} />
        ))}
      </Tabs>
    );
  }

  return (
    <NativeTabs minimizeBehavior="onScrollDown" tintColor={colors.mineral}>
      <NativeTabs.Trigger name="(today)">
        <NativeTabs.Trigger.Icon
          sf={{ default: "clock", selected: "clock.fill" }}
          md="schedule"
        />
        <NativeTabs.Trigger.Label>{t("today")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(impact)">
        <NativeTabs.Trigger.Icon
          sf={{
            default: "heart.text.square",
            selected: "heart.text.square.fill",
          }}
          md="receipt_long"
        />
        <NativeTabs.Trigger.Label>{t("impact")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(settings)">
        <NativeTabs.Trigger.Icon sf="slider.horizontal.3" md="tune" />
        <NativeTabs.Trigger.Label>{t("settings")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

const styles = StyleSheet.create({
  androidTabLayer: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
  },
  androidTabBar: {
    alignSelf: "stretch",
    height: 64,
    marginHorizontal: spacing.lg,
    padding: TAB_BAR_INSET,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: colors.white,
    borderRadius: 32,
    backgroundColor: "rgba(248, 246, 239, 0.96)",
    boxShadow: "0 10px 28px rgba(36, 40, 38, 0.16)",
    elevation: 8,
    overflow: "hidden",
  },
  androidTabIndicator: {
    position: "absolute",
    top: TAB_BAR_INSET,
    left: TAB_BAR_INSET,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(105, 127, 140, 0.14)",
  },
  androidTab: {
    flex: 1,
    minWidth: 0,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    borderRadius: 27,
  },
  androidTabSelected: { backgroundColor: "rgba(105, 127, 140, 0.14)" },
  androidTabPressed: { opacity: 0.58 },
  androidTabLabel: {
    color: colors.graphite,
    fontFamily: fonts.brandMedium,
    fontSize: 12,
    lineHeight: 15,
  },
  androidTabLabelSelected: { color: colors.mineral },
});

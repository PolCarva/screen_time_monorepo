import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { t } from "@/i18n";
import { colors, fonts, spacing } from "@/theme/tokens";

const androidTabs = [
  { name: "(today)", label: () => t("today"), icon: "clock-outline" },
  {
    name: "(tokens)",
    label: () => t("tokens"),
    icon: "ticket-confirmation-outline",
  },
  { name: "(impact)", label: () => t("impact"), icon: "receipt-text-outline" },
  { name: "(settings)", label: () => t("settings"), icon: "tune-variant" },
] as const;

function AndroidFloatingTabBar({
  state,
  navigation,
}: Parameters<NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]>>[0]) {
  const insets = useSafeAreaInsets();

  return (
    <View pointerEvents="box-none" style={styles.androidTabLayer}>
      <View
        accessibilityRole="tablist"
        style={[
          styles.androidTabBar,
          { marginBottom: Math.max(insets.bottom, spacing.sm) },
        ]}
      >
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
                selected && styles.androidTabSelected,
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
      <NativeTabs.Trigger name="(tokens)">
        <NativeTabs.Trigger.Icon
          sf={{ default: "ticket", selected: "ticket.fill" }}
          md="confirmation_number"
        />
        <NativeTabs.Trigger.Label>{t("tokens")}</NativeTabs.Trigger.Label>
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
    padding: 4,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: colors.white,
    borderRadius: 32,
    backgroundColor: "rgba(248, 246, 239, 0.96)",
    boxShadow: "0 10px 28px rgba(36, 40, 38, 0.16)",
    elevation: 8,
    overflow: "hidden",
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

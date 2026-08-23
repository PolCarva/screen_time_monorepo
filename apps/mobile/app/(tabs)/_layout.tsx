import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

import { t } from "@/i18n";
import { colors, fonts } from "@/theme/tokens";

const icons: Record<string, keyof typeof Ionicons.glyphMap> = { "(today)": "home-outline", "(tokens)": "time-outline", "(impact)": "heart-outline", "(settings)": "person-outline" };
export default function TabsLayout() {
  return <Tabs screenOptions={({ route }) => ({ headerShown: false, tabBarActiveTintColor: colors.forest, tabBarInactiveTintColor: "#999B95", tabBarStyle: { position: "absolute", height: 76, paddingTop: 9, paddingBottom: 12, margin: 14, borderRadius: 22, borderTopWidth: 0, backgroundColor: "rgba(255,253,249,.96)", shadowColor: colors.ink, shadowOpacity: .1, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } }, tabBarLabelStyle: { fontFamily: fonts.sansMedium, fontSize: 10 }, tabBarIcon: ({ color, size }) => <Ionicons name={icons[route.name] ?? "ellipse-outline"} color={color} size={size} /> })}>
    <Tabs.Screen name="(today)" options={{ title: t("today") }} />
    <Tabs.Screen name="(tokens)" options={{ title: t("tokens") }} />
    <Tabs.Screen name="(impact)" options={{ title: t("impact") }} />
    <Tabs.Screen name="(settings)" options={{ title: t("settings") }} />
  </Tabs>;
}

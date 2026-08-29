import { NativeTabs } from "expo-router/unstable-native-tabs";

import { t } from "@/i18n";
import { colors } from "@/theme/tokens";

export default function TabsLayout() {
  return (
    <NativeTabs minimizeBehavior="onScrollDown" tintColor={colors.signal}>
      <NativeTabs.Trigger name="(today)">
        <NativeTabs.Trigger.Icon sf={{ default: "clock", selected: "clock.fill" }} md="schedule" />
        <NativeTabs.Trigger.Label>{t("today")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(tokens)">
        <NativeTabs.Trigger.Icon sf={{ default: "ticket", selected: "ticket.fill" }} md="confirmation_number" />
        <NativeTabs.Trigger.Label>{t("tokens")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(impact)">
        <NativeTabs.Trigger.Icon sf={{ default: "heart.text.square", selected: "heart.text.square.fill" }} md="receipt_long" />
        <NativeTabs.Trigger.Label>{t("impact")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(settings)">
        <NativeTabs.Trigger.Icon sf="slider.horizontal.3" md="tune" />
        <NativeTabs.Trigger.Label>{t("settings")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

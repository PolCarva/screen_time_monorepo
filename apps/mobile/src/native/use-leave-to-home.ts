import { router } from "expo-router";
import { useCallback } from "react";
import { Linking } from "react-native";

import { capture } from "@/lib/analytics";
import { leaveToHome } from "@/lib/leave-to-home";
import { getJson, setJson } from "@/lib/storage";

const HOME_SHORTCUT_KEY = "iosHomeShortcutInstalled";

export function getHomeShortcutInstalled() {
  return getJson<boolean>(HOME_SHORTCUT_KEY, false);
}

export function setHomeShortcutInstalled(installed: boolean) {
  return setJson(HOME_SHORTCUT_KEY, installed);
}

/** Ends a declined pause on the iOS Home Screen, or as close to it as iOS allows. */
export function useLeaveToHome() {
  return useCallback(async () => {
    const outcome = await leaveToHome({
      homeShortcutInstalled: await getHomeShortcutInstalled().catch(
        () => false,
      ),
      resetNavigation: () => router.replace("/"),
      openUrl: (url) => Linking.openURL(url),
      showManualExit: () => router.push("/leave"),
    });
    capture("intervention_left", { outcome, trigger: "ios_shortcut" });
    return outcome;
  }, []);
}

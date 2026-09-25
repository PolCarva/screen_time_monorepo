import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  UsagePermissionStep,
  type UsagePermissionState,
} from "@/components/onboarding/usage-steps";
import { useStillSheet } from "@/components/still-sheet";
import { localize } from "@/i18n";
import { restrictionEngine } from "@/native/restriction-engine";
import { useAppState } from "@/state/app-state";
import { refreshSavedTime } from "@/state/saved-time";
import { colors, spacing } from "@/theme/tokens";

/**
 * Today's "Use my real usage" (docs/real-savings-estimate-plan.md, D9): the
 * onboarding's usage screen, which is Google Play's prominent disclosure,
 * shown before Settings. Once access is on, Today counts with the phone's
 * own sessions; without it, nothing changes.
 */
export default function UsageAccessScreen() {
  const insets = useSafeAreaInsets();
  const sheet = useStillSheet();
  const { config } = useAppState();
  const [state, setState] = useState<UsagePermissionState>("idle");
  const requested = useRef(false);

  const granted = useCallback(async () => {
    await refreshSavedTime(config.estimatedMinutesPerAvoidedOpen, { force: true }).catch(
      () => null,
    );
    sheet.toast({
      message: localize(
        "Today now counts with your own sessions.",
        "Hoy ya cuenta con tus propias sesiones.",
      ),
      tone: "success",
    });
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/(today)");
  }, [config.estimatedMinutesPerAvoidedOpen, sheet]);

  // Settings is left without a result: check again on the way back.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active" || !requested.current) return;
      void restrictionEngine
        .hasUsageAccess?.()
        .then((on) => (on ? granted() : setState("denied")))
        .catch(() => setState("denied"));
    });
    return () => subscription.remove();
  }, [granted]);

  const request = async () => {
    if (await restrictionEngine.hasUsageAccess?.().catch(() => false)) {
      await granted();
      return;
    }
    const opened = await restrictionEngine.openUsageAccessSettings?.().catch(() => false);
    requested.current = Boolean(opened);
    setState(opened ? "waiting" : "denied");
  };

  return (
    <View
      style={[
        styles.screen,
        {
          // The onboarding frame's margins, without its progress bar.
          paddingTop: insets.top + spacing.md,
          paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.xs,
          paddingLeft: insets.left + spacing.lg,
          paddingRight: insets.right + spacing.lg,
        },
      ]}
    >
      <UsagePermissionStep
        onGrant={() => void request()}
        onSkip={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/(today)"))}
        state={state}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
});

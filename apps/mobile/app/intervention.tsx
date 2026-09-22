import { Redirect, useLocalSearchParams } from "expo-router";

import { ShortcutIntervention } from "@/components/shortcut-intervention";
import { localize } from "@/i18n";
import { useLeaveToHome } from "@/native/use-leave-to-home";

/**
 * The only in-app intervention screen is the iOS Shortcuts pause, which arrives
 * with a `shortcutId`. On Android the shield, the ad and the decision are fully
 * native (see `InterventionActivity`), so there is no longer a React Native
 * intervention to jump to; any stray navigation here returns to Today.
 */
export default function InterventionScreen() {
  const { app, attempts, shortcutId, setupTest } = useLocalSearchParams<{
    app?: string;
    attempts?: string;
    shortcutId?: string;
    setupTest?: string;
  }>();

  const leaveToHome = useLeaveToHome();

  if (!shortcutId) return <Redirect href="/(tabs)/(today)" />;

  const parsed = Number.parseInt(attempts ?? "", 10);
  return (
    <ShortcutIntervention
      appLabel={app || localize("Selected app", "App seleccionada")}
      attempts={Number.isFinite(parsed) && parsed > 0 ? parsed : 1}
      isSetupTest={setupTest === "1"}
      onLeave={async () => {
        await leaveToHome();
      }}
      shortcutId={shortcutId}
    />
  );
}

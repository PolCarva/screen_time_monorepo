import {
  Recursive_400Regular,
  Recursive_500Medium,
  Recursive_600SemiBold,
  Recursive_700Bold,
  useFonts,
} from "@expo-google-fonts/recursive";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useMemo, useRef } from "react";
import { StatusBar } from "expo-status-bar";
import { AppState, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import {
  notNowAction,
  StillSheetProvider,
  useStillSheet,
} from "@/components/still-sheet";
import { localize } from "@/i18n";
import { initializeObservability } from "@/lib/analytics";
import { getJson, setJson } from "@/lib/storage";
import { restrictionEngine } from "@/native/restriction-engine";
import { AppStateProvider, useAppState } from "@/state/app-state";
import { RewardAdProvider } from "@/state/reward-ad-state";
import { ShortcutTargetsProvider } from "@/state/shortcut-targets";
import { colors } from "@/theme/tokens";

void SplashScreen.preventAutoHideAsync();
void initializeObservability();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** "Not now" on the notice prompt holds it back for a week. */
const NOTIFICATION_PROMPT_SNOOZE_KEY = "notificationPromptSnoozedUntil";
const NOTIFICATION_PROMPT_SNOOZE_MS = 7 * 24 * 60 * 60 * 1_000;

function Navigation() {
  const router = useRouter();
  // Typed routes are generated locally but not in CI, where the tuple would be
  // narrower; the checks below only need the segments as strings.
  const segments: readonly string[] = useSegments();
  // Groups vanish from the pathname, so Today and onboarding are both "/".
  const onToday = segments[0] === "(tabs)" && segments[1] === "(today)";
  const sheet = useStillSheet();
  const { onboarded, hydrated } = useAppState();
  const lastShortcutIntervention = useRef<string | null>(null);
  const noticePromptShown = useRef(false);

  // Only iOS posts a notice (the second an access window ends), so only iOS
  // asks, and only after saying what it is for. Asked on Today, once setup is
  // behind the user.
  useEffect(() => {
    if (!onboarded || Platform.OS !== "ios" || !onToday) return;
    if (noticePromptShown.current) return;
    noticePromptShown.current = true;
    void (async () => {
      const current = await Notifications.getPermissionsAsync();
      if (current.status !== "undetermined") return;
      const snoozedUntil = await getJson<number>(
        NOTIFICATION_PROMPT_SNOOZE_KEY,
        0,
      );
      if (Date.now() < snoozedUntil) return;
      const choice = await sheet.show({
        title: localize(
          "We'll tell you when your time is up",
          "Te avisamos cuando termina tu tiempo",
        ),
        message: localize(
          "A notice the exact second the pause comes back.",
          "Un aviso en el segundo exacto en que vuelve la pausa.",
        ),
        actions: [
          {
            label: localize("Turn on notices", "Activar avisos"),
            variant: "signal",
          },
          notNowAction(),
        ],
      });
      if (choice === 0) {
        await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowSound: true },
        });
      } else {
        await setJson(
          NOTIFICATION_PROMPT_SNOOZE_KEY,
          Date.now() + NOTIFICATION_PROMPT_SNOOZE_MS,
        );
      }
    })().catch(() => undefined);
  }, [onboarded, onToday, sheet]);

  useEffect(() => {
    if (!hydrated) return;
    const checkPendingShortcut = async () => {
      if (Platform.OS !== "ios") return false;
      const pending = await restrictionEngine
        .getPendingShortcutIntervention()
        .catch(() => null);
      if (!pending || pending.id === lastShortcutIntervention.current)
        return Boolean(pending);
      lastShortcutIntervention.current = pending.id;
      router.replace({
        pathname: "/intervention",
        params: {
          app: pending.appName,
          attempts: String(pending.attemptsToday),
          shortcutId: pending.id,
          setupTest: pending.isSetupTest ? "1" : "0",
        },
      });
      return true;
    };
    // The Screen Time shield's "recharge" flow led to the Passes tab; passes
    // are gone and iOS pauses through Shortcuts (docs/ads-only-pause-plan.md).
    const appStateSubscription = AppState.addEventListener(
      "change",
      (state) => {
        if (state === "active") void checkPendingShortcut();
      },
    );
    void checkPendingShortcut();
    return () => {
      appStateSubscription.remove();
    };
  }, [hydrated, router]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.chalk },
        // iOS keeps its native push; Android gets a short rise-and-fade,
        // the same on every OEM skin, instead of each skin's own default.
        animation: Platform.OS === "android" ? "fade_from_bottom" : "default",
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="auth/callback" />
      <Stack.Screen name="ios-apps" />
      <Stack.Screen name="shortcut-setup" />
      <Stack.Screen name="shortcut-repair" />
      <Stack.Screen name="setup" />
      <Stack.Screen name="android-setup" />
      <Stack.Screen name="android-repair" />
      <Stack.Screen name="usage-access" />
      <Stack.Screen name="savings" />
      <Stack.Screen
        name="leave"
        options={{ animation: "fade", gestureEnabled: false }}
      />
      <Stack.Screen
        name="intervention"
        options={{ presentation: "fullScreenModal", gestureEnabled: false }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Recursive_400Regular,
    Recursive_500Medium,
    Recursive_600SemiBold,
    Recursive_700Bold,
  });
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 60_000, retry: 2 } },
      }),
    [],
  );
  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync();
  }, [fontsLoaded]);
  if (!fontsLoaded) return null;
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AppStateProvider>
          <RewardAdProvider>
            <ShortcutTargetsProvider>
              <StillSheetProvider>
                <StatusBar style="dark" />
                <Navigation />
              </StillSheetProvider>
            </ShortcutTargetsProvider>
          </RewardAdProvider>
        </AppStateProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

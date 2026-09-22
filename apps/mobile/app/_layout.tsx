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
import {
  restrictionEngine,
  restrictionEvents,
} from "@/native/restriction-engine";
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
  const segments = useSegments();
  // Groups vanish from the pathname, so Today and onboarding are both "/".
  const onToday = segments[0] === "(tabs)" && segments[1] === "(today)";
  const sheet = useStillSheet();
  const { onboarded, walletHydrated } = useAppState();
  const lastRechargeNavigation = useRef(0);
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
    if (!walletHydrated) return;
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
    const openRecharge = (source: string, requestId: string) => {
      const now = Date.now();
      if (now - lastRechargeNavigation.current < 3_000) return;
      lastRechargeNavigation.current = now;
      router.replace({
        pathname: "/(tabs)/(tokens)",
        params: {
          recharge: requestId,
          rechargeSource: source,
          autoUnlock: "1",
        },
      } as never);
    };
    const checkPendingRecharge = async (
      source = "shield",
      openTokensWhenStale = false,
    ) => {
      const pending = await restrictionEngine
        .hasPendingIntervention()
        .catch(() => null);
      if (pending) openRecharge(source, pending);
      else if (openTokensWhenStale) router.replace("/(tabs)/(tokens)" as never);
    };
    const subscription = restrictionEvents?.addListener(
      "onInterventionRequested",
      () => void checkPendingRecharge("native-event"),
    );
    const appStateSubscription = AppState.addEventListener(
      "change",
      (state) => {
        if (state === "active") {
          void checkPendingShortcut().then((opened) => {
            if (!opened) void checkPendingRecharge("foreground");
          });
        }
      },
    );
    const notificationSubscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        if (response.notification.request.content.data?.route === "tokens")
          void checkPendingRecharge("notification", true);
      });
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response?.notification.request.content.data?.route !== "tokens")
        return;
      void Notifications.clearLastNotificationResponseAsync();
      void checkPendingRecharge("cold-notification", true);
    });
    void checkPendingShortcut().then((opened) => {
      if (!opened) void checkPendingRecharge();
    });
    return () => {
      subscription?.remove();
      appStateSubscription.remove();
      notificationSubscription.remove();
    };
  }, [router, walletHydrated]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.chalk },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="auth/callback" />
      <Stack.Screen name="ios-apps" />
      <Stack.Screen name="shortcut-setup" />
      <Stack.Screen name="shortcut-repair" />
      <Stack.Screen name="android-setup" />
      <Stack.Screen name="android-repair" />
      <Stack.Screen name="unlock-ready" />
      <Stack.Screen name="leave" options={{ gestureEnabled: false }} />
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

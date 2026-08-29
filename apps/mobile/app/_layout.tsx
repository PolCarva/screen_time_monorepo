import {
  FamiljenGrotesk_400Regular,
  FamiljenGrotesk_500Medium,
  FamiljenGrotesk_600SemiBold,
  FamiljenGrotesk_700Bold,
  useFonts as useBrandFonts,
} from "@expo-google-fonts/familjen-grotesk";
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
  useFonts as useMonoFonts,
} from "@expo-google-fonts/ibm-plex-mono";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useMemo, useRef } from "react";
import { StatusBar } from "expo-status-bar";
import { AppState, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { initializeObservability } from "@/lib/analytics";
import {
  restrictionEngine,
  restrictionEvents,
} from "@/native/restriction-engine";
import { AppStateProvider, useAppState } from "@/state/app-state";
import { RewardAdProvider } from "@/state/reward-ad-state";
import { colors } from "@/theme/tokens";

void SplashScreen.preventAutoHideAsync();
initializeObservability();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function Navigation() {
  const router = useRouter();
  const { onboarded, walletHydrated } = useAppState();
  const lastRechargeNavigation = useRef(0);

  useEffect(() => {
    if (!onboarded || Platform.OS === "web") return;
    void (async () => {
      const current = await Notifications.getPermissionsAsync();
      if (current.status === "undetermined") {
        await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowSound: true },
        });
      }
    })();
  }, [onboarded]);

  useEffect(() => {
    if (!walletHydrated) return;
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
      if (pending) {
        openRecharge(source, pending);
      } else if (openTokensWhenStale) {
        router.replace("/(tabs)/(tokens)" as never);
      }
    };
    const subscription = restrictionEvents?.addListener(
      "onInterventionRequested",
      () => void checkPendingRecharge("native-event"),
    );
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void checkPendingRecharge("foreground");
    });
    const notificationSubscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        if (response.notification.request.content.data?.route !== "tokens") {
          return;
        }
        void checkPendingRecharge("notification", true);
      });
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response?.notification.request.content.data?.route !== "tokens") {
        return;
      }
      void Notifications.clearLastNotificationResponseAsync();
      void checkPendingRecharge("cold-notification", true);
    });
    void checkPendingRecharge();
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
        contentStyle: { backgroundColor: colors.paper },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="unlock-ready" />
      <Stack.Screen
        name="intervention"
        options={{ presentation: "fullScreenModal", gestureEnabled: false }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [brandLoaded] = useBrandFonts({
    FamiljenGrotesk_400Regular,
    FamiljenGrotesk_500Medium,
    FamiljenGrotesk_600SemiBold,
    FamiljenGrotesk_700Bold,
  });
  const [monoLoaded] = useMonoFonts({
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 60_000, retry: 2 } },
      }),
    [],
  );
  useEffect(() => {
    if (brandLoaded && monoLoaded) void SplashScreen.hideAsync();
  }, [brandLoaded, monoLoaded]);
  if (!brandLoaded || !monoLoaded) return null;
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AppStateProvider>
          <RewardAdProvider>
            <StatusBar style="dark" />
            <Navigation />
          </RewardAdProvider>
        </AppStateProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

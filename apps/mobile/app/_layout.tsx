import { CormorantGaramond_500Medium, CormorantGaramond_600SemiBold, useFonts as useDisplayFonts } from "@expo-google-fonts/cormorant-garamond";
import { Inter_400Regular, Inter_500Medium, Inter_700Bold, useFonts as useSansFonts } from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useMemo } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { initializeObservability } from "@/lib/analytics";
import { restrictionEngine, restrictionEvents } from "@/native/restriction-engine";
import { AppStateProvider } from "@/state/app-state";

void SplashScreen.preventAutoHideAsync();
initializeObservability();

function Navigation() {
  const router = useRouter();
  useEffect(() => {
    const subscription = restrictionEvents?.addListener("onInterventionRequested", () => router.push("/intervention" as never));
    void restrictionEngine.hasPendingIntervention().then((pending) => {
      if (pending) router.push("/intervention" as never);
    });
    return () => subscription?.remove();
  }, [router]);
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#F6F4F1" } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="intervention" options={{ presentation: "fullScreenModal", gestureEnabled: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [displayLoaded] = useDisplayFonts({ CormorantGaramond_500Medium, CormorantGaramond_600SemiBold });
  const [sansLoaded] = useSansFonts({ Inter_400Regular, Inter_500Medium, Inter_700Bold });
  const queryClient = useMemo(() => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 2 } } }), []);
  useEffect(() => { if (displayLoaded && sansLoaded) void SplashScreen.hideAsync(); }, [displayLoaded, sansLoaded]);
  if (!displayLoaded || !sansLoaded) return null;
  return <SafeAreaProvider><QueryClientProvider client={queryClient}><AppStateProvider><StatusBar style="dark" /><Navigation /></AppStateProvider></QueryClientProvider></SafeAreaProvider>;
}

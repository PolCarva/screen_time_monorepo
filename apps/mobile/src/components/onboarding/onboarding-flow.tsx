import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  BackHandler,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import Animated from "react-native-reanimated";

import { slideIn } from "@/components/motion";
import {
  AdultStep,
  PausesOffStep,
} from "@/components/onboarding/basic-setup-steps";
import { EXAMPLE_DEMO_APP, type DemoApp } from "@/components/onboarding/phone";
import {
  OnboardingChrome,
  StoryFooter,
  StoryLayout,
} from "@/components/onboarding/story-screen";
import {
  GuessStep,
  HabitStep,
  HowStep,
  LifeStep,
  PauseDemoStep,
  WhereStep,
} from "@/components/onboarding/story-steps";
import {
  RevealStep,
  UsagePermissionStep,
  type UsagePermissionState,
} from "@/components/onboarding/usage-steps";
import {
  closeAction,
  retryAction,
  useStillSheet,
} from "@/components/still-sheet";
import { localize } from "@/i18n";
import {
  firstSetupStep,
  isStoryStep,
  nextStep,
  previousStep,
  resolveStep,
  stepProgress,
  type FlowContext,
  type OnboardingProgress,
  type OnboardingStepId,
} from "@/lib/onboarding-flow";
import {
  usageInsights,
  type UsageInsights,
} from "@/lib/onboarding-insights";
import { isPauseFeatureEnabled } from "@/lib/restriction-mode";
import { restrictionEngine } from "@/native/restriction-engine";
import { useAppState } from "@/state/app-state";
import {
  clearOnboardingProgress,
  loadOnboardingProgress,
  saveOnboardingProgress,
} from "@/state/onboarding-progress";
import { colors } from "@/theme/tokens";

/**
 * The whole onboarding: the story, then the setup (docs/onboarding-v2-plan.md
 * §2). lib/onboarding-flow decides which step comes next; this component only
 * draws the current one and remembers where the user is.
 */
export function OnboardingFlow() {
  const { config, hydrated, setOnboarded } = useAppState();
  const sheet = useStillSheet();
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const progressRef = useRef<OnboardingProgress | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);
  // False until the first step change: the first step arrives with the screen.
  const [moved, setMoved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [usagePermission, setUsagePermission] =
    useState<UsagePermissionState>("idle");
  // Read once, held in memory, never stored (D4). Undefined while reading.
  const [insights, setInsights] = useState<UsageInsights | null | undefined>();
  const [icons, setIcons] = useState<Record<string, string>>({});

  useEffect(() => {
    void loadOnboardingProgress().then((loaded) => {
      progressRef.current = loaded;
      setProgress(loaded);
    });
  }, []);

  const platform = Platform.OS === "ios" ? "ios" : "android";
  const usageSource =
    Platform.OS === "android" && restrictionEngine.getUsageSummary
      ? "android-usage"
      : "none";
  const context = useMemo<FlowContext | null>(
    () =>
      progress && {
        platform,
        pausesEnabled: isPauseFeatureEnabled(Platform.OS, config),
        usageSource,
        usageGranted: progress.usage === "granted",
        adsConsent: "not-required",
        aggressiveOem: false,
      },
    [config, platform, progress, usageSource],
  );

  // Once usage access is granted, read the week (again after a restart: it
  // is never stored).
  const usageGranted = progress?.usage === "granted";
  useEffect(() => {
    if (!usageGranted || insights !== undefined) return;
    let cancelled = false;
    restrictionEngine.getUsageSummary!()
      .then((summary) => {
        if (!cancelled) setInsights(usageInsights(summary));
      })
      .catch(() => {
        if (!cancelled) setInsights(null);
      });
    return () => {
      cancelled = true;
    };
  }, [insights, usageGranted]);

  // Then the icons of the most used apps, for the bars and the demo (D10).
  useEffect(() => {
    const apps = insights?.topApps ?? [];
    if (apps.length === 0) return;
    let cancelled = false;
    void (async () => {
      const loaded: Record<string, string> = {};
      for (const app of apps) {
        const uri = await restrictionEngine
          .getAppIcon?.(app.packageName, 48)
          .catch(() => null);
        if (uri) loaded[app.packageName] = uri;
      }
      if (!cancelled) setIcons(loaded);
    })();
    return () => {
      cancelled = true;
    };
  }, [insights]);

  const update = useCallback((patch: Partial<OnboardingProgress>) => {
    const current = progressRef.current;
    if (!current) return;
    const next = { ...current, ...patch };
    progressRef.current = next;
    setProgress(next);
    void saveOnboardingProgress(next);
  }, []);

  const step: OnboardingStepId | null =
    context && progress ? resolveStep(context, progress.step) : null;

  const goTo = useCallback(
    (target: OnboardingStepId, towards: 1 | -1) => {
      setDirection(towards);
      setMoved(true);
      update({ step: target });
    },
    [update],
  );

  const goNext = useCallback(() => {
    if (!context || !step) return;
    const target = nextStep(context, step);
    if (target) goTo(target, 1);
  }, [context, goTo, step]);

  const goBack = useCallback(() => {
    if (!context || !step) return false;
    const target = previousStep(context, step);
    if (!target) return false;
    goTo(target, -1);
    return true;
  }, [context, goTo, step]);

  /** The user granted usage access: straight to the reveal. */
  const usageGrantedNow = useCallback(() => {
    setUsagePermission("idle");
    setInsights(undefined);
    setDirection(1);
    setMoved(true);
    update({ usage: "granted", usageRequestedAt: undefined, step: "reveal" });
  }, [update]);

  // Back from Settings, or Still started again after the system killed it
  // there: once Settings was opened, check Usage access on every return
  // (§3.2, §5.1, D9).
  const usageRequested = Boolean(progress?.usageRequestedAt);
  const usagePermissionRef = useRef(usagePermission);
  usagePermissionRef.current = usagePermission;
  useEffect(() => {
    if (step !== "usage-permission" || !usageRequested) return;
    const check = () =>
      void restrictionEngine
        .hasUsageAccess?.()
        .then((granted) =>
          granted ? usageGrantedNow() : setUsagePermission("denied"),
        )
        .catch(() => setUsagePermission("denied"));
    // Right after opening Settings Still is still in front: wait for the return.
    if (
      AppState.currentState === "active" &&
      usagePermissionRef.current !== "waiting"
    ) {
      check();
    }
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => subscription.remove();
  }, [step, usageGrantedNow, usageRequested]);

  async function requestUsageAccess() {
    if (await restrictionEngine.hasUsageAccess?.().catch(() => false)) {
      usageGrantedNow();
      return;
    }
    const opened = await restrictionEngine
      .openUsageAccessSettings?.()
      .catch(() => false);
    if (opened) update({ usageRequestedAt: new Date().toISOString() });
    setUsagePermission(opened ? "waiting" : "denied");
  }

  // Android's back button walks the steps back instead of leaving the app.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      goBack,
    );
    return () => subscription.remove();
  }, [goBack]);

  /** Onboarded only here, once the setup is behind the user (D9). */
  const finish = useCallback(
    async (route: Parameters<typeof router.replace>[0]) => {
      setBusy(true);
      try {
        await setOnboarded(true);
        await clearOnboardingProgress();
        router.replace(route);
      } finally {
        setBusy(false);
      }
    },
    [setOnboarded],
  );

  if (!context || !progress || !step) {
    return <View style={styles.blank} />;
  }

  // Until the verified setup steps land (plan F4/F5), the platform setup hands
  // over to the existing screens the way the previous onboarding did.
  async function startLegacySetup() {
    try {
      if (Platform.OS === "ios") {
        await restrictionEngine.enableShortcutMode();
        await finish({ pathname: "/ios-apps", params: { onboarding: "1" } });
        return;
      }
      await finish("/android-setup");
    } catch {
      void sheet.show({
        title: localize("We couldn't continue", "No pudimos continuar"),
        message: localize("Try again.", "Vuelve a intentarlo."),
        actions: [retryAction(() => void startLegacySetup()), closeAction()],
      });
    }
  }

  const topApp = insights?.topApps[0];
  const demoApp: DemoApp =
    topApp && icons[topApp.packageName]
      ? {
          label: topApp.label,
          icon: { kind: "image", uri: icons[topApp.packageName]! },
        }
      : EXAMPLE_DEMO_APP;

  function renderStep(current: OnboardingStepId) {
    switch (current) {
      case "usage-permission":
        return (
          <UsagePermissionStep
            onGrant={() => void requestUsageAccess()}
            onSkip={() => {
              setUsagePermission("idle");
              update({ usage: "skipped", usageRequestedAt: undefined });
              goNext();
            }}
            state={usagePermission}
          />
        );
      case "reveal":
        return (
          <RevealStep
            guessMinutes={progress!.guessMinutes}
            insights={insights}
            onNext={goNext}
          />
        );
      case "guess":
        return (
          <GuessStep
            onChange={(guessMinutes) => update({ guessMinutes })}
            onNext={goNext}
            value={progress!.guessMinutes}
          />
        );
      case "life":
        return (
          <LifeStep
            dailyMinutes={insights?.dailyMinutes ?? progress!.guessMinutes}
            fromGuess={!insights}
            onNext={goNext}
          />
        );
      case "where":
        return (
          <WhereStep icons={icons} insights={insights ?? null} onNext={goNext} />
        );
      case "habit":
        return <HabitStep app={demoApp} onNext={goNext} />;
      case "pause-demo":
        return <PauseDemoStep app={demoApp} onNext={goNext} />;
      case "how":
        return <HowStep onNext={goNext} />;
      case "adult":
        return (
          <AdultStep
            confirmed={Boolean(progress!.adultConfirmedAt)}
            onNext={goNext}
            onToggle={() =>
              update({
                adultConfirmedAt: progress!.adultConfirmedAt
                  ? undefined
                  : new Date().toISOString(),
              })
            }
            ready={hydrated}
          />
        );
      case "pauses-off":
        return (
          <PausesOffStep
            busy={busy}
            onFinish={() => void finish("/(tabs)/(today)")}
          />
        );
      default:
        return (
          <StoryLayout
            body={
              Platform.OS === "ios"
                ? localize(
                    "Pick the apps here, then connect Apple's Shortcuts so it tells Still when you open them. Everything stays on this iPhone.",
                    "Elige las apps aquí y luego conecta Atajos de Apple para que avise a Still cuando las abras. Todo se queda en este iPhone.",
                  )
                : localize(
                    "Turn on Still and choose the apps you open without thinking. You can change them anytime.",
                    "Activa Still y elige las apps que abres sin pensar. Puedes cambiarlas cuando quieras.",
                  )
            }
            footer={
              <StoryFooter
                primary={{
                  label: busy
                    ? localize("One moment…", "Un momento…")
                    : localize("Choose apps", "Elegir apps"),
                  onPress: () => void startLegacySetup(),
                  disabled: busy,
                }}
              />
            }
            title={localize(
              "Choose where the pause should appear.",
              "Elige dónde debería aparecer la pausa.",
            )}
          />
        );
    }
  }

  return (
    <OnboardingChrome
      onSkip={
        isStoryStep(step) ? () => goTo(firstSetupStep(context), 1) : undefined
      }
      progress={stepProgress(context, step)}
    >
      <Animated.View
        entering={moved ? slideIn(direction) : undefined}
        key={step}
        style={styles.step}
      >
        {renderStep(step)}
      </Animated.View>
    </OnboardingChrome>
  );
}

const styles = StyleSheet.create({
  blank: { flex: 1, backgroundColor: colors.paper },
  step: { flex: 1 },
});

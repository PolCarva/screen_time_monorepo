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
import {
  AccessibilityStep,
  AndroidAppsStep,
  DoneStep,
  KeepAliveStep,
  LiveTestStep,
  type SummaryLine,
} from "@/components/onboarding/android-setup-steps";
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
import { useAndroidSetup } from "@/components/onboarding/use-android-setup";
import {
  closeAction,
  retryAction,
  useStillSheet,
} from "@/components/still-sheet";
import { localize } from "@/i18n";
import { accessibilityPathTip, isAggressiveOem } from "@/lib/android-oem";
import {
  canContinue,
  firstSetupStep,
  firstUnverifiedSetupStep,
  isSetupStep,
  isStoryStep,
  nextStep,
  previousStep,
  resolveStep,
  setupSteps,
  setupSummary,
  stepProgress,
  type FlowContext,
  type OnboardingProgress,
  type OnboardingStepId,
  type SetupSignals,
  type SetupStepId,
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
  const { config, hydrated, nativeSynced, setOnboarded } = useAppState();
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

  const update = useCallback((patch: Partial<OnboardingProgress>) => {
    const current = progressRef.current;
    if (!current) return;
    const next = { ...current, ...patch };
    progressRef.current = next;
    setProgress(next);
    void saveOnboardingProgress(next);
  }, []);

  const platform = Platform.OS === "ios" ? "ios" : "android";
  const usageSource =
    Platform.OS === "android" && restrictionEngine.getUsageSummary
      ? "android-usage"
      : "none";
  const inSetup = Boolean(progress && isSetupStep(progress.step));
  const android = useAndroidSetup({
    active: inSetup,
    progress,
    update,
    insights,
    sheet,
  });
  const manufacturer = android.environment?.manufacturer ?? "";
  const context = useMemo<FlowContext | null>(
    () =>
      progress && {
        platform,
        pausesEnabled: isPauseFeatureEnabled(Platform.OS, config),
        usageSource,
        usageGranted: progress.usage === "granted",
        adsConsent: "not-required",
        aggressiveOem: platform === "android" && isAggressiveOem(manufacturer),
      },
    [config, manufacturer, platform, progress, usageSource],
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

  // A step that already passed can lose its signal (Accessibility switched off
  // in Settings, apps unticked, or a restart after the system killed Still):
  // the flow goes back to it instead of moving on without it (D7, D9).
  const accessibilityOk =
    android.health?.authorization === "authorized" &&
    Boolean(android.health?.serviceRunning);
  const appsChosen = android.health?.selectedCount ?? 0;
  const healthKnown = android.health !== null;
  useEffect(() => {
    if (Platform.OS !== "android" || !healthKnown || !context || !progress) return;
    const current = resolveStep(context, progress.step);
    if (!isSetupStep(current)) return;
    const missing = firstUnverifiedSetupStep(context, {
      adultConfirmed: Boolean(progress.adultConfirmedAt),
      adsConsentResolved: true,
      accessibilityEnabled: accessibilityOk,
      accessibilityRunning: accessibilityOk,
      selectedApps: appsChosen,
      batteryUnrestricted: true,
      keepAliveConfirmed: true,
      liveTestVerified: Boolean(progress.androidTestVerifiedAt),
      appTests: { total: 0, verified: 0 },
      noticesDecided: true,
    });
    if (!missing) return;
    const order = setupSteps(context);
    if (order.indexOf(missing) < order.indexOf(current)) goTo(missing, -1);
  }, [accessibilityOk, appsChosen, context, goTo, healthKnown, progress]);

  // Every setup step shows what the phone says now, not what it said earlier.
  const refreshAndroid = android.refresh;
  useEffect(() => {
    if (step && isSetupStep(step) && Platform.OS === "android") void refreshAndroid();
  }, [refreshAndroid, step]);

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

  async function startLegacySetup() {
    try {
      await restrictionEngine.enableShortcutMode();
      await finish({ pathname: "/ios-apps", params: { onboarding: "1" } });
    } catch {
      void sheet.show({
        title: localize("We couldn't continue", "No pudimos continuar"),
        message: localize("Try again.", "Vuelve a intentarlo."),
        actions: [retryAction(() => void startLegacySetup()), closeAction()],
      });
    }
  }

  const signals: SetupSignals = {
    adultConfirmed: Boolean(progress.adultConfirmedAt),
    adsConsentResolved: true,
    accessibilityEnabled: android.health?.authorization === "authorized",
    accessibilityRunning: Boolean(android.health?.serviceRunning),
    selectedApps: android.health?.selectedCount ?? 0,
    batteryUnrestricted: android.battery,
    keepAliveConfirmed: Boolean(progress.keepAliveConfirmedAt),
    liveTestVerified: Boolean(progress.androidTestVerifiedAt),
    appTests: { total: 0, verified: 0 },
    noticesDecided: false,
  };
  const finishLater = () => void finish("/(tabs)/(today)");
  /** A setup step moves on only with its signal (D7). */
  const goNextVerified = () => {
    if (step && canContinue(step, signals)) goNext();
  };

  function summaryLabel(item: SetupStepId): string {
    switch (item) {
      case "adult":
        return localize("18 or older", "Mayor de 18");
      case "ads-consent":
        return localize("Ad preferences", "Preferencias de anuncios");
      case "accessibility":
        return localize("Still is on", "Still activado");
      case "apps":
        return localize(
          `${signals.selectedApps} ${signals.selectedApps === 1 ? "app" : "apps"} with a pause`,
          `${signals.selectedApps} ${signals.selectedApps === 1 ? "app" : "apps"} con pausa`,
        );
      case "keep-alive":
        return localize(
          "Still stays on in the background",
          "Still sigue activo en segundo plano",
        );
      case "live-test":
        return localize(
          `Pause tested with ${android.testApp?.label ?? "your app"}`,
          `Pausa probada con ${android.testApp?.label ?? "tu app"}`,
        );
      case "app-tests":
        return localize("Every app tested", "Cada app probada");
      case "notices":
        return localize("Notices", "Avisos");
      default:
        return item;
    }
  }
  const summary: SummaryLine[] = setupSummary(context, signals).map((item) => ({
    label: summaryLabel(item.step),
    verified: item.verified,
    recommended: item.requirement === "recommended",
  }));

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
      case "accessibility":
        return (
          <AccessibilityStep
            enabled={signals.accessibilityEnabled}
            onFinishLater={finishLater}
            onNext={goNextVerified}
            onOpen={() => void android.openAccessibility()}
            onOpenAppInfo={android.openAppInfo}
            pathTip={accessibilityPathTip(manufacturer)}
            restricted={Boolean(android.environment?.likelyRestricted)}
            running={signals.accessibilityRunning}
          />
        );
      case "keep-alive":
        return (
          <KeepAliveStep
            batteryOk={signals.batteryUnrestricted}
            confirmed={signals.keepAliveConfirmed}
            makerName={android.oem.name}
            onFinishLater={finishLater}
            onNext={goNext}
            onOpenAppInfo={android.openAppInfo}
            onOpenBattery={android.openBattery}
            onToggleConfirmed={() =>
              update({
                keepAliveConfirmedAt: progress!.keepAliveConfirmedAt
                  ? undefined
                  : new Date().toISOString(),
              })
            }
            tips={android.oem.tips}
          />
        );
      case "live-test":
        return (
          <LiveTestStep
            app={android.testApp}
            checks={android.failureChecks}
            onFinishLater={finishLater}
            onNext={goNextVerified}
            onTest={() => void android.test()}
            ready={nativeSynced}
            state={android.testState}
          />
        );
      case "done":
        return (
          <DoneStep
            busy={busy}
            lines={summary}
            onFinish={() => void finish("/(tabs)/(today)")}
          />
        );
      case "apps":
        if (Platform.OS === "android") {
          return (
            <AndroidAppsStep
              apps={android.apps}
              onChoose={() => void android.chooseApps().catch(() => undefined)}
              onFinishLater={finishLater}
              onNext={goNextVerified}
            />
          );
        }
        return renderLegacySetup();
      default:
        return renderLegacySetup();
    }
  }

  // iOS only, until its verified setup steps land (plan F5): hands over to the
  // existing screens the way the previous onboarding did.
  function renderLegacySetup() {
    return (
      <StoryLayout
        body={localize(
          "Pick the apps here, then connect Apple's Shortcuts so it tells Still when you open them. Everything stays on this iPhone.",
          "Elige las apps aquí y luego conecta Atajos de Apple para que avise a Still cuando las abras. Todo se queda en este iPhone.",
        )}
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
        title={localize("Choose your apps.", "Elige tus apps.")}
      />
    );
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

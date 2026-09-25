import * as Clipboard from "expo-clipboard";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  BackHandler,
  Linking,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import Animated from "react-native-reanimated";

import { slideIn } from "@/components/motion";
import {
  AdsConsentStep,
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
import { IosAppPicker } from "@/components/ios/ios-app-picker";
import { ShortcutConnectList } from "@/components/ios/shortcut-connect-list";
import { ShortcutGuide } from "@/components/ios/shortcut-guide";
import {
  AppTestsStep,
  IosAppsStep,
  NoticesStep,
  ReturnShortcutRows,
  ShortcutsStep,
  type NoticePermission,
} from "@/components/onboarding/ios-setup-steps";
import { EXAMPLE_DEMO_APP, type DemoApp } from "@/components/onboarding/phone";
import { OnboardingChrome } from "@/components/onboarding/story-screen";
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
import { useIosSetup } from "@/components/onboarding/use-ios-setup";
import { useStillSheet } from "@/components/still-sheet";
import { localize } from "@/i18n";
import { capture } from "@/lib/analytics";
import { accessibilityPathTip, isAggressiveOem } from "@/lib/android-oem";
import {
  guideSteps,
  hasReadyActions,
  resolveSetupTier,
} from "@/lib/ios-shortcut-setup";
import { returnShortcutName } from "@/lib/shortcut-targets";
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
import { askForConsent, consentRequirement } from "@/native/ads-consent";
import { useAppState } from "@/state/app-state";
import { captureBaselineIfNeeded, rememberOnboardedAt } from "@/state/saved-time";
import {
  clearOnboardingProgress,
  loadOnboardingProgress,
  saveOnboardingProgress,
  type FlowMode,
} from "@/state/onboarding-progress";
import { colors } from "@/theme/tokens";

/**
 * The whole onboarding: the story, then the setup (docs/onboarding-v2-plan.md
 * §2). lib/onboarding-flow decides which step comes next; this component only
 * draws the current one and remembers where the user is. In "setup" mode it is
 * the `/setup` route: the same verified setup, without the story, for someone
 * already onboarded (§4.6).
 */
export function OnboardingFlow({ mode = "onboarding" }: { mode?: FlowMode }) {
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
  // The story's numbers: read, held in memory, never stored (D4). Only the
  // per-app week before Still is kept, at the end (real-savings D7-D8).
  // Undefined while reading.
  const [insights, setInsights] = useState<UsageInsights | null | undefined>();
  const [icons, setIcons] = useState<Record<string, string>>({});

  const [consentState, setConsentState] = useState<"checking" | "ready">("checking");
  const [noticePermission, setNoticePermission] =
    useState<NoticePermission>("undetermined");

  useEffect(() => {
    void loadOnboardingProgress(mode).then((loaded) => {
      progressRef.current = loaded;
      setProgress(loaded);
    });
  }, [mode]);

  const update = useCallback(
    (patch: Partial<OnboardingProgress>) => {
      const current = progressRef.current;
      if (!current) return;
      const next = { ...current, ...patch };
      progressRef.current = next;
      setProgress(next);
      void saveOnboardingProgress(next, mode);
    },
    [mode],
  );

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
  const ios = useIosSetup({
    active: inSetup,
    progress,
    update,
    // The "connected" screen of a test comes back to this flow.
    returnTo: { pathname: mode === "setup" ? "/setup" : "/(onboarding)" },
  });
  const manufacturer = android.environment?.manufacturer ?? "";
  const context = useMemo<FlowContext | null>(
    () =>
      progress && {
        platform,
        pausesEnabled: isPauseFeatureEnabled(Platform.OS, config),
        usageSource,
        usageGranted: progress.usage === "granted",
        adsConsent: progress.adsConsent,
        aggressiveOem: platform === "android" && isAggressiveOem(manufacturer),
      },
    [config, manufacturer, platform, progress, usageSource],
  );

  // Once usage access is granted, read the week (again after a restart: the
  // story's numbers are never stored).
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
    // `/setup` starts after the age check: back from there leaves the screen.
    if (!target || (mode === "setup" && target === "adult")) return false;
    goTo(target, -1);
    return true;
  }, [context, goTo, mode, step]);

  /** The user granted usage access: straight to the reveal. */
  const usageGrantedNow = useCallback(() => {
    capture("onboarding_usage_access", { result: "granted" });
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

  // Once the setup starts, ask UMP whether Google needs a choice here (D12).
  // Offline or failing, the step is left out: the ads SDK asks at the first ad.
  const needsConsentCheck = inSetup && progress?.adsConsent === "unknown";
  useEffect(() => {
    if (!needsConsentCheck) return;
    let cancelled = false;
    consentRequirement()
      .then((requirement) => {
        if (cancelled) return;
        update({ adsConsent: requirement });
        setConsentState("ready");
      })
      .catch(() => {
        if (!cancelled) update({ adsConsent: "not-required" });
      });
    return () => {
      cancelled = true;
    };
  }, [needsConsentCheck, update]);

  async function requestConsent() {
    setConsentState("checking");
    try {
      const answer = await askForConsent();
      if (answer.resolved) {
        update({
          adsConsentAt: new Date().toISOString(),
          adsCanRequest: answer.canRequestAds,
        });
      }
    } catch {
      // The form could not show (offline): the ads SDK asks at the first ad.
      update({ adsConsent: "not-required" });
    } finally {
      setConsentState("ready");
    }
  }

  // A step that already passed can lose its signal (Accessibility switched off
  // in Settings, apps unticked, or a restart after the system killed Still):
  // the flow goes back to it instead of moving on without it (D7, D9).
  const accessibilityOk =
    android.health?.authorization === "authorized" &&
    Boolean(android.health?.serviceRunning);
  const appsChosen =
    Platform.OS === "ios" ? ios.chosen.length : (android.health?.selectedCount ?? 0);
  const appsTested = ios.verified.length;
  const phoneKnown = Platform.OS === "ios" ? ios.ready : android.health !== null;
  useEffect(() => {
    if (!phoneKnown || !context || !progress) return;
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
      appTests: { total: appsChosen, verified: appsTested },
      noticesDecided: true,
    });
    if (!missing) return;
    const order = setupSteps(context);
    // The tests of an app just added are not "lost": they are the next thing to do.
    if (missing === "app-tests" && current === "shortcuts") return;
    if (order.indexOf(missing) < order.indexOf(current)) goTo(missing, -1);
  }, [accessibilityOk, appsChosen, appsTested, context, goTo, phoneKnown, progress]);

  // Every setup step shows what the phone says now, not what it said earlier.
  const refreshAndroid = android.refresh;
  useEffect(() => {
    if (step && isSetupStep(step) && Platform.OS === "android") void refreshAndroid();
  }, [refreshAndroid, step]);

  // iOS notices: read from the phone on the step and on every return (§4.4 14I).
  const onNoticesStep = step === "notices";
  const readNoticePermission = useCallback(async () => {
    const current = await Notifications.getPermissionsAsync().catch(() => null);
    if (!current) return;
    setNoticePermission(
      current.granted
        ? "granted"
        : current.status === "denied"
          ? "denied"
          : "undetermined",
    );
  }, []);
  useEffect(() => {
    if (!onNoticesStep) return;
    void readNoticePermission();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void readNoticePermission();
    });
    return () => subscription.remove();
  }, [onNoticesStep, readNoticePermission]);

  // Funnel only: the step's name, never an app or a figure (D14).
  useEffect(() => {
    if (step) capture("onboarding_step_viewed", { step, mode });
  }, [mode, step]);

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
        const current = progressRef.current;
        if (current) {
          capture("onboarding_completed", {
            mode,
            complete: Boolean(current.androidTestVerifiedAt),
            durationSeconds: Math.round(
              (Date.now() - Date.parse(current.startedAt)) / 1_000,
            ),
          });
        }
        if (mode === "onboarding") {
          // The day "before Still" is measured against, and that week's usage
          // read now if access is on (docs/real-savings-estimate-plan.md, D7).
          await rememberOnboardedAt();
          await captureBaselineIfNeeded().catch(() => null);
          await setOnboarded(true);
        }
        await clearOnboardingProgress(mode);
        if (mode === "setup" && router.canGoBack()) router.back();
        else router.replace(route);
      } finally {
        setBusy(false);
      }
    },
    [mode, setOnboarded],
  );

  if (!context || !progress || !step) {
    return <View style={styles.blank} />;
  }

  const signals: SetupSignals = {
    adultConfirmed: Boolean(progress.adultConfirmedAt),
    adsConsentResolved:
      progress.adsConsent === "not-required" || Boolean(progress.adsConsentAt),
    accessibilityEnabled: android.health?.authorization === "authorized",
    accessibilityRunning: Boolean(android.health?.serviceRunning),
    selectedApps: appsChosen,
    batteryUnrestricted: android.battery,
    keepAliveConfirmed: Boolean(progress.keepAliveConfirmedAt),
    liveTestVerified: Boolean(progress.androidTestVerifiedAt),
    appTests: { total: appsChosen, verified: appsTested },
    noticesDecided: noticePermission === "granted",
  };
  const finishLater = () => void finish("/(tabs)/(today)");
  /** A setup step moves on only with its signal (D7). */
  const goNextVerified = () => {
    if (!step || !canContinue(step, signals)) return;
    capture("onboarding_step_verified", { step, mode });
    goNext();
  };

  function summaryLabel(item: SetupStepId): string {
    switch (item) {
      case "adult":
        return localize("18 or older", "Mayor de 18");
      case "ads-consent":
        return progress!.adsCanRequest === false
          ? localize(
              "No ads: the pause lets you in after a short wait",
              "Sin anuncios: la pausa te deja entrar tras una espera breve",
            )
          : localize("Ad preferences", "Preferencias de anuncios");
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
        return localize(
          `${appsTested} of ${appsChosen} ${appsChosen === 1 ? "app" : "apps"} tested`,
          `${appsTested} de ${appsChosen} ${appsChosen === 1 ? "app probada" : "apps probadas"}`,
        );
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

  // Below iOS 26 Apple asks "Continue in Still?" when an automation runs.
  const askedToContinue =
    Platform.OS === "ios" && Number.parseInt(String(Platform.Version), 10) < 26;

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
              capture("onboarding_usage_access", { result: "skipped" });
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
      case "ads-consent":
        return (
          <AdsConsentStep
            onAsk={() => void requestConsent()}
            onNext={goNextVerified}
            state={
              signals.adsConsentResolved
                ? "answered"
                : progress!.adsConsent === "unknown"
                  ? "checking"
                  : consentState
            }
          />
        );
      case "accessibility":
        return (
          <AccessibilityStep
            enabled={signals.accessibilityEnabled}
            makerName={android.oem.name}
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
      case "notices":
        return (
          <NoticesStep
            onAsk={() =>
              void Notifications.requestPermissionsAsync({
                ios: { allowAlert: true, allowSound: true },
              }).then(() => readNoticePermission())
            }
            onNext={goNext}
            onOpenSettings={() => void Linking.openSettings()}
            permission={noticePermission}
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
        return (
          <IosAppsStep
            chosen={appsChosen}
            onFinishLater={finishLater}
            onNext={goNextVerified}
            picker={<IosAppPicker />}
          />
        );
      case "shortcuts": {
        const nextApp = ios.pending[0] ?? ios.chosen[0];
        const tier = resolveSetupTier({ iosVersion: Platform.Version });
        return (
          <ShortcutsStep
            app={nextApp?.name ?? EXAMPLE_DEMO_APP.label}
            askedToContinue={askedToContinue}
            guide={
              <ShortcutGuide
                app={nextApp?.name ?? EXAMPLE_DEMO_APP.label}
                appNames={ios.chosen.map((target) => target.name)}
                readyActions={hasReadyActions(Platform.Version)}
                steps={guideSteps(tier, { needsReturnShortcut: false })}
              />
            }
            onFinishLater={finishLater}
            onNext={goNext}
          />
        );
      }
      case "app-tests":
        return (
          <AppTestsStep
            askedToContinue={askedToContinue}
            extra={
              <ReturnShortcutRows
                apps={ios.schemeless.map((target) => ({
                  id: target.id,
                  name: target.name,
                  shortcut: returnShortcutName(target.name),
                  tested: ios.returnTested(target.id),
                }))}
                onCopy={(shortcut) => {
                  void Clipboard.setStringAsync(shortcut);
                  sheet.toast({
                    message: localize("Name copied.", "Nombre copiado."),
                    tone: "success",
                  });
                }}
                onTest={(id) => void ios.testReturn(id)}
              />
            }
            list={
              <ShortcutConnectList
                onProbeStart={ios.onProbeStart}
                pausesEnabled={context!.pausesEnabled}
                probe={ios.probe}
                returnTo={{ pathname: mode === "setup" ? "/setup" : "/(onboarding)" }}
              />
            }
            nextApp={ios.pending[0]?.name ?? null}
            onChangeApps={() => goTo("apps", -1)}
            onFinishLater={finishLater}
            onGuide={() => goTo("shortcuts", -1)}
            onNext={goNextVerified}
            total={appsChosen}
            verified={appsTested}
          />
        );
      default:
        return null;
    }
  }

  return (
    <OnboardingChrome
      onSkip={
        mode === "onboarding" && isStoryStep(step)
          ? () => goTo(firstSetupStep(context), 1)
          : undefined
      }
      progress={
        mode === "setup" ? setupProgressOf(context, step) : stepProgress(context, step)
      }
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

/** `/setup` measures only the setup steps it shows (everything after the age check). */
function setupProgressOf(context: FlowContext, step: OnboardingStepId): number {
  const steps: OnboardingStepId[] = setupSteps(context).filter(
    (item) => item !== "adult",
  );
  const index = steps.indexOf(resolveStep(context, step));
  return steps.length <= 1 ? 1 : Math.max(0, index) / (steps.length - 1);
}

const styles = StyleSheet.create({
  blank: { flex: 1, backgroundColor: colors.paper },
  step: { flex: 1 },
});

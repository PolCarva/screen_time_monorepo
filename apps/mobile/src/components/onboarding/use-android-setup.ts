import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Platform } from "react-native";

import type { DemoApp } from "@/components/onboarding/phone";
import type { LiveTestState } from "@/components/onboarding/android-setup-steps";
import {
  DISCLOSURE_ACCEPTED_KEY,
  confirmAccessibilityDisclosure,
} from "@/components/setup/android-accessibility";
import type { SheetApi } from "@/components/still-sheet";
import { localize } from "@/i18n";
import { oemGuidance } from "@/lib/android-oem";
import {
  probeOutcome,
  type OnboardingProgress,
} from "@/lib/onboarding-flow";
import type { UsageInsights } from "@/lib/onboarding-insights";
import { setJson } from "@/lib/storage";
import {
  restrictionEngine,
  type InstallEnvironment,
  type RestrictionHealth,
  type SelectedAppState,
} from "@/native/restriction-engine";

/** Setup test on Android: wait this long after the test began and after Still is back. */
const PROBE_MIN_FROM_START_MS = 4_000;
const PROBE_MIN_FROM_RETURN_MS = 4_000;

/**
 * Everything the Android setup steps read from the phone and do on it
 * (docs/onboarding-v2-plan.md §4.3, §5.1). The phone is asked again whenever
 * Still comes back to the front, so a step turns green because the phone says
 * so, whatever its Settings looked like.
 */
export function useAndroidSetup({
  active,
  progress,
  update,
  insights,
  sheet,
}: {
  /** Only runs on Android, during the setup steps. */
  active: boolean;
  progress: OnboardingProgress | null;
  update: (patch: Partial<OnboardingProgress>) => void;
  insights: UsageInsights | null | undefined;
  sheet: SheetApi;
}) {
  const [health, setHealth] = useState<RestrictionHealth | null>(null);
  const [battery, setBattery] = useState(false);
  const [environment, setEnvironment] = useState<InstallEnvironment | null>(null);
  const [selected, setSelected] = useState<SelectedAppState[]>([]);
  const [icons, setIcons] = useState<Record<string, string>>({});
  const [probeConfirmedAt, setProbeConfirmedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const enabled = active && Platform.OS === "android";

  const refresh = useCallback(async () => {
    const [nextHealth, nextBattery, nextSelected, probe] = await Promise.all([
      restrictionEngine.getHealth().catch(() => null),
      restrictionEngine.isIgnoringBatteryOptimizations?.().catch(() => false),
      restrictionEngine.getSelectedAppsState?.().catch(() => []),
      restrictionEngine.getSetupProbeResult?.().catch(() => null),
    ]);
    if (nextHealth) setHealth(nextHealth);
    setBattery(Boolean(nextBattery));
    setSelected(nextSelected ?? []);
    setProbeConfirmedAt(probe?.verifiedAt ?? null);
    setNow(Date.now());
    return nextHealth;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    void restrictionEngine
      .getInstallEnvironment?.()
      .then((value) => setEnvironment(value))
      .catch(() => undefined);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      // Back from the app being tested: the clock for "it didn't show" starts.
      const probe = progressRef.current?.probe;
      if (probe?.kind === "android" && !probe.returnedAt) {
        update({ probe: { ...probe, returnedAt: new Date().toISOString() } });
      }
      void refresh().then((next) => {
        // The service binds a moment after the switch: look again before
        // calling it "on but not running".
        if (next?.authorization === "authorized" && !next.serviceRunning) {
          setTimeout(() => void refresh(), 1_500);
        }
      });
    });
    return () => subscription.remove();
  }, [enabled, refresh, update]);

  // Icons of the chosen apps, for the apps step and the test.
  const selectedKey = selected.map((app) => app.packageName).join(",");
  useEffect(() => {
    if (!enabled || selected.length === 0) return;
    let cancelled = false;
    void (async () => {
      const loaded: Record<string, string> = {};
      for (const app of selected) {
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
    // Keyed by the chosen packages, not by the array identity.
  }, [enabled, selectedKey]);

  // While a test runs, ask the phone every second whether the pause showed.
  const probe = progress?.probe?.kind === "android" ? progress.probe : undefined;
  useEffect(() => {
    if (!enabled || !probe || progress?.androidTestVerifiedAt) return;
    const timer = setInterval(() => void refresh(), 1_000);
    return () => clearInterval(timer);
  }, [enabled, probe, progress?.androidTestVerifiedAt, refresh]);

  const outcome = probe
    ? probeOutcome({
        startedAt: Date.parse(probe.startedAt),
        confirmedAt: probeConfirmedAt,
        returnedAt: probe.returnedAt ? Date.parse(probe.returnedAt) : null,
        now,
        minFromStartMs: PROBE_MIN_FROM_START_MS,
        minFromReturnMs: PROBE_MIN_FROM_RETURN_MS,
      })
    : null;
  useEffect(() => {
    if (outcome === "verified" && !progress?.androidTestVerifiedAt) {
      update({ androidTestVerifiedAt: new Date().toISOString(), probe: undefined });
    }
  }, [outcome, progress?.androidTestVerifiedAt, update]);

  const testState: LiveTestState = progress?.androidTestVerifiedAt
    ? "verified"
    : outcome === "failed"
      ? "failed"
      : outcome === "waiting"
        ? "waiting"
        : "idle";

  const apps: (DemoApp & { packageName: string })[] = useMemo(
    () =>
      selected.map((app) => ({
        packageName: app.packageName,
        label: app.label,
        icon: icons[app.packageName]
          ? { kind: "image" as const, uri: icons[app.packageName]! }
          : { kind: "blank" as const },
      })),
    [icons, selected],
  );

  // The test uses the most used of the chosen apps, else the first one.
  const testApp = useMemo(() => {
    const ranked = (insights?.topApps ?? [])
      .map((top) => apps.find((app) => app.packageName === top.packageName))
      .find(Boolean);
    return ranked ?? apps[0] ?? null;
  }, [apps, insights]);

  const openAccessibility = useCallback(async () => {
    const accepted = progressRef.current?.accessibilityDisclosureAt;
    if (!accepted) {
      if (!(await confirmAccessibilityDisclosure(sheet))) return;
      const at = new Date().toISOString();
      update({ accessibilityDisclosureAt: at });
      await setJson(DISCLOSURE_ACCEPTED_KEY, at);
    }
    await restrictionEngine.setSetupAwaiting?.("accessibility").catch(() => undefined);
    await restrictionEngine.openAccessibilitySettings?.().catch(() => false);
  }, [sheet, update]);

  const chooseApps = useCallback(async () => {
    const suggested =
      insights?.topApps.map((app) => ({
        packageName: app.packageName,
        dailyMinutes: app.dailyMinutes,
      })) ?? [];
    try {
      const selection = restrictionEngine.presentAppPickerSuggesting
        ? await restrictionEngine.presentAppPickerSuggesting(suggested)
        : await restrictionEngine.presentAppPicker();
      if (selection.count > 0) await restrictionEngine.applyRestrictions(selection);
    } finally {
      await refresh();
    }
  }, [insights, refresh]);

  const test = useCallback(async () => {
    if (!testApp) return;
    const startedAt = await restrictionEngine.beginSetupProbe?.(testApp.packageName);
    if (!startedAt) return;
    update({
      probe: {
        kind: "android",
        target: testApp.packageName,
        startedAt: new Date(startedAt).toISOString(),
      },
    });
    await restrictionEngine.openApp?.(testApp.packageName).catch(() => false);
  }, [testApp, update]);

  const oem = oemGuidance(environment?.manufacturer ?? "");
  const running = health?.authorization === "authorized" && Boolean(health.serviceRunning);
  const failureChecks = [
    running
      ? localize("Still is on and running.", "Still está activado y funcionando.")
      : localize(
          "Still isn't running: go back to the Accessibility step.",
          "Still no está funcionando: vuelve al paso de Accesibilidad.",
        ),
    ...oem.tips
      .filter((tip) => /pop-up|emergentes|background|segundo plano/i.test(tip.en + tip.es))
      .map((tip) => localize(tip.en, tip.es)),
    localize(
      `Try again. Opening ${testApp?.label ?? "the app"} from your home screen counts too.`,
      `Prueba otra vez. Abrir ${testApp?.label ?? "la app"} desde tu pantalla de inicio también vale.`,
    ),
  ];

  return {
    health,
    battery,
    environment,
    oem,
    apps,
    testApp,
    testState,
    failureChecks,
    refresh,
    openAccessibility,
    chooseApps,
    test,
    openBattery: () => void restrictionEngine.openBatterySettings?.(),
    openAppInfo: () => void restrictionEngine.openAppInfo?.(),
  };
}

import { useCallback, useEffect, useMemo, useRef } from "react";
import { AppState, Linking, Platform } from "react-native";

import type { SetupProbe } from "@/components/ios/shortcut-connect-list";
import { firedSince, type OnboardingProgress } from "@/lib/onboarding-flow";
import {
  rememberSetupTestReturn,
  type SetupTestReturn,
} from "@/lib/setup-test-return";
import { activeTargets, returnShortcutName } from "@/lib/shortcut-targets";
import { restrictionEngine } from "@/native/restriction-engine";
import { useShortcutTargets } from "@/state/shortcut-targets";

/**
 * What the iOS setup steps read and do (docs/onboarding-v2-plan.md §4.4). iOS
 * cannot read automations, so an app counts as connected only when its
 * automation fired during this setup — its `lastTriggeredAt` is newer than the
 * moment the setup began — never because of a `verifiedAt` from long ago.
 */
export function useIosSetup({
  active,
  progress,
  update,
  returnTo,
}: {
  /** Only runs on iOS, during the setup steps. */
  active: boolean;
  progress: OnboardingProgress | null;
  update: (patch: Partial<OnboardingProgress>) => void;
  /** Where the "connected" screen of a test comes back to. */
  returnTo: SetupTestReturn;
}) {
  const { ready, targets, health, refresh } = useShortcutTargets();
  const enabled = active && Platform.OS === "ios";
  const chosen = useMemo(() => activeTargets(targets), [targets]);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  useEffect(() => {
    if (!enabled) return;
    // Shortcuts mode is what the App Intent looks for; turning it on twice is harmless.
    void restrictionEngine.enableShortcutMode().catch(() => undefined);
    void refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => subscription.remove();
  }, [enabled, refresh]);

  // Record every chosen app whose automation fired since the setup began.
  const since = progress ? Date.parse(progress.startedAt) : Infinity;
  useEffect(() => {
    const current = progressRef.current;
    if (!enabled || !current) return;
    const verifiedTests = { ...current.verifiedTests };
    const returnTests = { ...current.returnTests };
    let changed = false;
    const firedAt = firedSince(
      chosen.map((target) => target.id),
      health,
      since,
    );
    for (const target of chosen) {
      const fired = firedAt[target.id];
      if (fired === undefined) continue;
      if (!verifiedTests[target.id]) {
        verifiedTests[target.id] = new Date(fired).toISOString();
        changed = true;
      }
      // A return test: the shortcut `Still - <App>` opened the app and its
      // automation fired, so Still can reopen it after the ad.
      const probe = current.probe;
      if (
        probe?.kind === "ios-return" &&
        probe.target === target.id &&
        fired >= Date.parse(probe.startedAt) - 1_000 &&
        !returnTests[target.id]
      ) {
        returnTests[target.id] = new Date(fired).toISOString();
        changed = true;
      }
    }
    if (changed) update({ verifiedTests, returnTests });
  }, [chosen, enabled, health, since, update]);

  const verified = chosen.filter((target) => progress?.verifiedTests[target.id]);
  const pending = chosen.filter((target) => !progress?.verifiedTests[target.id]);

  const probe: SetupProbe | null =
    progress?.probe?.kind === "ios"
      ? { targetId: progress.probe.target, startedAt: Date.parse(progress.probe.startedAt) }
      : null;
  const onProbeStart = useCallback(
    (started: SetupProbe) =>
      update({
        probe: {
          kind: "ios",
          target: started.targetId,
          startedAt: new Date(started.startedAt).toISOString(),
        },
      }),
    [update],
  );

  /** Runs `Still - <App>`: it opens the app, whose automation proves the way back. */
  const testReturn = useCallback(
    async (targetId: string) => {
      const target = chosen.find((item) => item.id === targetId);
      if (!target) return;
      await rememberSetupTestReturn(returnTo).catch(() => undefined);
      await restrictionEngine.beginShortcutSetupProbe(target.name).catch(() => undefined);
      update({
        probe: { kind: "ios-return", target: target.id, startedAt: new Date().toISOString() },
      });
      await Linking.openURL(
        `shortcuts://run-shortcut?name=${encodeURIComponent(returnShortcutName(target.name))}`,
      ).catch(() => undefined);
    },
    [chosen, returnTo, update],
  );

  return {
    ready,
    chosen,
    verified,
    pending,
    probe,
    onProbeStart,
    testReturn,
    returnTested: (targetId: string) => Boolean(progress?.returnTests[targetId]),
    schemeless: chosen.filter((target) => !target.urlScheme),
  };
}

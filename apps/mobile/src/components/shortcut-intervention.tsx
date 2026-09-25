import { formatAccessDuration } from "@screen-time/contracts";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { z } from "zod";

import { AttentionField } from "@/components/attention-field";
import { DurationSlider } from "@/components/duration-slider";
import { Breathing, PressableScale, rise } from "@/components/motion";
import { Screen } from "@/components/screen";
import { Body, Display, Eyebrow } from "@/components/typography";
import { localize } from "@/i18n";
import { capture } from "@/lib/analytics";
import { apiFetch } from "@/lib/api";
import {
  type InterventionGate,
  type InterventionNotice,
  accessSecondsFor,
  canChooseDuration,
  createInterventionFlow,
  enterMethod,
  transition,
} from "@/lib/intervention-flow";
import { normalizeAppName } from "@/lib/ios-app-catalog";
import {
  completeShortcutAndReturn,
  getInterventionOptions,
  rewardStatusForGate,
} from "@/lib/shortcut-intervention";
import { setupTestReturnHref } from "@/lib/setup-test-return";
import { restrictionEngine } from "@/native/restriction-engine";
import { useAppState } from "@/state/app-state";
import { useRewardAd } from "@/state/reward-ad-state";
import { useShortcutTargets } from "@/state/shortcut-targets";
import { colors, fonts, motion, spacing } from "@/theme/tokens";

/**
 * How long a fresh ad attempt has to start after the pause opens on a failed
 * one. It starts on the next render, so only a retry that never began (the ad
 * stopped being eligible meanwhile) runs this out.
 */
const FRESH_AD_START_MS = 2_000;

const claimSchema = z.object({
  intentId: z.string().uuid(),
  status: z.enum(["provisional", "verified"]),
});

type Props = {
  appLabel: string;
  attempts: number;
  shortcutId: string;
  isSetupTest: boolean;
  /** Where "I don't want to go in anymore" ends: the iOS Home Screen when possible. */
  onLeave: () => Promise<void> | void;
};

function noticeCopy(notice: InterventionNotice, appLabel: string) {
  switch (notice) {
    case "ad_dismissed":
      return localize(
        "To go in, watch the ad to the end.",
        "Para entrar, mira el anuncio hasta el final.",
      );
    case "ad_failed":
      return localize(
        "That ad didn't load. You can go in with this option.",
        "Ese anuncio no cargó. Puedes entrar con esta opción.",
      );
    case "claim_failed":
      return localize(
        "Your reward still needs confirming. Check your connection and try again.",
        "Falta confirmar tu recompensa. Revisa tu conexión y vuelve a intentarlo.",
      );
    case "unlock_failed":
      return localize(
        "The access didn't open. Try again.",
        "No se abrió el acceso. Vuelve a intentarlo.",
      );
    case "return_failed":
      return localize(
        `Done: ${appLabel} is open for you. Open it from your Home Screen.`,
        `Listo: ${appLabel} ya está abierta para ti. Ábrela desde tu pantalla de inicio.`,
      );
  }
}

export function ShortcutIntervention({
  appLabel,
  attempts,
  shortcutId,
  isSetupTest,
  onLeave,
}: Props) {
  const {
    cancelShortcut,
    config,
    deviceId,
    lastAccessDurationSeconds,
    rememberAccessDuration,
    unlockShortcut,
    unlockShortcutWithPause,
  } = useAppState();
  const { status: adStatus, showPrepared, retry } = useRewardAd();
  // Opened on a failed attempt: ask for a fresh ad and wait for it, rather
  // than breathing now and having the ad turn up once the pause has begun.
  const [awaitingFreshAd, setAwaitingFreshAd] = useState(
    () => adStatus === "unavailable",
  );
  useEffect(() => {
    if (!awaitingFreshAd) return;
    if (adStatus !== "unavailable") {
      setAwaitingFreshAd(false);
      return;
    }
    retry();
    const timer = setTimeout(() => setAwaitingFreshAd(false), FRESH_AD_START_MS);
    return () => clearTimeout(timer);
  }, [adStatus, awaitingFreshAd, retry]);
  const { targets, disableScheme } = useShortcutTargets();
  // The first state arrives with the screen; each later one (the pause, the
  // choice of time) fades in on its own.
  const shown = useRef(false);
  useEffect(() => {
    shown.current = true;
  }, []);
  const change = (delay = 0) =>
    shown.current ? rise(delay, 8, motion.reveal) : undefined;

  const offer = getInterventionOptions({
    supportsDirectAd: true,
    hasDevice: Boolean(deviceId),
    rewardProvider: config.rewardProvider,
    rewardStatus: rewardStatusForGate(adStatus, awaitingFreshAd),
  });
  const offeredAd = offer?.ad ?? "none";
  // Stable between renders, so the gate only changes when what it offers does.
  const gate = useMemo<InterventionGate>(
    () => ({ ad: offeredAd }),
    [offeredAd],
  );
  const [flow, dispatch] = useReducer(transition, undefined, () =>
    createInterventionFlow({
      gate,
      isSetupTest,
      durationSeconds: lastAccessDurationSeconds,
    }),
  );
  const working = useRef(false);
  /** The ad just watched: the visit is charged to it (nothing is ever saved). */
  const paidByIntent = useRef<string | null>(null);

  useEffect(() => {
    dispatch({ type: "GATE_CHANGED", gate });
  }, [gate]);

  useEffect(() => {
    if (flow.phase !== "pause") return;
    const timer = setInterval(() => dispatch({ type: "PAUSE_TICK" }), 1_000);
    return () => clearInterval(timer);
  }, [flow.phase]);

  const durationLabel = (seconds: number) =>
    localize(
      formatAccessDuration(seconds, "en"),
      formatAccessDuration(seconds, "es"),
    );

  const watchAd = useCallback(async () => {
    if (working.current || flow.phase !== "gate" || flow.gate.ad !== "ready")
      return;
    working.current = true;
    dispatch({ type: "WATCH_AD" });
    try {
      const prepared = await showPrepared();
      if (!prepared) {
        dispatch({ type: "AD_FAILED" });
        return;
      }
      const { intent, result } = prepared;
      if (result.status === "dismissed") {
        dispatch({ type: "AD_DISMISSED" });
        return;
      }
      if (result.status !== "earned") {
        dispatch({ type: "AD_FAILED" });
        return;
      }
      dispatch({ type: "AD_EARNED" });
      try {
        await apiFetch(
          `/api/v1/rewards/intents/${intent.id}/claim`,
          claimSchema,
          {
            method: "POST",
            body: JSON.stringify({
              clientEventId: result.clientEventId,
              earnedAt: new Date().toISOString(),
              ...(result.adValue ? { adValue: result.adValue } : {}),
            }),
            headers: { "idempotency-key": result.clientEventId },
          },
        );
        paidByIntent.current = intent.id;
        dispatch({ type: "CLAIM_CONFIRMED" });
      } catch {
        dispatch({ type: "CLAIM_FAILED" });
      }
    } catch {
      dispatch({ type: "AD_FAILED" });
    } finally {
      working.current = false;
      retry();
    }
  }, [flow.gate, flow.phase, retry, showPrepared]);

  const enter = useCallback(async () => {
    if (working.current || flow.phase !== "decision") return;

    working.current = true;
    const method = enterMethod(flow);
    const durationSeconds = accessSecondsFor(flow);
    const source = method === "pause" ? "pause" : "rewarded";
    const rewardIntentId = paidByIntent.current;
    dispatch({ type: "ENTER" });
    const stage: { current: "unlock" | "return" } = { current: "unlock" };
    try {
      if (canChooseDuration(flow)) await rememberAccessDuration(durationSeconds);
      await completeShortcutAndReturn({
        contextId: shortcutId,
        ...(method === "fresh_reward" && rewardIntentId ? { rewardIntentId } : {}),
        durationSeconds,
        unlockShortcut: (contextId, options) => {
          if (method === "pause") return unlockShortcutWithPause(contextId);
          // The ad just watched pays for the visit; there is nothing saved.
          if (!options.rewardIntentId) throw new Error("no_unlocks");
          return unlockShortcut(contextId, {
            durationSeconds: options.durationSeconds,
            rewardIntentId: options.rewardIntentId,
          });
        },
        onUnlockActivated: () => {
          capture("unlock_started", {
            source,
            resumedIntent: true,
            trigger: "ios_shortcut",
            durationSeconds,
          });
          stage.current = "return";
        },
        onPrimaryReturnFailed: async () => {
          // This scheme does not open on this device; stop offering it.
          const key = normalizeAppName(appLabel);
          const target = targets.find(
            (entry) => normalizeAppName(entry.name) === key,
          );
          if (target) await disableScheme(target.id);
        },
        // Call through Linking: its openURL method reads `this`, so handing the
        // bare method over would throw before iOS ever sees the URL.
        openUrl: (url) => Linking.openURL(url),
      });
      dispatch({ type: "FINISHED" });
      // Still is already behind the target app; do not leave this screen
      // waiting for the next time the user opens Still.
      router.replace("/(tabs)/(today)");
    } catch {
      dispatch({ type: "ENTER_FAILED", stage: stage.current });
    } finally {
      working.current = false;
    }
  }, [
    appLabel,
    disableScheme,
    flow,
    rememberAccessDuration,
    shortcutId,
    targets,
    unlockShortcut,
    unlockShortcutWithPause,
  ]);

  const decline = useCallback(async () => {
    if (working.current) return;
    if (
      flow.phase !== "gate" &&
      flow.phase !== "pause" &&
      flow.phase !== "decision"
    )
      return;
    working.current = true;
    // Walking away after the ad keeps nothing: there are no saved passes.
    const afterAd = flow.earnedBy === "ad";
    dispatch({ type: "DECLINE" });
    try {
      // An expired intervention is already closed from the user's point of view.
      await cancelShortcut(shortcutId).catch(() => undefined);
      capture("intervention_declined", {
        afterAd,
        trigger: "ios_shortcut",
      });
    } finally {
      dispatch({ type: "FINISHED" });
      working.current = false;
    }
    await onLeave();
  }, [cancelShortcut, flow, onLeave, shortcutId]);

  const acknowledgeTest = useCallback(async () => {
    await restrictionEngine
      .finishShortcutSetupTest(shortcutId)
      .catch(() => undefined);
    dispatch({ type: "TEST_ACKNOWLEDGED" });
    // Back to whatever started the test: the setup screen or an onboarding step.
    router.replace(await setupTestReturnHref(appLabel));
  }, [appLabel, shortcutId]);

  if (flow.phase === "setup_test" || flow.outcome === "tested") {
    return (
      <Screen fit style={styles.root} contentContainerStyle={styles.screen}>
        <StatusBar style="light" />
        <View style={styles.topline}>
          <Eyebrow style={styles.lightLabel}>
            {localize("SETUP TEST", "PRUEBA DE CONFIGURACIÓN")}
          </Eyebrow>
        </View>
        <View style={styles.copy}>
          <Display style={styles.title}>
            {localize(`${appLabel} is connected.`, `${appLabel} está conectada.`)}
          </Display>
          <Body style={styles.question}>
            {localize(
              `${appLabel} is connected: every time you open it, you'll see this pause.`,
              `${appLabel} quedó conectada: cada vez que la abras, verás esta pausa.`,
            )}
          </Body>
        </View>
        <View style={styles.actions}>
          <FilledButton
            label={localize("Continue", "Continuar")}
            onPress={() => void acknowledgeTest()}
          />
        </View>
      </Screen>
    );
  }

  const busy =
    flow.phase === "ad" ||
    flow.phase === "claiming" ||
    flow.phase === "entering" ||
    flow.phase === "leaving";
  const finished = flow.phase === "done";
  const chooses = flow.phase === "decision" && canChooseDuration(flow);
  const unlockLabel = durationLabel(accessSecondsFor(flow));

  let headline: string;
  let question: string;
  if (chooses) {
    headline = localize(
      `How long do you want in ${appLabel}?`,
      `¿Cuánto tiempo quieres en ${appLabel}?`,
    );
    const promise = localize(
      "When the time is up, the pause comes back.",
      "Al terminar el tiempo, vuelve la pausa.",
    );
    question = promise;
  } else if (flow.phase === "decision") {
    headline = localize(
      `Do you still want to open ${appLabel}?`,
      `¿Sigues queriendo abrir ${appLabel}?`,
    );
    question = localize(
      `${appLabel} will stay open for ${unlockLabel}. When the time is up, the pause comes back.`,
      `${appLabel} quedará abierta ${unlockLabel}. Al terminar, vuelve la pausa.`,
    );
  } else if (flow.phase === "pause") {
    headline = localize(
      `Breathe.\n${flow.pauseSecondsLeft}`,
      `Respira.\n${flow.pauseSecondsLeft}`,
    );
    question = localize(
      "When it's over, you choose whether to go in.",
      "Cuando termine, eliges si entras.",
    );
  } else if (flow.phase === "claiming") {
    headline = localize("Confirming your reward…", "Confirmando tu recompensa…");
    question = localize("This takes a moment.", "Tarda un momento.");
  } else {
    headline = localize(
      `${appLabel} opened\n${attempts} ${attempts === 1 ? "time" : "times"} today.`,
      `${appLabel} se abrió\n${attempts} ${attempts === 1 ? "vez" : "veces"} hoy.`,
    );
    question = localize(
      "If you go in, you choose for how long.",
      "Si entras, eliges por cuánto tiempo.",
    );
  }

  // Every way forward on this screen. At the gate the ad is the only way in;
  // while it loads the gate waits for it.
  type Option = {
    key: string;
    label: string;
    action: (() => void) | null;
  };
  const options: Option[] = [];
  if (flow.phase === "decision") {
    options.push({
      key: "enter",
      label: chooses
        ? localize(
            `I want to go in · ${unlockLabel}`,
            `Quiero entrar · ${unlockLabel}`,
          )
        : localize("I want to go in", "Quiero entrar"),
      action: () => void enter(),
    });
  } else if (flow.phase === "pause") {
    options.push({
      key: "pause",
      label: localize(
        `I want to go in · ${flow.pauseSecondsLeft}s`,
        `Quiero entrar · ${flow.pauseSecondsLeft} s`,
      ),
      action: null,
    });
  } else if (flow.phase === "ad" || flow.phase === "claiming") {
    options.push({
      key: "ad",
      label: localize("Ad in progress…", "Anuncio en curso…"),
      action: null,
    });
  } else if (flow.phase === "entering") {
    options.push({
      key: "entering",
      label: localize("Opening…", "Abriendo…"),
      action: null,
    });
  } else {
    if (flow.gate.ad === "ready")
      options.push({
        key: "ad",
        label: localize("Watch ad", "Ver anuncio"),
        action: () => void watchAd(),
      });
    else if (flow.gate.ad === "preparing")
      options.push({
        key: "ad",
        label: localize("Preparing the ad…", "Preparando el anuncio…"),
        action: null,
      });
  }

  return (
    <Screen fit style={styles.root} contentContainerStyle={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.topline}>
        <Eyebrow style={styles.lightLabel}>{appLabel}</Eyebrow>
      </View>

      {/* The field is the focus of the gate; on the duration screen the slider
          is, and the screen has to fit without scrolling. */}
      {chooses ? null : (
        // "Breathe.": the field swells and settles while the pause runs.
        <Breathing
          active={flow.phase === "pause"}
          delay={motion.fieldOpen}
          scaleTo={1.06}
        >
          <AttentionField
            accessibilityLabel={localize(
              "The attention field opens to make space for a decision.",
              "El campo de atención se abre para dejar espacio a una decisión.",
            )}
            mode="intervention"
            dark
          />
        </Breathing>
      )}

      <View>
        {/* Keyed by state, not by text: the pause's countdown changes every
            second without the block fading in again. */}
        <Animated.View
          entering={change()}
          key={`copy:${flow.phase}:${chooses ? "choose" : "fixed"}`}
          style={[styles.copy, chooses && styles.copyCompact]}
        >
          <Display style={[styles.title, chooses && styles.titleCompact]}>
            {headline}
          </Display>
          <Body style={styles.question}>{question}</Body>
          {flow.notice ? (
            <Animated.View entering={FadeIn.duration(motion.standard)}>
              <Body accessibilityLiveRegion="polite" style={styles.notice}>
                {noticeCopy(flow.notice, appLabel)}
              </Body>
            </Animated.View>
          ) : null}
          {chooses ? (
            <DurationSlider
              disabled={busy}
              onChange={(seconds) =>
                dispatch({ type: "CHOOSE_DURATION", seconds })
              }
              value={flow.durationSeconds}
            />
          ) : null}
        </Animated.View>
      </View>

      <View style={styles.actions}>
        {finished ? (
          // Reached when the app has no URL scheme and no return shortcut: the
          // allowance is running, so the Home Screen is the way in.
          <>
            <FilledButton
              label={localize("Go to the Home Screen", "Ir a la pantalla de inicio")}
              onPress={() => void onLeave()}
            />
            <PressableScale
              accessibilityRole="button"
              dimTo={0.62}
              onPress={() => router.replace("/shortcut-setup")}
              scaleTo={1}
              style={styles.secondary}
            >
              <Text style={styles.secondaryLabel}>
                {localize("Make it open by itself", "Hacer que se abra sola")}
              </Text>
              <Text style={styles.secondaryArrow}>→</Text>
            </PressableScale>
          </>
        ) : (
          <>
            <FilledButton
              disabled={busy}
              label={localize(
                "I don't want to go in anymore",
                "Ya no quiero entrar",
              )}
              onPress={() => void decline()}
            />
            {options.map((option, index) => (
              <Animated.View entering={change(60 + index * 40)} key={option.key}>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityState={{ disabled: busy || !option.action }}
                  dimTo={0.62}
                  disabled={busy || !option.action}
                  onPress={option.action ?? undefined}
                  scaleTo={1}
                  style={[
                    styles.secondary,
                    (busy || !option.action) && styles.disabled,
                  ]}
                >
                  <Text style={styles.secondaryLabel}>{option.label}</Text>
                  <Text style={styles.secondaryArrow}>→</Text>
                </PressableScale>
              </Animated.View>
            ))}
            <Body style={styles.note}>
              {localize(
                "Going in is a choice too.",
                "Entrar también es una elección.",
              )}
            </Body>
          </>
        )}
      </View>
    </Screen>
  );
}

function FilledButton({
  disabled = false,
  label,
  onPress,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.primary, disabled && styles.disabled]}
    >
      <Text style={styles.primaryLabel}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.graphite },
  screen: {
    justifyContent: "space-between",
    backgroundColor: colors.graphite,
  },
  topline: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  lightLabel: { color: colors.chalk },
  copy: { gap: spacing.lg },
  copyCompact: { gap: spacing.md },
  title: {
    color: colors.chalk,
    fontSize: 38,
    lineHeight: 41,
    letterSpacing: -1.2,
  },
  titleCompact: { fontSize: 29, lineHeight: 32, letterSpacing: -0.8 },
  question: { color: colors.mineralLight, fontSize: 15, lineHeight: 22 },
  notice: { color: colors.chalk, fontSize: 13, lineHeight: 19 },
  actions: { gap: 0 },
  primary: {
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    backgroundColor: colors.chalk,
  },
  primaryLabel: {
    color: colors.graphite,
    fontFamily: fonts.brandSemiBold,
    fontSize: 15,
  },
  secondary: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.graphiteSoft,
  },
  secondaryLabel: {
    color: colors.chalk,
    fontFamily: fonts.brandSemiBold,
    fontSize: 15,
  },
  secondaryArrow: {
    color: colors.chalk,
    fontFamily: fonts.brandMedium,
    fontSize: 21,
  },
  note: {
    paddingTop: spacing.lg,
    color: colors.mineralLight,
    fontSize: 12,
    lineHeight: 18,
  },
  disabled: { opacity: 0.42 },
});

import { formatUnlockDuration } from "@screen-time/contracts";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { z } from "zod";

import { AttentionField } from "@/components/attention-field";
import { Screen } from "@/components/screen";
import { Body, Display, Eyebrow } from "@/components/typography";
import { localize } from "@/i18n";
import { capture } from "@/lib/analytics";
import { apiFetch } from "@/lib/api";
import {
  type InterventionNotice,
  PAUSE_ALLOWANCE_SECONDS,
  createInterventionFlow,
  enterMethod,
  gateFromUnlockAction,
  keepsRewardOnLeave,
  transition,
} from "@/lib/intervention-flow";
import { normalizeAppName } from "@/lib/ios-app-catalog";
import {
  completeShortcutAndReturn,
  getInterventionUnlockAction,
} from "@/lib/shortcut-intervention";
import { restrictionEngine } from "@/native/restriction-engine";
import { useAppState } from "@/state/app-state";
import { useRewardAd } from "@/state/reward-ad-state";
import { useShortcutTargets } from "@/state/shortcut-targets";
import { colors, fonts, spacing } from "@/theme/tokens";

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
        "The ad was closed before it finished, so nothing was unlocked.",
        "El anuncio se cerró antes de terminar, así que no se desbloqueó nada.",
      );
    case "ad_failed":
      return localize(
        "That ad could not be shown. Here is the next option.",
        "No se pudo mostrar ese anuncio. Esta es la siguiente opción.",
      );
    case "claim_failed":
      return localize(
        "The reward could not be confirmed. Check your connection and try again.",
        "No se pudo confirmar la recompensa. Revisa tu conexión e inténtalo de nuevo.",
      );
    case "unlock_failed":
      return localize(
        "Still could not activate this access window. Try again.",
        "Still no pudo activar este período de acceso. Inténtalo de nuevo.",
      );
    case "return_failed":
      return localize(
        `Access is active, but Still could not open ${appLabel}. Open it from your Home Screen; Still will not interrupt during this window.`,
        `El acceso está activo, pero Still no pudo abrir ${appLabel}. Ábrela desde tu pantalla de inicio; Still no interrumpirá durante este período.`,
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
    addProvisionalToken,
    cancelShortcut,
    config,
    deviceId,
    preferences,
    unlockShortcut,
    unlockShortcutWithPause,
    wallet,
  } = useAppState();
  const { status: adStatus, showPrepared, retry } = useRewardAd();
  const { targets, disableScheme } = useShortcutTargets();

  const gate = gateFromUnlockAction(
    getInterventionUnlockAction({
      supportsDirectAd: true,
      hasDevice: Boolean(deviceId),
      rewardProvider: config.rewardProvider,
      rewardStatus: adStatus,
      rewardAdsRemainingToday: wallet.rewardAdsRemainingToday,
      rewardedPassesRemainingToday: wallet.rewardedPassesRemainingToday,
      rewardedBalance: wallet.rewardedBalance,
      maxRewardTokenBalance: config.maxRewardTokenBalance,
      emergencyRemaining: wallet.emergencyRemaining,
    }),
  );
  const [flow, dispatch] = useReducer(transition, undefined, () =>
    createInterventionFlow({ gate, isSetupTest }),
  );
  const working = useRef(false);

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
      formatUnlockDuration(seconds, "en"),
      formatUnlockDuration(seconds, "es"),
    );

  const watchAd = useCallback(async () => {
    if (working.current || flow.phase !== "gate" || flow.gate !== "watch_ad")
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
            }),
            headers: { "idempotency-key": result.clientEventId },
          },
        );
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
    if (working.current) return;
    const fromDecision = flow.phase === "decision";
    const fromWalletGate =
      flow.phase === "gate" &&
      (flow.gate === "use_rewarded_pass" || flow.gate === "use_emergency");
    if (!fromDecision && !fromWalletGate) return;

    working.current = true;
    const method = enterMethod(flow);
    const source =
      method === "pause"
        ? "pause"
        : method === "fresh_reward" || flow.gate === "use_rewarded_pass"
          ? "rewarded"
          : "emergency";
    dispatch(fromDecision ? { type: "ENTER" } : { type: "USE_PASS" });
    const stage: { current: "unlock" | "return" } = { current: "unlock" };
    try {
      await completeShortcutAndReturn({
        contextId: shortcutId,
        freshReward: method === "fresh_reward",
        unlockShortcut:
          method === "pause"
            ? (contextId) => unlockShortcutWithPause(contextId)
            : unlockShortcut,
        onUnlockActivated: () => {
          capture("unlock_started", {
            source,
            resumedIntent: true,
            trigger: "ios_shortcut",
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
        openUrl: Linking.openURL,
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
    const keepReward = keepsRewardOnLeave(flow);
    dispatch({ type: "DECLINE" });
    try {
      if (keepReward) await addProvisionalToken();
      // An expired intervention is already closed from the user's point of view.
      await cancelShortcut(shortcutId).catch(() => undefined);
      capture("intervention_declined", {
        afterAd: keepReward,
        trigger: "ios_shortcut",
      });
    } finally {
      dispatch({ type: "FINISHED" });
      working.current = false;
    }
    await onLeave();
  }, [addProvisionalToken, cancelShortcut, flow, onLeave, shortcutId]);

  const acknowledgeTest = useCallback(async () => {
    await restrictionEngine
      .finishShortcutSetupTest(shortcutId)
      .catch(() => undefined);
    dispatch({ type: "TEST_ACKNOWLEDGED" });
    router.replace({
      pathname: "/shortcut-setup",
      params: { tested: appLabel },
    });
  }, [appLabel, shortcutId]);

  if (flow.phase === "setup_test" || flow.outcome === "tested") {
    return (
      <Screen style={styles.root} contentContainerStyle={styles.screen}>
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
              `From now on, opening ${appLabel} brings you here first. This test did not count as an opening.`,
              `A partir de ahora, abrir ${appLabel} te trae primero aquí. Esta prueba no contó como una apertura.`,
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
  const unlockLabel = durationLabel(
    flow.earnedBy === "pause" || flow.phase === "pause"
      ? PAUSE_ALLOWANCE_SECONDS
      : preferences.unlockDurationSeconds,
  );

  let headline: string;
  let question: string;
  if (flow.phase === "decision") {
    headline = localize(
      `Do you still want to open ${appLabel}?`,
      `¿Sigues queriendo abrir ${appLabel}?`,
    );
    question =
      flow.earnedBy === "ad"
        ? localize(
            `Going in keeps ${appLabel} open for ${unlockLabel}. If you leave now, the pass you just earned is saved for later.`,
            `Si entras, ${appLabel} queda abierta durante ${unlockLabel}. Si te vas ahora, el pase que acabas de ganar se guarda para después.`,
          )
        : localize(
            `Going in keeps ${appLabel} open for ${unlockLabel}.`,
            `Si entras, ${appLabel} queda abierta durante ${unlockLabel}.`,
          );
  } else if (flow.phase === "pause") {
    headline = localize(
      `Breathe.\n${flow.pauseSecondsLeft}`,
      `Respira.\n${flow.pauseSecondsLeft}`,
    );
    question = localize(
      "No ad is available right now. You can decide when the pause ends.",
      "Ahora mismo no hay ningún anuncio disponible. Podrás decidir cuando termine la pausa.",
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
      `What do you want from the next ${unlockLabel}?`,
      `¿Qué quieres de los próximos ${unlockLabel}?`,
    );
  }

  let continueLabel: string;
  let continueAction: (() => void) | null = null;
  if (flow.phase === "decision") {
    continueLabel = localize("I want to go in", "Quiero entrar");
    continueAction = () => void enter();
  } else if (flow.phase === "pause") {
    continueLabel = localize(
      `I want to go in · ${flow.pauseSecondsLeft}s`,
      `Quiero entrar · ${flow.pauseSecondsLeft} s`,
    );
  } else if (flow.phase === "ad" || flow.phase === "claiming") {
    continueLabel = localize("Ad in progress…", "Anuncio en curso…");
  } else if (flow.phase === "entering") {
    continueLabel = localize("Opening…", "Abriendo…");
  } else if (flow.gate === "watch_ad") {
    continueLabel = localize("Watch ad", "Ver anuncio");
    continueAction = () => void watchAd();
  } else if (flow.gate === "use_rewarded_pass") {
    continueLabel = localize(
      `Use 1 pass · Open ${appLabel}`,
      `Usar 1 pase · Abrir ${appLabel}`,
    );
    continueAction = () => void enter();
  } else if (flow.gate === "use_emergency") {
    continueLabel = localize(
      `Emergency access · Open ${appLabel}`,
      `Acceso de emergencia · Abrir ${appLabel}`,
    );
    continueAction = () => void enter();
  } else {
    continueLabel = localize("Preparing the ad…", "Preparando el anuncio…");
  }

  return (
    <Screen style={styles.root} contentContainerStyle={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.topline}>
        <Eyebrow style={styles.lightLabel}>{appLabel}</Eyebrow>
      </View>

      <AttentionField
        accessibilityLabel={localize(
          "The attention field opens to make space for a decision.",
          "El campo de atención se abre para dejar espacio a una decisión.",
        )}
        mode="intervention"
        dark
      />

      <View style={styles.copy}>
        <Display style={styles.title}>{headline}</Display>
        <Body style={styles.question}>{question}</Body>
        {flow.notice ? (
          <Body accessibilityLiveRegion="polite" style={styles.notice}>
            {noticeCopy(flow.notice, appLabel)}
          </Body>
        ) : null}
      </View>

      <View style={styles.actions}>
        {finished ? (
          <FilledButton
            label={localize("Go to Today", "Ir a Hoy")}
            onPress={() => router.replace("/(tabs)/(today)")}
          />
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
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: busy || !continueAction }}
              disabled={busy || !continueAction}
              onPress={continueAction ?? undefined}
              style={({ pressed }) => [
                styles.secondary,
                pressed && styles.pressed,
                (busy || !continueAction) && styles.disabled,
              ]}
            >
              <Text style={styles.secondaryLabel}>{continueLabel}</Text>
              <Text style={styles.secondaryArrow}>→</Text>
            </Pressable>
            <Body style={styles.note}>
              {localize(
                "Continuing is a choice, not a failure.",
                "Continuar es una elección, no un fracaso.",
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
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primary,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.primaryLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.graphite },
  screen: {
    minHeight: 760,
    flexGrow: 1,
    justifyContent: "space-between",
    paddingVertical: spacing.lg,
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
  title: {
    color: colors.chalk,
    fontSize: 38,
    lineHeight: 41,
    letterSpacing: -1.2,
  },
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
  pressed: { opacity: 0.62 },
  disabled: { opacity: 0.42 },
});

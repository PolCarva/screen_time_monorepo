import type { InterventionUnlockAction } from "./shortcut-intervention";

/** Length of the breathing pause offered when there is no ad, pass or emergency access. */
export const PAUSE_SECONDS = 15;
/**
 * A pause costs nothing, so it buys a short window. This keeps "go offline to
 * skip the ad" from being a better deal than watching it.
 */
export const PAUSE_ALLOWANCE_SECONDS = 5 * 60;

export type InterventionGate =
  | "watch_ad"
  | "preparing_ad"
  | "use_rewarded_pass"
  | "use_emergency"
  | "timed_pause";

export type InterventionNotice =
  | "ad_dismissed"
  | "ad_failed"
  | "claim_failed"
  | "unlock_failed"
  | "return_failed";

export type InterventionPhase =
  | "setup_test"
  | "gate"
  | "ad"
  | "claiming"
  | "pause"
  | "decision"
  | "entering"
  | "leaving"
  | "done";

export type InterventionFlowState = {
  phase: InterventionPhase;
  /** Latest friction on offer. Tracked in every phase so nothing is missed mid-ad. */
  gate: InterventionGate;
  notice: InterventionNotice | null;
  pauseSecondsLeft: number;
  /** What earned the decision screen; it decides how entering is paid for. */
  earnedBy: "ad" | "pause" | null;
  outcome: "entered" | "left" | "tested" | null;
};

export type InterventionFlowEvent =
  | { type: "GATE_CHANGED"; gate: InterventionGate }
  | { type: "WATCH_AD" }
  | { type: "AD_EARNED" }
  | { type: "AD_DISMISSED" }
  | { type: "AD_FAILED" }
  | { type: "CLAIM_CONFIRMED" }
  | { type: "CLAIM_FAILED" }
  | { type: "PAUSE_TICK" }
  | { type: "USE_PASS" }
  | { type: "ENTER" }
  | { type: "DECLINE" }
  | { type: "ENTER_FAILED"; stage: "unlock" | "return" }
  | { type: "FINISHED" }
  | { type: "TEST_ACKNOWLEDGED" };

/**
 * `retry_ad` is only ever returned when there is no ad, no stored pass and no
 * emergency access, which is exactly when the timed pause takes over.
 */
export function gateFromUnlockAction(
  action: InterventionUnlockAction | null,
): InterventionGate {
  switch (action) {
    case "watch_ad":
    case "preparing_ad":
    case "use_rewarded_pass":
    case "use_emergency":
      return action;
    default:
      return "timed_pause";
  }
}

export function createInterventionFlow(input: {
  gate: InterventionGate;
  isSetupTest?: boolean;
}): InterventionFlowState {
  const base: InterventionFlowState = {
    phase: "gate",
    gate: input.gate,
    notice: null,
    pauseSecondsLeft: PAUSE_SECONDS,
    earnedBy: null,
    outcome: null,
  };
  if (input.isSetupTest) return { ...base, phase: "setup_test" };
  return settleAtGate(base, null);
}

/** Lands on the gate, or straight in the pause when the pause is all that is left. */
function settleAtGate(
  state: InterventionFlowState,
  notice: InterventionNotice | null,
): InterventionFlowState {
  if (state.gate === "timed_pause")
    return {
      ...state,
      phase: "pause",
      notice,
      pauseSecondsLeft: PAUSE_SECONDS,
      earnedBy: null,
    };
  return { ...state, phase: "gate", notice, earnedBy: null };
}

export function transition(
  state: InterventionFlowState,
  event: InterventionFlowEvent,
): InterventionFlowState {
  if (event.type === "GATE_CHANGED") {
    const next = { ...state, gate: event.gate };
    // A pause that already started is never swapped for something else.
    return state.phase === "gate" ? settleAtGate(next, state.notice) : next;
  }

  switch (state.phase) {
    case "setup_test":
      return event.type === "TEST_ACKNOWLEDGED"
        ? { ...state, phase: "done", outcome: "tested" }
        : state;

    case "gate":
      if (event.type === "WATCH_AD" && state.gate === "watch_ad")
        return { ...state, phase: "ad", notice: null };
      if (
        event.type === "USE_PASS" &&
        (state.gate === "use_rewarded_pass" || state.gate === "use_emergency")
      )
        return { ...state, phase: "entering", notice: null };
      if (event.type === "DECLINE")
        return { ...state, phase: "leaving", notice: null };
      return state;

    case "ad":
      if (event.type === "AD_EARNED")
        return { ...state, phase: "claiming", notice: null };
      // Closing the ad early is not punished: no reward, back to the choice.
      if (event.type === "AD_DISMISSED")
        return settleAtGate(state, "ad_dismissed");
      if (event.type === "AD_FAILED") return settleAtGate(state, "ad_failed");
      return state;

    case "claiming":
      if (event.type === "CLAIM_CONFIRMED")
        return { ...state, phase: "decision", earnedBy: "ad", notice: null };
      if (event.type === "CLAIM_FAILED")
        return settleAtGate(state, "claim_failed");
      return state;

    case "pause":
      if (event.type === "PAUSE_TICK") {
        const left = Math.max(0, state.pauseSecondsLeft - 1);
        return left === 0
          ? { ...state, phase: "decision", earnedBy: "pause", pauseSecondsLeft: 0 }
          : { ...state, pauseSecondsLeft: left };
      }
      if (event.type === "DECLINE")
        return { ...state, phase: "leaving", notice: null };
      return state;

    case "decision":
      if (event.type === "ENTER")
        return { ...state, phase: "entering", notice: null };
      if (event.type === "DECLINE")
        return { ...state, phase: "leaving", notice: null };
      return state;

    case "entering":
      if (event.type === "FINISHED")
        return { ...state, phase: "done", outcome: "entered" };
      if (event.type === "ENTER_FAILED") {
        // The allowance is already running when only the hand-back failed, so
        // the user is told to open the app themselves rather than pay twice.
        if (event.stage === "return")
          return {
            ...state,
            phase: "done",
            outcome: "entered",
            notice: "return_failed",
          };
        return state.earnedBy
          ? { ...state, phase: "decision", notice: "unlock_failed" }
          : settleAtGate(state, "unlock_failed");
      }
      return state;

    case "leaving":
      return event.type === "FINISHED"
        ? { ...state, phase: "done", outcome: "left" }
        : state;

    case "done":
      return state;
  }
}

/** How "enter" is paid for once the user decides to go in. */
export function enterMethod(
  state: Pick<InterventionFlowState, "earnedBy">,
): "fresh_reward" | "pause" | "wallet" {
  if (state.earnedBy === "ad") return "fresh_reward";
  if (state.earnedBy === "pause") return "pause";
  return "wallet";
}

/**
 * A completed ad is never wasted: walking away after watching it keeps the
 * reward as a stored pass for next time.
 */
export function keepsRewardOnLeave(
  state: Pick<InterventionFlowState, "earnedBy">,
): boolean {
  return state.earnedBy === "ad";
}

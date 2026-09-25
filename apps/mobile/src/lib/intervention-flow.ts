import { DEFAULT_ACCESS_DURATION_SECONDS } from "@screen-time/contracts";

/**
 * Length of the breathing pause offered when there is no ad to show. Once it
 * is over the user chooses how long to stay, as after an ad.
 */
export const PAUSE_SECONDS = 15;

/**
 * What the gate offers: only the ad. While it loads the gate waits for it
 * ("preparing"); with no ad at all, the timed pause. There are no saved passes
 * (docs/ads-only-pause-plan.md, D1-D2).
 */
export type InterventionGate = {
  ad: "ready" | "preparing" | "none";
};

/** No ad to show: the timed pause is all that is left. */
export const NOTHING_LEFT: InterventionGate = { ad: "none" };

export function isTimedPause(gate: InterventionGate): boolean {
  return gate.ad === "none";
}

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
  /**
   * The window the user dragged the slider to, in seconds. Survives a failed
   * unlock and a trip back to the gate, so nobody has to choose twice.
   */
  durationSeconds: number;
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
  | { type: "CHOOSE_DURATION"; seconds: number }
  | { type: "ENTER" }
  | { type: "DECLINE" }
  | { type: "ENTER_FAILED"; stage: "unlock" | "return" }
  | { type: "FINISHED" }
  | { type: "TEST_ACKNOWLEDGED" };

/** A platform that cannot offer anything falls back to the timed pause. */
export function gateFrom(options: InterventionGate | null): InterventionGate {
  return options ?? NOTHING_LEFT;
}

export function createInterventionFlow(input: {
  gate: InterventionGate;
  isSetupTest?: boolean;
  /** Where the slider starts: the last window this device chose, if any. */
  durationSeconds?: number;
}): InterventionFlowState {
  const base: InterventionFlowState = {
    phase: "gate",
    gate: input.gate,
    notice: null,
    pauseSecondsLeft: PAUSE_SECONDS,
    earnedBy: null,
    durationSeconds: input.durationSeconds ?? DEFAULT_ACCESS_DURATION_SECONDS,
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
  if (isTimedPause(state.gate))
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
    if (event.gate.ad === state.gate.ad) return state;
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
      if (event.type === "WATCH_AD" && state.gate.ad === "ready")
        return { ...state, phase: "ad", notice: null };
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
      if (event.type === "CHOOSE_DURATION")
        return canChooseDuration(state)
          ? { ...state, durationSeconds: event.seconds }
          : state;
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

/**
 * How "enter" is paid for once the user decides to go in: the ad just
 * watched, or the free pause. Walking away after the ad keeps nothing.
 */
export function enterMethod(
  state: Pick<InterventionFlowState, "earnedBy">,
): "fresh_reward" | "pause" {
  return state.earnedBy === "ad" ? "fresh_reward" : "pause";
}

/** After the ad or after the breathing pause, the user chooses how long. */
export function canChooseDuration(
  state: Pick<InterventionFlowState, "earnedBy">,
): boolean {
  return state.earnedBy !== null;
}

/** The window to ask the platform for, in seconds. */
export function accessSecondsFor(
  state: Pick<InterventionFlowState, "durationSeconds">,
): number {
  return state.durationSeconds;
}

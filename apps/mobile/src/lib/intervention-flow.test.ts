import { describe, expect, it } from "vitest";

import {
  ACCESS_DURATION_STEPS,
  DEFAULT_ACCESS_DURATION_SECONDS,
  REST_OF_DAY_SECONDS,
} from "@screen-time/contracts";

import {
  type InterventionFlowEvent,
  type InterventionFlowState,
  PAUSE_ALLOWANCE_SECONDS,
  PAUSE_SECONDS,
  accessSecondsFor,
  canChooseDuration,
  createInterventionFlow,
  enterMethod,
  gateFromUnlockAction,
  keepsRewardOnLeave,
  transition,
} from "./intervention-flow";

function run(state: InterventionFlowState, ...events: InterventionFlowEvent[]) {
  return events.reduce(transition, state);
}

const atAdGate = () => createInterventionFlow({ gate: "watch_ad" });
const ticks = (count: number): InterventionFlowEvent[] =>
  Array.from({ length: count }, () => ({ type: "PAUSE_TICK" }) as const);

describe("intervention gate selection", () => {
  it("passes through every friction the unlock table can offer", () => {
    expect(gateFromUnlockAction("watch_ad")).toBe("watch_ad");
    expect(gateFromUnlockAction("preparing_ad")).toBe("preparing_ad");
    expect(gateFromUnlockAction("use_rewarded_pass")).toBe("use_rewarded_pass");
    expect(gateFromUnlockAction("use_emergency")).toBe("use_emergency");
  });

  it("turns 'nothing left' into the timed pause so nobody is stranded", () => {
    expect(gateFromUnlockAction("retry_ad")).toBe("timed_pause");
    expect(gateFromUnlockAction(null)).toBe("timed_pause");
  });

  it("keeps the free pause short compared with a paid unlock", () => {
    expect(PAUSE_SECONDS).toBe(15);
    expect(PAUSE_ALLOWANCE_SECONDS).toBe(300);
  });
});

describe("intervention flow: ad first, decision after", () => {
  it("shows the two options only after the ad is completed and confirmed", () => {
    const watching = run(atAdGate(), { type: "WATCH_AD" });
    expect(watching.phase).toBe("ad");

    const claiming = run(watching, { type: "AD_EARNED" });
    expect(claiming.phase).toBe("claiming");
    // Neither option is reachable before the server confirms the reward.
    expect(run(claiming, { type: "ENTER" }).phase).toBe("claiming");
    expect(run(claiming, { type: "DECLINE" }).phase).toBe("claiming");

    const decision = run(claiming, { type: "CLAIM_CONFIRMED" });
    expect(decision).toMatchObject({ phase: "decision", earnedBy: "ad" });
    expect(enterMethod(decision)).toBe("fresh_reward");
  });

  it("enters the app when the user chooses to", () => {
    const entered = run(
      atAdGate(),
      { type: "WATCH_AD" },
      { type: "AD_EARNED" },
      { type: "CLAIM_CONFIRMED" },
      { type: "ENTER" },
      { type: "FINISHED" },
    );
    expect(entered).toMatchObject({ phase: "done", outcome: "entered" });
  });

  it("keeps the reward as a stored pass when the user walks away after the ad", () => {
    const leaving = run(
      atAdGate(),
      { type: "WATCH_AD" },
      { type: "AD_EARNED" },
      { type: "CLAIM_CONFIRMED" },
      { type: "DECLINE" },
    );
    expect(leaving.phase).toBe("leaving");
    expect(keepsRewardOnLeave(leaving)).toBe(true);
    expect(run(leaving, { type: "FINISHED" })).toMatchObject({
      phase: "done",
      outcome: "left",
    });
  });

  it("lets the user leave from the gate without watching anything", () => {
    const leaving = run(atAdGate(), { type: "DECLINE" });
    expect(leaving.phase).toBe("leaving");
    expect(keepsRewardOnLeave(leaving)).toBe(false);
  });

  it("returns to the gate without punishment when the ad is closed early", () => {
    const back = run(atAdGate(), { type: "WATCH_AD" }, { type: "AD_DISMISSED" });
    expect(back).toMatchObject({
      phase: "gate",
      notice: "ad_dismissed",
      earnedBy: null,
    });
  });

  it("moves to the next fallback when the ad fails or the claim is rejected", () => {
    const failed = run(
      atAdGate(),
      { type: "WATCH_AD" },
      { type: "GATE_CHANGED", gate: "use_rewarded_pass" },
      { type: "AD_FAILED" },
    );
    expect(failed).toMatchObject({
      phase: "gate",
      gate: "use_rewarded_pass",
      notice: "ad_failed",
    });

    const rejected = run(
      atAdGate(),
      { type: "WATCH_AD" },
      { type: "AD_EARNED" },
      { type: "GATE_CHANGED", gate: "timed_pause" },
      { type: "CLAIM_FAILED" },
    );
    expect(rejected).toMatchObject({
      phase: "pause",
      notice: "claim_failed",
      pauseSecondsLeft: PAUSE_SECONDS,
    });
  });

  it("does not start an ad from a gate that has no ad to show", () => {
    for (const gate of ["preparing_ad", "use_rewarded_pass"] as const) {
      const state = createInterventionFlow({ gate });
      expect(run(state, { type: "WATCH_AD" })).toEqual(state);
    }
  });

  it("clears the previous notice once the user acts again", () => {
    const retried = run(
      atAdGate(),
      { type: "WATCH_AD" },
      { type: "AD_DISMISSED" },
      { type: "GATE_CHANGED", gate: "watch_ad" },
      { type: "WATCH_AD" },
    );
    expect(retried).toMatchObject({ phase: "ad", notice: null });
  });
});

describe("intervention flow: stored pass and emergency access", () => {
  it("sends a paid pass to the same duration choice the ad earns", () => {
    for (const gate of ["use_rewarded_pass", "use_emergency"] as const) {
      const deciding = run(createInterventionFlow({ gate }), {
        type: "USE_PASS",
      });
      expect(deciding).toMatchObject({ phase: "decision", earnedBy: "wallet" });
      expect(canChooseDuration(deciding)).toBe(true);
      expect(enterMethod(deciding)).toBe("wallet");
      expect(run(deciding, { type: "ENTER" }).phase).toBe("entering");
    }
  });

  it("ignores a pass tap when the gate is about an ad", () => {
    const state = atAdGate();
    expect(run(state, { type: "USE_PASS" })).toEqual(state);
  });

  it("keeps the chosen window on screen if the wallet unlock fails", () => {
    const back = run(
      createInterventionFlow({ gate: "use_emergency" }),
      { type: "USE_PASS" },
      { type: "CHOOSE_DURATION", seconds: 1_800 },
      { type: "ENTER" },
      { type: "ENTER_FAILED", stage: "unlock" },
    );
    expect(back).toMatchObject({
      phase: "decision",
      earnedBy: "wallet",
      durationSeconds: 1_800,
      notice: "unlock_failed",
    });
  });
});

describe("intervention flow: timed pause", () => {
  it("starts the pause immediately when nothing else is available", () => {
    expect(createInterventionFlow({ gate: "timed_pause" })).toMatchObject({
      phase: "pause",
      pauseSecondsLeft: PAUSE_SECONDS,
    });
  });

  it("starts the pause when the ad being prepared never arrives", () => {
    const paused = run(createInterventionFlow({ gate: "preparing_ad" }), {
      type: "GATE_CHANGED",
      gate: "timed_pause",
    });
    expect(paused.phase).toBe("pause");
  });

  it("only offers to enter after the full countdown", () => {
    const paused = createInterventionFlow({ gate: "timed_pause" });
    const almost = run(paused, ...ticks(PAUSE_SECONDS - 1));
    expect(almost).toMatchObject({ phase: "pause", pauseSecondsLeft: 1 });
    expect(run(almost, { type: "ENTER" }).phase).toBe("pause");

    const decision = run(almost, { type: "PAUSE_TICK" });
    expect(decision).toMatchObject({ phase: "decision", earnedBy: "pause" });
    expect(enterMethod(decision)).toBe("pause");
    expect(keepsRewardOnLeave(decision)).toBe(false);
  });

  it("can be abandoned at any second", () => {
    const leaving = run(
      createInterventionFlow({ gate: "timed_pause" }),
      ...ticks(4),
      { type: "DECLINE" },
    );
    expect(leaving.phase).toBe("leaving");
  });

  it("is never swapped for an ad once it has started", () => {
    const state = run(
      createInterventionFlow({ gate: "timed_pause" }),
      ...ticks(3),
      { type: "GATE_CHANGED", gate: "watch_ad" },
    );
    expect(state).toMatchObject({
      phase: "pause",
      gate: "watch_ad",
      pauseSecondsLeft: PAUSE_SECONDS - 3,
    });
  });

  it("goes back to the decision, not the countdown, if the unlock fails", () => {
    const back = run(
      createInterventionFlow({ gate: "timed_pause" }),
      ...ticks(PAUSE_SECONDS),
      { type: "ENTER" },
      { type: "ENTER_FAILED", stage: "unlock" },
    );
    expect(back).toMatchObject({
      phase: "decision",
      earnedBy: "pause",
      notice: "unlock_failed",
    });
  });
});

describe("intervention flow: hand-back and setup test", () => {
  it("counts the visit as entered when only the hand-back failed", () => {
    const done = run(
      atAdGate(),
      { type: "WATCH_AD" },
      { type: "AD_EARNED" },
      { type: "CLAIM_CONFIRMED" },
      { type: "ENTER" },
      { type: "ENTER_FAILED", stage: "return" },
    );
    expect(done).toMatchObject({
      phase: "done",
      outcome: "entered",
      notice: "return_failed",
    });
  });

  it("shows the connected screen instead of any friction during a setup test", () => {
    const test = createInterventionFlow({ gate: "watch_ad", isSetupTest: true });
    expect(test.phase).toBe("setup_test");
    expect(run(test, { type: "WATCH_AD" })).toEqual(test);
    expect(run(test, { type: "GATE_CHANGED", gate: "timed_pause" }).phase).toBe(
      "setup_test",
    );
    expect(run(test, { type: "TEST_ACKNOWLEDGED" })).toMatchObject({
      phase: "done",
      outcome: "tested",
    });
  });

  it("ignores every event once finished", () => {
    const done = run(atAdGate(), { type: "DECLINE" }, { type: "FINISHED" });
    expect(
      run(done, { type: "WATCH_AD" }, { type: "ENTER" }, { type: "DECLINE" }),
    ).toEqual(done);
  });
});

describe("intervention flow: choosing the window after paying", () => {
  const afterAd = () =>
    run(
      atAdGate(),
      { type: "WATCH_AD" },
      { type: "AD_EARNED" },
      { type: "CLAIM_CONFIRMED" },
    );

  it("starts at the default window, with nothing chosen beforehand", () => {
    expect(atAdGate().durationSeconds).toBe(DEFAULT_ACCESS_DURATION_SECONDS);
    expect(afterAd().durationSeconds).toBe(DEFAULT_ACCESS_DURATION_SECONDS);
  });

  it("can start from the window this device chose last time", () => {
    const seeded = createInterventionFlow({
      gate: "watch_ad",
      durationSeconds: 1_800,
    });
    expect(seeded.durationSeconds).toBe(1_800);
  });

  it("accepts every stop from one minute to the rest of the day", () => {
    for (const seconds of ACCESS_DURATION_STEPS) {
      const chosen = run(afterAd(), { type: "CHOOSE_DURATION", seconds });
      expect(chosen).toMatchObject({ phase: "decision", durationSeconds: seconds });
      expect(accessSecondsFor(chosen)).toBe(seconds);
    }
  });

  it("carries the chosen window into entering", () => {
    const entering = run(
      afterAd(),
      { type: "CHOOSE_DURATION", seconds: REST_OF_DAY_SECONDS },
      { type: "ENTER" },
    );
    expect(entering).toMatchObject({
      phase: "entering",
      durationSeconds: REST_OF_DAY_SECONDS,
    });
    expect(accessSecondsFor(entering)).toBe(REST_OF_DAY_SECONDS);
  });

  it("gives the free pause a fixed short window the user cannot stretch", () => {
    const decision = run(
      createInterventionFlow({ gate: "timed_pause" }),
      ...ticks(PAUSE_SECONDS),
    );
    expect(canChooseDuration(decision)).toBe(false);
    expect(accessSecondsFor(decision)).toBe(PAUSE_ALLOWANCE_SECONDS);

    const stretched = run(decision, {
      type: "CHOOSE_DURATION",
      seconds: REST_OF_DAY_SECONDS,
    });
    expect(accessSecondsFor(stretched)).toBe(PAUSE_ALLOWANCE_SECONDS);
  });

  it("ignores a duration change outside the decision", () => {
    const gate = atAdGate();
    expect(run(gate, { type: "CHOOSE_DURATION", seconds: 3_600 })).toEqual(gate);
    const entering = run(afterAd(), { type: "ENTER" });
    expect(
      run(entering, { type: "CHOOSE_DURATION", seconds: 3_600 }).durationSeconds,
    ).toBe(DEFAULT_ACCESS_DURATION_SECONDS);
  });

  it("keeps the chosen window when the gate changes underneath", () => {
    const chosen = run(afterAd(), { type: "CHOOSE_DURATION", seconds: 3_600 });
    const moved = run(chosen, { type: "GATE_CHANGED", gate: "timed_pause" });
    expect(moved).toMatchObject({ phase: "decision", durationSeconds: 3_600 });
  });
});

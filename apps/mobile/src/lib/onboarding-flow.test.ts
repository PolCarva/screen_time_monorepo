import { describe, expect, it } from "vitest";

import {
  canContinue,
  firedSince,
  firstSetupStep,
  firstUnverifiedSetupStep,
  initialProgress,
  nextStep,
  onboardingSteps,
  parseProgress,
  previousStep,
  probeOutcome,
  resolveStep,
  setupSummary,
  stepProgress,
  type FlowContext,
  type SetupSignals,
} from "./onboarding-flow";

const android: FlowContext = {
  platform: "android",
  pausesEnabled: true,
  usageSource: "android-usage",
  usageGranted: false,
  adsConsent: "not-required",
  aggressiveOem: false,
};

const ios: FlowContext = {
  platform: "ios",
  pausesEnabled: true,
  usageSource: "none",
  usageGranted: false,
  adsConsent: "not-required",
  aggressiveOem: false,
};

const nothing: SetupSignals = {
  adultConfirmed: false,
  adsConsentResolved: false,
  accessibilityEnabled: false,
  accessibilityRunning: false,
  selectedApps: 0,
  batteryUnrestricted: false,
  keepAliveConfirmed: false,
  liveTestVerified: false,
  appTests: { total: 0, verified: 0 },
  noticesDecided: false,
};

describe("which steps apply (§2)", () => {
  it("tells the Android story with the usage permission, then the verified setup", () => {
    expect(onboardingSteps(android)).toEqual([
      "guess",
      "usage-permission",
      "life",
      "where",
      "habit",
      "pause-demo",
      "how",
      "adult",
      "accessibility",
      "apps",
      "live-test",
      "done",
    ]);
  });

  it("shows the reveal only once usage access was granted", () => {
    const steps = onboardingSteps({ ...android, usageGranted: true });
    expect(steps.slice(0, 4)).toEqual([
      "guess",
      "usage-permission",
      "reveal",
      "life",
    ]);
  });

  it("keeps iOS without Screen Time on the guess alone (D1)", () => {
    expect(onboardingSteps(ios)).toEqual([
      "guess",
      "life",
      "where",
      "habit",
      "pause-demo",
      "how",
      "adult",
      "apps",
      "shortcuts",
      "app-tests",
      "notices",
      "done",
    ]);
  });

  it("asks for Screen Time on iOS once the report is available", () => {
    const steps = onboardingSteps({
      ...ios,
      usageSource: "ios-screen-time",
      usageGranted: true,
    });
    expect(steps.slice(0, 3)).toEqual(["guess", "usage-permission", "reveal"]);
  });

  it("adds ads consent unless UMP said it is not required (D12)", () => {
    expect(onboardingSteps({ ...android, adsConsent: "unknown" })).toContain(
      "ads-consent",
    );
    expect(onboardingSteps({ ...android, adsConsent: "required" })).toContain(
      "ads-consent",
    );
    expect(onboardingSteps(android)).not.toContain("ads-consent");
  });

  it("adds the keep-alive step only on makers that kill background apps", () => {
    expect(onboardingSteps({ ...android, aggressiveOem: true })).toEqual(
      expect.arrayContaining(["apps", "keep-alive", "live-test"]),
    );
    expect(onboardingSteps(android)).not.toContain("keep-alive");
  });

  it("ends in the 'coming back soon' screen when pauses are off", () => {
    const steps = onboardingSteps({ ...ios, pausesEnabled: false });
    expect(steps.slice(-2)).toEqual(["adult", "pauses-off"]);
    expect(steps).not.toContain("done");
  });
});

describe("moving between steps", () => {
  it("goes forward and back through the applicable steps", () => {
    expect(nextStep(android, "guess")).toBe("usage-permission");
    expect(nextStep(android, "usage-permission")).toBe("life");
    expect(
      nextStep({ ...android, usageGranted: true }, "usage-permission"),
    ).toBe("reveal");
    expect(previousStep(android, "life")).toBe("usage-permission");
    expect(nextStep(android, "done")).toBeNull();
    expect(previousStep(android, "guess")).toBeNull();
  });

  it("skips to the first setup step", () => {
    expect(firstSetupStep(android)).toBe("adult");
  });

  it("resumes at the next step that still applies", () => {
    // Consent turned out not to be required after it was stored as the step.
    expect(resolveStep(android, "ads-consent")).toBe("accessibility");
    // A stored reveal without access resumes the story at the next screen.
    expect(resolveStep(android, "reveal")).toBe("life");
    // An Android step stored, then read on iOS, lands on the next iOS one.
    expect(resolveStep(ios, "live-test")).toBe("shortcuts");
    expect(resolveStep(ios, "guess")).toBe("guess");
  });

  it("measures progress from the first step to the last", () => {
    expect(stepProgress(android, "guess")).toBe(0);
    expect(stepProgress(android, "done")).toBe(1);
    const middle = stepProgress(android, "adult");
    expect(middle).toBeGreaterThan(0.5);
    expect(middle).toBeLessThan(1);
  });
});

describe("verification gates (§5.1, D7)", () => {
  it("never moves a signal step on without its signal", () => {
    expect(canContinue("adult", nothing)).toBe(false);
    expect(canContinue("accessibility", nothing)).toBe(false);
    expect(canContinue("apps", nothing)).toBe(false);
    expect(canContinue("live-test", nothing)).toBe(false);
    expect(canContinue("app-tests", nothing)).toBe(false);
  });

  it("needs Accessibility both on and running", () => {
    expect(
      canContinue("accessibility", { ...nothing, accessibilityEnabled: true }),
    ).toBe(false);
    expect(
      canContinue("accessibility", {
        ...nothing,
        accessibilityEnabled: true,
        accessibilityRunning: true,
      }),
    ).toBe(true);
  });

  it("needs every chosen iOS app tested", () => {
    expect(
      canContinue("app-tests", { ...nothing, appTests: { total: 3, verified: 2 } }),
    ).toBe(false);
    expect(
      canContinue("app-tests", { ...nothing, appTests: { total: 3, verified: 3 } }),
    ).toBe(true);
  });

  it("lets advisory and story steps move on", () => {
    for (const step of ["guess", "how", "keep-alive", "notices", "shortcuts"] as const) {
      expect(canContinue(step, nothing)).toBe(true);
    }
  });

  it("finds the first required step still missing", () => {
    expect(firstUnverifiedSetupStep(android, nothing)).toBe("adult");
    expect(
      firstUnverifiedSetupStep(android, {
        ...nothing,
        adultConfirmed: true,
        accessibilityEnabled: true,
        accessibilityRunning: true,
      }),
    ).toBe("apps");
    expect(
      firstUnverifiedSetupStep(android, {
        ...nothing,
        adultConfirmed: true,
        accessibilityEnabled: true,
        accessibilityRunning: true,
        selectedApps: 2,
        liveTestVerified: true,
      }),
    ).toBeNull();
  });

  it("lists the summary with required and recommended items", () => {
    const summary = setupSummary(
      { ...android, aggressiveOem: true },
      { ...nothing, adultConfirmed: true, batteryUnrestricted: true },
    );
    expect(summary.map((item) => [item.step, item.requirement, item.verified])).toEqual([
      ["adult", "signal", true],
      ["accessibility", "signal", false],
      ["apps", "signal", false],
      ["keep-alive", "recommended", false],
      ["live-test", "signal", false],
    ]);
  });
});

describe("setup tests", () => {
  const base = {
    startedAt: 10_000,
    minFromStartMs: 8_000,
    minFromReturnMs: 2_000,
  };

  it("is verified by a confirmation after the test began", () => {
    expect(
      probeOutcome({ ...base, confirmedAt: 12_000, returnedAt: null, now: 13_000 }),
    ).toBe("verified");
    // A clock a moment behind still counts.
    expect(
      probeOutcome({ ...base, confirmedAt: 9_500, returnedAt: null, now: 13_000 }),
    ).toBe("verified");
  });

  it("ignores a confirmation from before the test (a stale verifiedAt)", () => {
    expect(
      probeOutcome({ ...base, confirmedAt: 1_000, returnedAt: null, now: 60_000 }),
    ).toBe("waiting");
  });

  it("fails only once Still is back and has waited long enough", () => {
    expect(
      probeOutcome({ ...base, confirmedAt: null, returnedAt: 12_000, now: 15_000 }),
    ).toBe("waiting");
    expect(
      probeOutcome({ ...base, confirmedAt: null, returnedAt: 12_000, now: 18_000 }),
    ).toBe("failed");
    expect(
      probeOutcome({ ...base, confirmedAt: null, returnedAt: 17_000, now: 18_500 }),
    ).toBe("waiting");
  });
});

describe("stored progress (D9)", () => {
  const now = new Date("2026-09-24T12:00:00.000Z");

  it("round-trips the initial progress", () => {
    const progress = initialProgress(now);
    expect(parseProgress(JSON.parse(JSON.stringify(progress)))).toEqual(progress);
    expect(progress.step).toBe("guess");
    expect(progress.guessMinutes).toBe(180);
  });

  it("drops what an incompatible build wrote", () => {
    expect(parseProgress(null)).toBeNull();
    expect(parseProgress({ version: 2 })).toBeNull();
    expect(parseProgress({ ...initialProgress(now), step: "tour" })).toBeNull();
  });

  it("snaps a stored guess to a slider stop", () => {
    expect(
      parseProgress({ ...initialProgress(now), guessMinutes: 1_000 })?.guessMinutes,
    ).toBe(720);
  });

  it("keeps a running test so a killed Still resumes it", () => {
    const progress = {
      ...initialProgress(now),
      step: "live-test" as const,
      probe: {
        kind: "android" as const,
        target: "com.instagram.android",
        startedAt: now.toISOString(),
      },
    };
    expect(parseProgress(progress)?.probe?.target).toBe("com.instagram.android");
  });
});

describe("iOS apps connected during this setup (§4.4)", () => {
  const since = Date.parse("2026-09-25T10:00:00.000Z");

  it("counts only automations that fired after the setup began", () => {
    const fired = firedSince(
      ["news", "fitness", "maps"],
      {
        news: { lastTriggeredAt: "2026-09-25T10:02:00.000Z" },
        // Connected weeks ago: says nothing about today.
        fitness: { lastTriggeredAt: "2026-09-01T08:00:00.000Z" },
      },
      since,
    );
    expect(Object.keys(fired)).toEqual(["news"]);
  });

  it("allows for second-precision native timestamps", () => {
    expect(
      Object.keys(
        firedSince(["news"], { news: { lastTriggeredAt: "2026-09-25T09:59:59.500Z" } }, since),
      ),
    ).toEqual(["news"]);
  });
});

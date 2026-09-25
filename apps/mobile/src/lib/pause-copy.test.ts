/// <reference types="node" />

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  PAUSE_COPY,
  openedTodayHeadline,
  pauseDeclineLabel,
} from "./pause-copy";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("pause copy shared by the pause and the onboarding replica", () => {
  it("names each platform's primary control", () => {
    expect(pauseDeclineLabel("android", "es")).toBe("Volver");
    expect(pauseDeclineLabel("ios", "es")).toBe("Ya no quiero entrar");
    expect(pauseDeclineLabel("ios", "en")).toBe("I don't want to go in anymore");
  });

  it("says how many times the app opened, the way each platform does", () => {
    expect(openedTodayHeadline("Instagram", 4, "ios", "es")).toBe(
      "Instagram se abrió\n4 veces hoy.",
    );
    expect(openedTodayHeadline("Instagram", 1, "android", "es")).toBe(
      "Instagram se abrió una vez hoy.",
    );
    expect(openedTodayHeadline("Instagram", 4, "android", "en")).toBe(
      "Instagram opened 4 times today.",
    );
  });

  it("matches the Android shield word for word", () => {
    const shield = source(
      "android/app/src/main/java/com/still/screentime/InterventionActivity.kt",
    );
    for (const text of [
      PAUSE_COPY.question.es,
      PAUSE_COPY.question.en,
      PAUSE_COPY.watchAd.es,
      PAUSE_COPY.watchAd.en,
      PAUSE_COPY.goBack.es,
      PAUSE_COPY.goBack.en,
    ]) {
      expect(shield).toContain(`"${text}"`);
    }
    expect(shield).toContain('"$appLabel se abrió $attemptLabel hoy."');
    expect(shield).toContain('spanish && attempts == 1 -> "una vez"');
  });

  it("is what the iOS pause itself renders", () => {
    const pause = source("src/components/shortcut-intervention.tsx");
    expect(pause).toContain("openedTodayHeadline(");
    expect(pause).toContain("PAUSE_COPY.question");
    expect(pause).toContain('pauseDeclineLabel("ios"');
    expect(pause).toContain("PAUSE_COPY.watchAd");
  });
});

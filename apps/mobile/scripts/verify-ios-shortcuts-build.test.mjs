import { describe, expect, it } from "vitest";

import {
  verifyAdMobApplicationIdentifier,
  verifyShortcutMetadata,
  verifySpanishPhrases,
  verifySpanishStrings,
} from "./verify-ios-shortcuts-build.mjs";

function summary(formatString, parameterIdentifiers) {
  return {
    actionSummary: {
      wrapper: { summaryString: { formatString, parameterIdentifiers } },
    },
  };
}

function validMetadata() {
  return {
    actions: {
      PauseAppIntent: {
        actionConfiguration: summary("Pause ${app}", ["app"]),
        isDiscoverable: true,
        openAppWhenRun: false,
        parameters: [
          {
            name: "app",
            dynamicOptionsSupport: 2,
            valueType: { entity: { wrapper: { typeName: "StillAppEntity" } } },
          },
        ],
        supportedModes: 9,
        title: { key: "Pause App" },
      },
      PauseBeforeOpeningIntent: {
        actionConfiguration: summary("Pause before opening ${appName}", ["appName"]),
        isDiscoverable: false,
        openAppWhenRun: false,
        parameters: [{ name: "appName", dynamicOptionsSupport: 1 }],
        supportedModes: 9,
        title: { key: "Pause Before Opening" },
      },
    },
    autoShortcuts: [
      {
        actionIdentifier: "PauseAppIntent",
        phraseTemplates: [{ key: "Pause ${app} with ${applicationName}" }],
      },
    ],
    queries: { StillAppQuery: { defaultQueryForEntity: true } },
  };
}

describe("iOS Shortcuts compiled-build verification", () => {
  it("accepts the complete foreground-capable App Intent contract", () => {
    expect(() => verifyShortcutMetadata(validMetadata())).not.toThrow();
  });

  it("rejects a build where Shortcuts can no longer discover the action", () => {
    const metadata = validMetadata();
    metadata.actions.PauseAppIntent.isDiscoverable = false;

    expect(() => verifyShortcutMetadata(metadata)).toThrow("discoverable");
  });

  it("rejects losing the app parameter or its app entity", () => {
    const missing = validMetadata();
    missing.actions.PauseAppIntent.parameters.pop();
    expect(() => verifyShortcutMetadata(missing)).toThrow("parameters must be app");

    const typed = validMetadata();
    typed.actions.PauseAppIntent.parameters[0].valueType = { string: {} };
    expect(() => verifyShortcutMetadata(typed)).toThrow("StillAppEntity");
  });

  it("rejects a build without one ready-made action per app", () => {
    const metadata = validMetadata();
    metadata.autoShortcuts = [];

    expect(() => verifyShortcutMetadata(metadata)).toThrow(
      "each chosen app gets its own action",
    );
  });

  it("rejects accidentally restoring unconditional Still foregrounding", () => {
    const metadata = validMetadata();
    metadata.actions.PauseAppIntent.openAppWhenRun = true;

    expect(() => verifyShortcutMetadata(metadata)).toThrow(
      "must not unconditionally open Still",
    );
  });

  it("keeps the first action for existing automations, hidden from the library", () => {
    const removed = validMetadata();
    delete removed.actions.PauseBeforeOpeningIntent;
    expect(() => verifyShortcutMetadata(removed)).toThrow("must stay in the build");

    const listed = validMetadata();
    listed.actions.PauseBeforeOpeningIntent.isDiscoverable = true;
    expect(() => verifyShortcutMetadata(listed)).toThrow("hidden");

    const changed = validMetadata();
    changed.actions.PauseBeforeOpeningIntent.parameters = [{ name: "app" }];
    expect(() => verifyShortcutMetadata(changed)).toThrow("appName");
  });

  it("requires the Spanish Siri phrases in the built app", () => {
    const source = { "Pause ${app} with ${applicationName}": "Pausar ${app} con ${applicationName}" };
    expect(() => verifySpanishPhrases(source, { ...source })).not.toThrow();
    expect(() => verifySpanishPhrases(source, {})).toThrow("Spanish phrase");
    expect(() => verifySpanishPhrases({}, {})).toThrow("missing");
  });

  it("requires the catalog's Spanish in the built app", () => {
    const catalog = {
      strings: {
        "Pause Before Opening": {
          localizations: {
            es: { stringUnit: { state: "translated", value: "Pausar antes de abrir" } },
          },
        },
      },
    };

    expect(() =>
      verifySpanishStrings(catalog, { "Pause Before Opening": "Pausar antes de abrir" }),
    ).not.toThrow();
    expect(() => verifySpanishStrings(catalog, {})).toThrow(
      'missing the Spanish for "Pause Before Opening"',
    );
  });

  it("accepts only the production iOS AdMob application id", () => {
    expect(() =>
      verifyAdMobApplicationIdentifier(
        "ca-app-pub-8052007653549292~7920548119",
      ),
    ).not.toThrow();
    expect(() =>
      verifyAdMobApplicationIdentifier(
        "ca-app-pub-3940256099942544~1458002511",
      ),
    ).toThrow("production iOS AdMob app id");
  });
});

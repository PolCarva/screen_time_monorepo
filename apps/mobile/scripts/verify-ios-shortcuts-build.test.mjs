import { describe, expect, it } from "vitest";

import {
  verifyAdMobApplicationIdentifier,
  verifyShortcutMetadata,
  verifySpanishStrings,
} from "./verify-ios-shortcuts-build.mjs";

function validMetadata() {
  return {
    actions: {
      PauseBeforeOpeningIntent: {
        actionConfiguration: {
          actionSummary: {
            wrapper: {
              summaryString: {
                formatString: "Pause before opening ${appName}",
                parameterIdentifiers: ["appName"],
              },
            },
          },
        },
        isDiscoverable: true,
        openAppWhenRun: false,
        parameters: [{ name: "appName", dynamicOptionsSupport: 1 }],
        supportedModes: 9,
        title: { key: "Pause Before Opening" },
      },
    },
  };
}

describe("iOS Shortcuts compiled-build verification", () => {
  it("accepts the complete foreground-capable App Intent contract", () => {
    expect(() => verifyShortcutMetadata(validMetadata())).not.toThrow();
  });

  it("rejects a build where Shortcuts can no longer discover the action", () => {
    const metadata = validMetadata();
    metadata.actions.PauseBeforeOpeningIntent.isDiscoverable = false;

    expect(() => verifyShortcutMetadata(metadata)).toThrow("discoverable");
  });

  it("rejects losing the app-specific parameter", () => {
    const metadata = validMetadata();
    metadata.actions.PauseBeforeOpeningIntent.parameters.pop();

    expect(() => verifyShortcutMetadata(metadata)).toThrow(
      "parameters must be appName",
    );
  });

  it("rejects a build where the app name has to be typed again", () => {
    const metadata = validMetadata();
    metadata.actions.PauseBeforeOpeningIntent.parameters[0].dynamicOptionsSupport = 0;

    expect(() => verifyShortcutMetadata(metadata)).toThrow(
      "apps chosen in Still as options",
    );
  });

  it("rejects accidentally restoring unconditional Still foregrounding", () => {
    const metadata = validMetadata();
    metadata.actions.PauseBeforeOpeningIntent.openAppWhenRun = true;

    expect(() => verifyShortcutMetadata(metadata)).toThrow(
      "must not unconditionally open Still",
    );
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

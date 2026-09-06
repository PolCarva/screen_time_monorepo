import { describe, expect, it } from "vitest";

import {
  verifyAdMobApplicationIdentifier,
  verifyShortcutMetadata,
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
        parameters: [{ name: "appName" }],
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

  it("rejects accidentally restoring unconditional Still foregrounding", () => {
    const metadata = validMetadata();
    metadata.actions.PauseBeforeOpeningIntent.openAppWhenRun = true;

    expect(() => verifyShortcutMetadata(metadata)).toThrow(
      "must not unconditionally open Still",
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

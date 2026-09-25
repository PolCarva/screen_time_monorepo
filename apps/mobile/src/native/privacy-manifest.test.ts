/// <reference types="node" />

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const manifest = readFileSync(
  new URL("../../ios/Still/PrivacyInfo.xcprivacy", import.meta.url),
  "utf8",
);

/** The data types of the App Privacy label published in App Store Connect. */
const LABEL = [
  "EmailAddress",
  "CoarseLocation",
  "UserID",
  "DeviceID",
  "ProductInteraction",
  "AdvertisingData",
  "OtherUsageData",
  "CrashData",
  "PerformanceData",
  "OtherDiagnosticData",
];

describe("iOS privacy manifest", () => {
  it("declares the same collected data as the App Privacy label, none for tracking", () => {
    const declared = [
      ...manifest.matchAll(
        /<string>NSPrivacyCollectedDataType(?!Purpose)(\w+)<\/string>/g,
      ),
    ].map((match) => match[1]);
    expect(declared).toEqual(LABEL);
    expect(manifest).not.toMatch(
      /<key>NSPrivacyCollectedDataTypeTracking<\/key>\s*<true\/>/,
    );
    expect(manifest).toMatch(/<key>NSPrivacyTracking<\/key>\s*<false\/>/);
  });
});

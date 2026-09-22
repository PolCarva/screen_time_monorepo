import { describe, expect, it } from "vitest";

import {
  countUnexpiredCodeSigningIdentities,
  parseCodeSigningIdentityNames,
  parseXctracePhysicalDevices,
  verifyIosDeviceReadiness,
} from "./verify-ios-device-readiness.mjs";

const offlineOnly = `== Devices ==
MacBook Air (2) (7B5332CA-9335-58B5-A530-25FF0C912899)

== Devices Offline ==
Serri :) (26.3.1) (00008140-001405DA368B001C)
iPhone de Agustin (2) (18.6.2) (00008110-0016044E3653A01E)

== Simulators ==
iPhone 17 Simulator (26.0) (4715A572-E588-423C-AFBC-D079EC168C2D)`;

describe("iOS physical-device readiness", () => {
  it("separates physical devices from the Mac and simulators", () => {
    expect(parseXctracePhysicalDevices(offlineOnly)).toEqual({
      online: [],
      offline: [
        {
          name: "Serri :)",
          operatingSystemVersion: "26.3.1",
          identifier: "00008140-001405DA368B001C",
        },
        {
          name: "iPhone de Agustin (2)",
          operatingSystemVersion: "18.6.2",
          identifier: "00008110-0016044E3653A01E",
        },
      ],
    });
  });

  it("reports an actionable error when every known device is offline", () => {
    let error;
    try {
      verifyIosDeviceReadiness({
        deviceOutput: offlineOnly,
        identityCount: 0,
      });
    } catch (caught) {
      error = caught;
    }

    expect(error?.message).toMatch(
      /Known offline devices: Serri :\), iPhone de Agustin \(2\)/,
    );
    expect(error?.message).toMatch(/No unexpired Apple code-signing identity/);
  });

  it("passes when a physical device and signing identity are available", () => {
    const deviceOutput = offlineOnly.replace(
      "MacBook Air (2) (7B5332CA-9335-58B5-A530-25FF0C912899)",
      "MacBook Air (2) (7B5332CA-9335-58B5-A530-25FF0C912899)\nPablo’s iPhone (18.6.2) (00008110-0016044E3653A01E)",
    );
    const result = verifyIosDeviceReadiness({
      deviceOutput,
      identityCount: 1,
    });

    expect(result.devices.map((device) => device.name)).toEqual([
      "Pablo’s iPhone",
    ]);
    expect(result.identityCount).toBe(1);
  });

  it("parses identity names and rejects an expired certificate", () => {
    const identities =
      '  1) 0123456789ABCDEF0123456789ABCDEF01234567 "Apple Development: Pablo"\n     1 valid identities found.';
    expect(parseCodeSigningIdentityNames(identities)).toEqual([
      "Apple Development: Pablo",
    ]);
    expect(
      countUnexpiredCodeSigningIdentities(
        identities,
        () => ({
          validFrom: "2024-10-29T16:03:02Z",
          validTo: "2025-10-29T16:03:01Z",
        }),
        new Date("2026-09-06T00:00:00Z"),
      ),
    ).toBe(0);
  });

  it("counts an identity whose certificate is currently valid", () => {
    const identities =
      '  1) 0123456789ABCDEF0123456789ABCDEF01234567 "Apple Development: Pablo"';
    expect(
      countUnexpiredCodeSigningIdentities(
        identities,
        () => ({
          validFrom: "2026-01-01T00:00:00Z",
          validTo: "2027-01-01T00:00:00Z",
        }),
        new Date("2026-09-06T00:00:00Z"),
      ),
    ).toBe(1);
    expect(
      parseCodeSigningIdentityNames("0 valid identities found."),
    ).toEqual([]);
  });
});

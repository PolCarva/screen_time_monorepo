#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { X509Certificate } from "node:crypto";
import { pathToFileURL } from "node:url";

function parseDeviceLine(line) {
  const match = line.match(/^(.+) \(([^()]*)\) \(([^()]*)\)$/);
  if (!match) return null;

  const [, name, operatingSystemVersion, identifier] = match;
  if (!/^\d+(?:\.\d+)+/.test(operatingSystemVersion)) return null;

  return { name, operatingSystemVersion, identifier };
}

export function parseXctracePhysicalDevices(output) {
  const online = [];
  const offline = [];
  let section = null;

  for (const rawLine of output.split("\n")) {
    const line = rawLine.trim();
    if (line === "== Devices ==") {
      section = online;
      continue;
    }
    if (line === "== Devices Offline ==") {
      section = offline;
      continue;
    }
    if (line.startsWith("== ")) {
      section = null;
      continue;
    }
    if (!line || !section) continue;

    const device = parseDeviceLine(line);
    if (device) section.push(device);
  }

  return { online, offline };
}

export function parseCodeSigningIdentityNames(output) {
  return output
    .split("\n")
    .map((line) => line.match(/^\s*\d+\) [0-9A-F]{40} "(.+)"$/)?.[1])
    .filter(Boolean);
}

export function countUnexpiredCodeSigningIdentities(
  identityOutput,
  validityForIdentity,
  now = new Date(),
) {
  return parseCodeSigningIdentityNames(identityOutput).filter((name) => {
    const validity = validityForIdentity(name);
    if (!validity) return false;

    const validFrom = new Date(validity.validFrom);
    const validTo = new Date(validity.validTo);
    return validFrom <= now && now <= validTo;
  }).length;
}

export function verifyIosDeviceReadiness({ deviceOutput, identityCount }) {
  const devices = parseXctracePhysicalDevices(deviceOutput);
  const issues = [];

  if (devices.online.length === 0) {
    issues.push(
      devices.offline.length > 0
      ? `No physical iPhone or iPad is online. Known offline devices: ${devices.offline.map((device) => device.name).join(", ")}. Connect, unlock and trust one device.`
      : "No physical iPhone or iPad is online. Connect, unlock and trust one device.",
    );
  }
  if (identityCount === 0) {
    issues.push(
      "No unexpired Apple code-signing identity is installed. Renew or create an Apple Development certificate before installing Still.",
    );
  }
  if (issues.length > 0) throw new Error(issues.join("\n"));

  return { devices: devices.online, identityCount };
}

function runCommand(command, args) {
  try {
    return execFileSync(command, args, { encoding: "utf8" });
  } catch (error) {
    const detail = error.stderr?.toString().trim() || error.message;
    throw new Error(`${command} ${args.join(" ")} failed: ${detail}`);
  }
}

function run() {
  if (process.platform !== "darwin") {
    throw new Error("iOS physical-device readiness can only be checked on macOS.");
  }

  const deviceOutput = runCommand("xcrun", ["xctrace", "list", "devices"]);
  const identityOutput = runCommand("security", [
    "find-identity",
    "-v",
    "-p",
    "codesigning",
  ]);
  const identityCount = countUnexpiredCodeSigningIdentities(
    identityOutput,
    (name) => {
      try {
        const pem = runCommand("security", [
          "find-certificate",
          "-c",
          name,
          "-p",
        ]);
        const certificate = new X509Certificate(pem);
        return {
          validFrom: certificate.validFrom,
          validTo: certificate.validTo,
        };
      } catch {
        return null;
      }
    },
  );
  const result = verifyIosDeviceReadiness({ deviceOutput, identityCount });

  console.log(
    [
      "PASS iOS physical-device readiness",
      `Devices: ${result.devices.map((device) => `${device.name} (${device.operatingSystemVersion})`).join(", ")}`,
      `Valid signing identities: ${result.identityCount}`,
    ].join("\n"),
  );
}

const isDirectRun =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectRun) {
  try {
    run();
  } catch (error) {
    console.error(`FAIL iOS physical-device readiness\n${error.message}`);
    process.exitCode = 1;
  }
}

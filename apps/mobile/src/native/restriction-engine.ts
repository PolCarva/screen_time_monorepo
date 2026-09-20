import { NativeEventEmitter, NativeModules, Platform } from "react-native";

import type { NativeShortcutTarget } from "@/lib/shortcut-targets";

export type PermissionStatus =
  "notDetermined" | "authorized" | "denied" | "unavailable";
export type LocalAppHandle = {
  readonly opaqueId: string;
  readonly platform: "ios" | "android";
};
export type RestrictedSelection = {
  readonly count: number;
  readonly localReference: string;
};
export type UnlockSession = { id: string; endsAt: string };
export type ShortcutIntervention = {
  id: string;
  appName: string;
  returnShortcutName: string;
  attemptsToday: number;
  createdAt: string;
  /** The automation fired because the user tapped "Test" during setup. */
  isSetupTest?: boolean;
  returnKind?: "scheme" | "shortcut";
};
export type ShortcutUnlockSession = UnlockSession & {
  returnUrl: string;
  /** Return shortcut to try when `returnUrl` is a URL scheme that fails. */
  fallbackReturnUrl?: string;
};
export type ShortcutTargetHealth = NativeShortcutTarget & {
  targetKey: string;
  lastTriggeredAt?: string;
  /** First time the automation fired for this app; absent until it does. */
  verifiedAt?: string;
};
export type RestrictionHealth = {
  authorization: PermissionStatus;
  wellbeingAuthorization?: PermissionStatus;
  engineActive: boolean;
  selectedCount: number;
  /** Shortcut mode only: chosen apps whose automation has fired at least once. */
  verifiedCount?: number;
  mode?: "managed" | "shortcuts";
  lastRestoredAt?: string;
  issue?: string;
};
export type PendingUnlockEvent = {
  clientSessionId: string;
  source: "rewarded" | "emergency";
  durationSeconds: number;
  startedAt: string;
};
export type LocalWellbeingStats = {
  controlledScreenTimeSeconds: number;
  pickups?: number;
  openAttempts: number;
  avoidedOpens: number;
  unlocks: number;
  weeklyScreenTimeSeconds: number[];
};

export interface RestrictionEngine {
  beginExternalAuthSession?(): Promise<void>;
  endExternalAuthSession?(): Promise<void>;
  requestAuthorization(): Promise<PermissionStatus>;
  requestWellbeingAuthorization(): Promise<PermissionStatus>;
  presentAppPicker(): Promise<RestrictedSelection>;
  applyRestrictions(selection: RestrictedSelection): Promise<void>;
  enableShortcutMode(): Promise<void>;
  getPendingShortcutIntervention(): Promise<ShortcutIntervention | null>;
  completeShortcutIntervention(
    contextId: string,
    durationSeconds: number,
  ): Promise<ShortcutUnlockSession>;
  cancelShortcutIntervention(contextId: string): Promise<void>;
  finishShortcutSetupTest(contextId: string): Promise<void>;
  setShortcutTargets(targets: NativeShortcutTarget[]): Promise<void>;
  getShortcutTargetsHealth(): Promise<ShortcutTargetHealth[]>;
  beginShortcutSetupProbe(appName: string): Promise<void>;
  cancelCurrentIntervention(): Promise<void>;
  startUnlock(
    target: LocalAppHandle,
    durationSeconds: number,
  ): Promise<UnlockSession>;
  restoreRestriction(sessionId: string): Promise<void>;
  getHealth(): Promise<RestrictionHealth>;
  syncWallet(
    rewarded: number,
    emergency: number,
    resetAt: string,
    estimatedMinutesPerAvoidedOpen: number,
    unlockDurationSeconds: number,
    restrictionsEnabled: boolean,
  ): Promise<void>;
  getPendingUnlockEvents(): Promise<PendingUnlockEvent[]>;
  acknowledgeUnlockEvent(clientSessionId: string): Promise<void>;
  hasPendingIntervention(): Promise<string | null>;
  getLocalWellbeing(): Promise<LocalWellbeingStats>;
  resetLocalData(): Promise<void>;
}

type NativeRestrictionModule = RestrictionEngine & {
  addListener(eventName: string): void;
  removeListeners(count: number): void;
};
const bridge = NativeModules.StillRestrictionEngine as
  NativeRestrictionModule | undefined;

const unavailable: RestrictionEngine = {
  requestAuthorization: async () => "unavailable",
  requestWellbeingAuthorization: async () => "unavailable",
  presentAppPicker: async () => ({ count: 0, localReference: "unavailable" }),
  applyRestrictions: async () => undefined,
  enableShortcutMode: async () => undefined,
  getPendingShortcutIntervention: async () => null,
  completeShortcutIntervention: async () => {
    throw new Error("Shortcut interventions are unavailable in this build");
  },
  cancelShortcutIntervention: async () => undefined,
  finishShortcutSetupTest: async () => undefined,
  setShortcutTargets: async () => undefined,
  getShortcutTargetsHealth: async () => [],
  beginShortcutSetupProbe: async () => undefined,
  cancelCurrentIntervention: async () => undefined,
  startUnlock: async () => {
    throw new Error("Restriction engine is unavailable in this build");
  },
  restoreRestriction: async () => undefined,
  getHealth: async () => ({
    authorization: "unavailable",
    engineActive: false,
    selectedCount: 0,
    issue: "native_module_missing",
  }),
  syncWallet: async () => undefined,
  getPendingUnlockEvents: async () => [],
  acknowledgeUnlockEvent: async () => undefined,
  hasPendingIntervention: async () => null,
  getLocalWellbeing: async () => ({
    controlledScreenTimeSeconds: 0,
    pickups: 0,
    openAttempts: 0,
    avoidedOpens: 0,
    unlocks: 0,
    weeklyScreenTimeSeconds: [],
  }),
  resetLocalData: async () => undefined,
};

export const restrictionEngine: RestrictionEngine = bridge ?? unavailable;
export const restrictionEvents = bridge ? new NativeEventEmitter(bridge) : null;
export const currentPlatform = Platform.OS === "ios" ? "ios" : "android";

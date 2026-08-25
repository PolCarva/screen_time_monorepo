import { NativeEventEmitter, NativeModules, Platform } from "react-native";

export type PermissionStatus = "notDetermined" | "authorized" | "denied" | "unavailable";
export type LocalAppHandle = { readonly opaqueId: string; readonly platform: "ios" | "android" };
export type RestrictedSelection = { readonly count: number; readonly localReference: string };
export type UnlockSession = { id: string; endsAt: string };
export type RestrictionHealth = { authorization: PermissionStatus; engineActive: boolean; selectedCount: number; lastRestoredAt?: string; issue?: string };
export type PendingUnlockEvent = {
  clientSessionId: string;
  source: "rewarded" | "emergency";
  durationSeconds: number;
  startedAt: string;
};
export type LocalWellbeingStats = {
  controlledScreenTimeSeconds: number;
  openAttempts: number;
  avoidedOpens: number;
  unlocks: number;
  weeklyScreenTimeSeconds: number[];
};

export interface RestrictionEngine {
  requestAuthorization(): Promise<PermissionStatus>;
  requestWellbeingAuthorization(): Promise<PermissionStatus>;
  presentAppPicker(): Promise<RestrictedSelection>;
  applyRestrictions(selection: RestrictedSelection): Promise<void>;
  startUnlock(target: LocalAppHandle, durationSeconds: number): Promise<UnlockSession>;
  restoreRestriction(sessionId: string): Promise<void>;
  getHealth(): Promise<RestrictionHealth>;
  syncWallet(rewarded: number, emergency: number, resetAt: string): Promise<void>;
  getPendingUnlockEvents(): Promise<PendingUnlockEvent[]>;
  acknowledgeUnlockEvent(clientSessionId: string): Promise<void>;
  hasPendingIntervention(): Promise<string | null>;
  getLocalWellbeing(): Promise<LocalWellbeingStats>;
}

type NativeRestrictionModule = RestrictionEngine & { addListener(eventName: string): void; removeListeners(count: number): void };
const bridge = NativeModules.StillRestrictionEngine as NativeRestrictionModule | undefined;

const unavailable: RestrictionEngine = {
  requestAuthorization: async () => "unavailable",
  requestWellbeingAuthorization: async () => "unavailable",
  presentAppPicker: async () => ({ count: 0, localReference: "unavailable" }),
  applyRestrictions: async () => undefined,
  startUnlock: async () => { throw new Error("Restriction engine is unavailable in this build"); },
  restoreRestriction: async () => undefined,
  getHealth: async () => ({ authorization: "unavailable", engineActive: false, selectedCount: 0, issue: "native_module_missing" }),
  syncWallet: async () => undefined,
  getPendingUnlockEvents: async () => [],
  acknowledgeUnlockEvent: async () => undefined,
  hasPendingIntervention: async () => null,
  getLocalWellbeing: async () => ({ controlledScreenTimeSeconds: 0, openAttempts: 0, avoidedOpens: 0, unlocks: 0, weeklyScreenTimeSeconds: [] }),
};

export const restrictionEngine: RestrictionEngine = bridge ?? unavailable;
export const restrictionEvents = bridge ? new NativeEventEmitter(bridge) : null;
export const currentPlatform = Platform.OS === "ios" ? "ios" : "android";

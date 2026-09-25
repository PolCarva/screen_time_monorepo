import { NativeEventEmitter, NativeModules, Platform } from "react-native";

import type { KeepAliveTarget } from "@/lib/android-oem";
import type { SignedRewardIntent } from "@/lib/reward-intent-buffer";
import type { NativeShortcutTarget } from "@/lib/shortcut-targets";
import type { SavingsHistory } from "@/lib/savings";
import type { DayMetrics } from "@/lib/today-summary";

/** An earned rewarded ad the native shield recorded for React Native to claim. */
export type PendingAdResult = {
  clientEventId: string;
  intentId: string;
  earnedAt: string;
  /** What the SDK said the impression paid, in micros; absent when it said nothing. */
  adValueMicros?: number;
  adValueCurrency?: string;
  /** 0 unknown, 1 estimated, 2 publisher provided, 3 precise. */
  adValuePrecision?: number;
};

/** How Still was installed and on what device (Android), for onboarding + repair. */
export type InstallEnvironment = {
  sdkInt: number;
  packageSource: number;
  /** Android 13+ blocks enabling Accessibility for downloaded (non-store) builds. */
  likelyRestricted: boolean;
  manufacturer: string;
};

/** A chosen app with today's activity and when Still last paused it (Android). */
export type SelectedAppState = {
  packageName: string;
  label: string;
  lastPauseAt?: string;
  openAttemptsToday: number;
  avoidedOpensToday: number;
  unlocksToday: number;
  /** Skips of this app undone by going in right after (real-savings D6). */
  reentriesToday?: number;
};

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
  /** Android: the Accessibility service is bound and running, not just listed. */
  serviceRunning?: boolean;
  engineActive: boolean;
  selectedCount: number;
  /** Shortcut mode only: chosen apps whose automation has fired at least once. */
  verifiedCount?: number;
  mode?: "managed" | "shortcuts";
  lastRestoredAt?: string;
  issue?: string;
};
/** An access window running right now, so Still can show when it really ends. */
export type AccessWindow = {
  /** The app's visible name; the opaque key when the name is not known. */
  label: string;
  endsAt: string;
};
export type PendingUnlockEvent = {
  clientSessionId: string;
  /** An ad is the only paid way in; older builds may still queue "emergency". */
  source: "rewarded";
  durationSeconds: number;
  startedAt: string;
  /** Set when a fresh ad paid for the visit: its reward must be claimed first. */
  rewardIntentId?: string;
};
/** Android usage for the onboarding story (lib/onboarding-insights); never stored. */
export type NativeUsageSummary = {
  days: {
    date: string;
    foregroundSeconds: number;
    unlocks: number;
    screenOns: number;
    complete: boolean;
  }[];
  apps: { packageName: string; label: string; seconds: number[] }[];
};
/**
 * Android usage from `from` until `toExclusive` or now, per app: sessions that
 * started on those days, their median and time per day. Only per-app totals
 * are kept, on the phone (docs/real-savings-estimate-plan.md, D8).
 */
export type NativeUsageStats = {
  /** Epoch ms of the oldest event the phone keeps; null when it keeps none. */
  firstEventAt: number | null;
  days: { date: string; complete: boolean }[];
  apps: {
    packageName: string;
    sessions: number;
    medianSeconds: number;
    /** Same order as `days`. */
    seconds: number[];
  }[];
};
/** Still's own counters for today and the last seven local days (oldest first). */
export type LocalWellbeingStats = {
  openAttempts: number;
  avoidedOpens: number;
  unlocks: number;
  /** Skips undone by going into the same app right after; absent on older builds. */
  reentries?: number;
  history: DayMetrics[];
};

export interface RestrictionEngine {
  beginExternalAuthSession?(): Promise<void>;
  endExternalAuthSession?(): Promise<void>;
  requestAuthorization(): Promise<PermissionStatus>;
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
    resetAt: string,
    estimatedMinutesPerAvoidedOpen: number,
    unlockDurationSeconds: number,
    restrictionsEnabled: boolean,
  ): Promise<void>;
  /**
   * Android only. Mirrors reward eligibility and the ad unit so the native
   * shield can preload a rewarded ad without duplicating `canRequestReward`.
   */
  syncRewardConfig?(
    adsEligible: boolean,
    adUnitId: string,
    rewardProvider: string,
  ): Promise<void>;
  /** Android only. Refill the shield's buffer of pre-signed reward intents. */
  setPresignedRewardIntents?(intents: SignedRewardIntent[]): Promise<void>;
  /** Android only. Earned rewards the shield recorded while RN was not running. */
  getPendingAdResults?(): Promise<PendingAdResult[]>;
  acknowledgeAdResult?(clientEventId: string): Promise<void>;
  /** Android only. Chosen apps with today's per-app activity and last pause. */
  getSelectedAppsState?(): Promise<SelectedAppState[]>;
  /** Android only. Install source + device, to explain restricted settings and OEM quirks. */
  getInstallEnvironment?(): Promise<InstallEnvironment>;
  /** Android only. Opens Still's App info screen (allow restricted settings). */
  openAppInfo?(): Promise<boolean>;
  /** Android only. Opens the Accessibility settings without waiting for a result. */
  openAccessibilitySettings?(): Promise<boolean>;
  /** Android only. Usage access: the onboarding story and the time given back. */
  hasUsageAccess?(): Promise<boolean>;
  /** Android only. Opens Usage access; the caller checks again on return. */
  openUsageAccessSettings?(): Promise<boolean>;
  /** Android only. Seven complete local days and today, most used apps included. */
  getUsageSummary?(): Promise<NativeUsageSummary>;
  /** Android only. Sessions, their median and time per day for every app used. */
  getUsageStats?(from: string, toExclusive: string | null): Promise<NativeUsageStats>;
  /**
   * Android only. Minutes one skipped pause gives back per app, measured on the
   * phone, for the pause screen; apps left out use the config's minutes.
   */
  syncSessionMinutes?(minutes: Record<string, number>): Promise<void>;
  /** Android only. An installed app's icon as a PNG `data:` URI. */
  getAppIcon?(packageName: string, sizeDp: number): Promise<string | null>;
  /** Android only. The picker with the most used apps offered first, unticked. */
  presentAppPickerSuggesting?(
    suggested: { packageName: string; dailyMinutes: number }[],
  ): Promise<RestrictedSelection>;
  /** Android only. Settings was opened for this step; Still comes back once it holds. */
  setSetupAwaiting?(step: "accessibility" | null): Promise<void>;
  /** Android only. Arms a two-minute setup test; returns when it began (epoch ms). */
  beginSetupProbe?(packageName: string): Promise<number>;
  /** Android only. When the pause last showed in test mode. */
  getSetupProbeResult?(): Promise<{ verifiedAt?: number; waitingFor?: string }>;
  /** Android only. Opens an installed app like the launcher does. */
  openApp?(packageName: string): Promise<boolean>;
  /** Android only. Still is exempt from battery optimization. */
  isIgnoringBatteryOptimizations?(): Promise<boolean>;
  /** Android only. Opens the battery optimization list (or Still's App info). */
  openBatterySettings?(): Promise<boolean>;
  /**
   * Android only. Opens where one "keep Still running" tip is done; false when
   * nothing could open (Recents needs the running service). Absent before 0.3.5.
   */
  openKeepAliveSetting?(target: KeepAliveTarget): Promise<boolean>;
  /**
   * Windows still running. The deadline is owned natively, so this is the
   * truth about when each app is paused again — not a countdown JavaScript
   * keeps, which would stop with the app.
   */
  getAccessWindows(): Promise<AccessWindow[]>;
  getPendingUnlockEvents(): Promise<PendingUnlockEvent[]>;
  acknowledgeUnlockEvent(clientSessionId: string): Promise<void>;
  hasPendingIntervention(): Promise<string | null>;
  getLocalWellbeing(): Promise<LocalWellbeingStats>;
  /**
   * Still's counters per day and per app for the last `days` local days, for
   * the Savings screen. Absent from builds before 0.3.4.
   */
  getAppHistory?(days: number): Promise<SavingsHistory>;
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
  syncRewardConfig: async () => undefined,
  setPresignedRewardIntents: async () => undefined,
  getPendingAdResults: async () => [],
  acknowledgeAdResult: async () => undefined,
  getSelectedAppsState: async () => [],
  getInstallEnvironment: async () => ({
    sdkInt: 0,
    packageSource: -1,
    likelyRestricted: false,
    manufacturer: "",
  }),
  openAppInfo: async () => false,
  openAccessibilitySettings: async () => false,
  getAccessWindows: async () => [],
  getPendingUnlockEvents: async () => [],
  acknowledgeUnlockEvent: async () => undefined,
  hasPendingIntervention: async () => null,
  getLocalWellbeing: async () => ({
    openAttempts: 0,
    avoidedOpens: 0,
    unlocks: 0,
    history: [],
  }),
  getAppHistory: async () => ({ days: [], apps: [] }),
  resetLocalData: async () => undefined,
};

export const restrictionEngine: RestrictionEngine = bridge ?? unavailable;
export const restrictionEvents = bridge ? new NativeEventEmitter(bridge) : null;
export const currentPlatform = Platform.OS === "ios" ? "ios" : "android";

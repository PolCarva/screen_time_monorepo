import { z } from "zod";

export const uuidSchema = z.string().uuid();
export const isoDateSchema = z.string().date();
export const isoDateTimeSchema = z.string().datetime({ offset: true });

export const remoteConfigSchema = z
  .object({
    version: z.number().int().positive(),
    unlockDurationSeconds: z.number().int().min(60).max(86_400),
    maxRewardedAdsPerUtcDay: z.number().int().min(0).max(30),
    maxRewardTokenBalance: z.number().int().min(0).max(20),
    impactPercentage: z.number().min(0).max(100),
    platformPercentage: z.number().min(0).max(100),
    estimatedMinutesPerAvoidedOpen: z.number().min(0).max(60),
    // What a thousand rewarded views earn when neither the SDK nor AdMob's
    // reports say (docs/real-impact-stats-plan.md, D5). Rewarded Android ads
    // in Latin America earn about 2-4 USD per thousand.
    estimatedRewardedEcpmUsd: z.number().min(0).max(200).default(3),
    rewardProvider: z.enum(["admob", "disabled"]),
    votingEnabled: z.boolean(),
    iosRestrictionEnabled: z.boolean(),
    androidRestrictionEnabled: z.boolean(),
    // iOS builds up to 0.3.0 only: sent the user to the Home Screen through a
    // private API when they declined to open an app. 0.3.1 removed that call
    // (App Review 2.5.1); older builds still read the flag, so keep it off.
    // Configurations published before the flag existed read as off.
    iosHomeOnCancelEnabled: z.boolean().default(false),
    publishedAt: isoDateTimeSchema,
  })
  .superRefine((config, context) => {
    if (config.impactPercentage + config.platformPercentage !== 100) {
      context.addIssue({
        code: "custom",
        message: "Impact and platform percentages must total 100",
        path: ["impactPercentage"],
      });
    }
  });

export type RemoteConfig = z.infer<typeof remoteConfigSchema>;

export const defaultRemoteConfig: RemoteConfig = {
  version: 0,
  unlockDurationSeconds: 600,
  maxRewardedAdsPerUtcDay: 0,
  maxRewardTokenBalance: 0,
  impactPercentage: 0,
  platformPercentage: 100,
  estimatedMinutesPerAvoidedOpen: 0,
  estimatedRewardedEcpmUsd: 3,
  rewardProvider: "disabled",
  votingEnabled: false,
  iosRestrictionEnabled: false,
  androidRestrictionEnabled: false,
  iosHomeOnCancelEnabled: false,
  publishedAt: "1970-01-01T00:00:00.000Z",
};

export const devicePlatformSchema = z.enum(["ios", "android"]);

export const registerDeviceRequestSchema = z.object({
  installationId: uuidSchema,
  platform: devicePlatformSchema,
  appVersion: z.string().min(1).max(32),
  osVersion: z.string().min(1).max(32),
  locale: z.string().min(2).max(16),
  timezone: z.string().min(1).max(64),
});

export const registerDeviceResponseSchema = z.object({
  deviceId: uuidSchema,
  registeredAt: isoDateTimeSchema,
});

export const walletSchema = z.object({
  rewardedBalance: z.number().int().nonnegative(),
  rewardedPassesRemainingToday: z.number().int().nonnegative(),
  unresolvedRewardClaims: z.number().int().nonnegative(),
  rewardAdsRemainingToday: z.number().int().nonnegative(),
  resetAt: isoDateTimeSchema,
});

export const rewardIntentSchema = z.object({
  id: uuidSchema,
  customData: z.string().min(16),
  provider: z.literal("admob"),
  expiresAt: isoDateTimeSchema,
});

export const createRewardIntentRequestSchema = z.object({
  deviceId: uuidSchema,
  provider: z.literal("admob").default("admob"),
});

/**
 * What the Google Mobile Ads SDK said one impression paid (impression-level ad
 * revenue). The server caps it and only counts it once AdMob confirms the ad.
 */
export const adValueSchema = z.object({
  valueMicros: z.number().int().min(0).max(10_000_000),
  currency: z.string().regex(/^[A-Z]{3}$/),
  precision: z.enum(["unknown", "estimated", "publisher_provided", "precise"]),
});

export const claimRewardRequestSchema = z.object({
  clientEventId: uuidSchema,
  earnedAt: isoDateTimeSchema,
  adValue: adValueSchema.optional(),
});

/** A pass is the only way in without an ad; emergency access was removed. */
export const unlockSourceSchema = z.enum(["rewarded"]);

export const createUnlockSessionRequestSchema = z.object({
  clientSessionId: uuidSchema,
  deviceId: uuidSchema,
  source: unlockSourceSchema,
  durationSeconds: z.number().int().min(60).max(86_400),
  appCategory: z
    .enum(["social", "video", "news", "games", "communication", "other"])
    .default("other"),
  startedAt: isoDateTimeSchema,
  /**
   * The intent of the ad the user just watched to pay for this visit. The
   * server then spends the pass that ad earned, never one saved earlier.
   */
  rewardIntentId: uuidSchema.optional(),
});

export const unlockDurationSecondsSchema = z.union([
  z.literal(600),
  z.literal(1_200),
  z.literal(1_800),
  z.literal(3_600),
  z.literal(86_400),
]);

export const userPreferencesSchema = z.object({
  dailyPassLimit: z.number().int().min(1).max(20),
  unlockDurationSeconds: unlockDurationSecondsSchema,
  maxRewardedAdsPerUtcDay: z.number().int().min(0).max(30),
  updatedAt: isoDateTimeSchema.nullable(),
});

export const updateUserPreferencesRequestSchema = userPreferencesSchema.omit({
  updatedAt: true,
});

/** One local day of Still's own counters, as the phone keeps them. */
export const wellbeingDaySchema = z.object({
  date: isoDateSchema,
  openAttempts: z.number().int().min(0).max(5_000),
  unlocks: z.number().int().min(0).max(5_000),
  avoidedOpens: z.number().int().min(0).max(5_000),
});

/**
 * The days a device still remembers (up to two weeks), sent together so a day
 * the user never opened Still is not lost. The server computes the minutes.
 */
export const wellbeingSyncSchema = z.object({
  deviceId: uuidSchema,
  platform: devicePlatformSchema,
  days: z.array(wellbeingDaySchema).min(1).max(14),
});

/** Legacy single-day report from builds before `wellbeingSyncSchema`. */
export const wellbeingDailySchema = z.object({
  deviceId: uuidSchema,
  date: isoDateSchema,
  platform: devicePlatformSchema,
  controlledScreenTimeSeconds: z.number().int().nonnegative(),
  openAttempts: z.number().int().nonnegative(),
  unlocks: z.number().int().nonnegative(),
  avoidedOpens: z.number().int().nonnegative(),
  estimatedMinutesAvoided: z.number().nonnegative(),
  rewardedAdsCompleted: z.number().int().nonnegative(),
});

export const charitySchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(120),
  logoUrl: z.string().url().nullable(),
  shortDescription: z.string().min(1).max(280),
  website: z.string().url(),
  country: z.string().min(2).max(80),
  category: z.enum([
    "children",
    "poverty",
    "environment",
    "health",
    "animals",
    "emergencies",
    "other",
  ]),
});

export const impactCandidateSchema = z.object({
  charity: charitySchema,
  votes: z.number().int().nonnegative(),
  percentage: z.number().min(0).max(100),
  selectedByCurrentUser: z.boolean(),
});

export const impactWeekStatusSchema = z.enum([
  "draft",
  "open",
  "voting_closed",
  "donation_pending",
  "donated",
]);

export const impactWeekSchema = z.object({
  id: uuidSchema,
  weekStart: isoDateSchema,
  weekEnd: isoDateSchema,
  status: impactWeekStatusSchema,
  currency: z.literal("USD"),
  grossRevenueMinor: z.number().int().nonnegative(),
  impactFundMinor: z.number().int().nonnegative(),
  impactPercentage: z.number().min(0).max(100),
  isEstimated: z.boolean(),
  /** People with at least one AdMob-confirmed ad this week: who funded it. */
  participants: z.number().int().nonnegative(),
  /** Rewarded ads AdMob confirmed this week (test ads never count). */
  rewardedAds: z.number().int().nonnegative(),
  candidates: z.array(impactCandidateSchema),
  donationProofUrl: z.string().url().nullable(),
  // Added with the live fund; defaults keep a newer app readable against an
  // older API.
  voters: z.number().int().nonnegative().default(0),
  /** People Still paused an app for at least once this week. */
  people: z.number().int().nonnegative().default(0),
  /** Estimated minutes those people got back this week. */
  minutesReturned: z.number().nonnegative().default(0),
  /** Part of the gross still estimated from the ads themselves (not yet in AdMob's report). */
  estimatedRevenueMinor: z.number().int().nonnegative().default(0),
  /** Part of the gross that comes from AdMob's own report. */
  reportedRevenueMinor: z.number().int().nonnegative().default(0),
  allTime: z
    .object({
      people: z.number().int().nonnegative(),
      minutesReturned: z.number().nonnegative(),
      rewardedAds: z.number().int().nonnegative(),
      donatedMinor: z.number().int().nonnegative(),
    })
    .default({ people: 0, minutesReturned: 0, rewardedAds: 0, donatedMinor: 0 }),
});

export const impactWeekSummarySchema = impactWeekSchema.pick({
  id: true,
  weekStart: true,
  weekEnd: true,
  status: true,
  currency: true,
  grossRevenueMinor: true,
  impactFundMinor: true,
  impactPercentage: true,
  isEstimated: true,
  donationProofUrl: true,
});

export const impactHistorySchema = z.array(impactWeekSummarySchema);

export const castVoteRequestSchema = z.object({
  charityId: uuidSchema,
});

/**
 * Builds before 0.3.1 send no body. On iOS the app adds a fresh Sign in with
 * Apple authorization code so the server can revoke Still's access to the
 * Apple ID before the account is deleted (App Review account deletion rules).
 */
export const deleteAccountRequestSchema = z.object({
  appleAuthorizationCode: z.string().min(1).max(4096).optional(),
});

/** What happened to the Apple ID's access; the account is deleted either way. */
export const appleRevocationSchema = z.enum([
  "revoked",
  "no_apple_identity",
  "no_code",
  "not_configured",
  "account_mismatch",
  "failed",
]);

export const deleteAccountResponseSchema = z.object({
  appleRevocation: appleRevocationSchema,
});

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
    details: z.unknown().optional(),
  }),
});

export type DevicePlatform = z.infer<typeof devicePlatformSchema>;
export type RegisterDeviceRequest = z.infer<typeof registerDeviceRequestSchema>;
export type RegisterDeviceResponse = z.infer<
  typeof registerDeviceResponseSchema
>;
export type Wallet = z.infer<typeof walletSchema>;
export type RewardIntent = z.infer<typeof rewardIntentSchema>;
export type CreateRewardIntentRequest = z.infer<
  typeof createRewardIntentRequestSchema
>;
export type AdValue = z.infer<typeof adValueSchema>;
export type ClaimRewardRequest = z.infer<typeof claimRewardRequestSchema>;
export type DeleteAccountRequest = z.infer<typeof deleteAccountRequestSchema>;
export type AppleRevocation = z.infer<typeof appleRevocationSchema>;
export type DeleteAccountResponse = z.infer<typeof deleteAccountResponseSchema>;
export type UnlockSource = z.infer<typeof unlockSourceSchema>;
export type UserPreferences = z.infer<typeof userPreferencesSchema>;
export type UpdateUserPreferencesRequest = z.infer<
  typeof updateUserPreferencesRequestSchema
>;
export type CreateUnlockSessionRequest = z.infer<
  typeof createUnlockSessionRequestSchema
>;
export type WellbeingDaily = z.infer<typeof wellbeingDailySchema>;
export type WellbeingDay = z.infer<typeof wellbeingDaySchema>;
export type WellbeingSync = z.infer<typeof wellbeingSyncSchema>;
export type Charity = z.infer<typeof charitySchema>;
export type ImpactWeek = z.infer<typeof impactWeekSchema>;
export type ImpactWeekSummary = z.infer<typeof impactWeekSummarySchema>;
export type CastVoteRequest = z.infer<typeof castVoteRequestSchema>;

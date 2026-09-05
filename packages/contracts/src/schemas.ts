import { z } from "zod";

export const uuidSchema = z.string().uuid();
export const isoDateSchema = z.string().date();
export const isoDateTimeSchema = z.string().datetime({ offset: true });

export const remoteConfigSchema = z
  .object({
    version: z.number().int().positive(),
    unlockDurationSeconds: z.number().int().min(60).max(86_400),
    dailyEmergencyUnlocks: z.number().int().min(0).max(20),
    maxRewardedAdsPerUtcDay: z.number().int().min(0).max(30),
    maxRewardTokenBalance: z.number().int().min(0).max(20),
    impactPercentage: z.number().min(0).max(100),
    platformPercentage: z.number().min(0).max(100),
    estimatedMinutesPerAvoidedOpen: z.number().min(0).max(60),
    rewardProvider: z.enum(["admob", "disabled"]),
    votingEnabled: z.boolean(),
    iosRestrictionEnabled: z.boolean(),
    androidRestrictionEnabled: z.boolean(),
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
  dailyEmergencyUnlocks: 0,
  maxRewardedAdsPerUtcDay: 0,
  maxRewardTokenBalance: 0,
  impactPercentage: 0,
  platformPercentage: 100,
  estimatedMinutesPerAvoidedOpen: 0,
  rewardProvider: "disabled",
  votingEnabled: false,
  iosRestrictionEnabled: false,
  androidRestrictionEnabled: false,
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
  emergencyRemaining: z.number().int().nonnegative(),
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

export const claimRewardRequestSchema = z.object({
  clientEventId: uuidSchema,
  earnedAt: isoDateTimeSchema,
});

export const unlockSourceSchema = z.enum(["rewarded", "emergency"]);

export const createUnlockSessionRequestSchema = z.object({
  clientSessionId: uuidSchema,
  deviceId: uuidSchema,
  source: unlockSourceSchema,
  durationSeconds: z.number().int().min(60).max(86_400),
  appCategory: z
    .enum(["social", "video", "news", "games", "communication", "other"])
    .default("other"),
  startedAt: isoDateTimeSchema,
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
  participants: z.number().int().nonnegative(),
  rewardedAds: z.number().int().nonnegative(),
  candidates: z.array(impactCandidateSchema),
  donationProofUrl: z.string().url().nullable(),
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
export type ClaimRewardRequest = z.infer<typeof claimRewardRequestSchema>;
export type UnlockSource = z.infer<typeof unlockSourceSchema>;
export type UserPreferences = z.infer<typeof userPreferencesSchema>;
export type UpdateUserPreferencesRequest = z.infer<
  typeof updateUserPreferencesRequestSchema
>;
export type CreateUnlockSessionRequest = z.infer<
  typeof createUnlockSessionRequestSchema
>;
export type WellbeingDaily = z.infer<typeof wellbeingDailySchema>;
export type Charity = z.infer<typeof charitySchema>;
export type ImpactWeek = z.infer<typeof impactWeekSchema>;
export type ImpactWeekSummary = z.infer<typeof impactWeekSummarySchema>;
export type CastVoteRequest = z.infer<typeof castVoteRequestSchema>;

import {
  remoteConfigSchema,
  updateUserPreferencesRequestSchema,
} from "@screen-time/contracts";

import { requireApiUser } from "@/lib/auth";
import { HttpError, parseJson, routeError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase";
import { resolveUserPreferences } from "@/lib/user-preferences";

async function loadPreferences(userId: string) {
  const client = createAdminClient()!;
  const [configResult, preferencesResult] = await Promise.all([
    client
      .from("remote_config_versions")
      .select("payload")
      .eq("is_active", true)
      .maybeSingle(),
    client
      .from("user_preferences")
      .select(
        "daily_pass_limit, unlock_duration_seconds, max_rewarded_ads_per_utc_day, updated_at",
      )
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (configResult.error || preferencesResult.error) {
    throw new HttpError(
      503,
      "preferences_unavailable",
      "Preferences are temporarily unavailable",
    );
  }
  const config = remoteConfigSchema.safeParse(configResult.data?.payload);
  if (!config.success) {
    throw new HttpError(
      503,
      "config_unavailable",
      "No active configuration is available",
    );
  }
  return {
    client,
    config: config.data,
    preferences: resolveUserPreferences(config.data, preferencesResult.data),
  };
}

export async function GET(request: Request) {
  try {
    const user = await requireApiUser(request);
    const { preferences } = await loadPreferences(user.id);
    return Response.json(preferences, {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireApiUser(request);
    const input = await parseJson(request, updateUserPreferencesRequestSchema);
    const { client, config } = await loadPreferences(user.id);
    if (input.maxRewardedAdsPerUtcDay > config.maxRewardedAdsPerUtcDay) {
      throw new HttpError(
        400,
        "preference_exceeds_operational_limit",
        "The ad limit exceeds the current operational maximum",
      );
    }
    const { data, error } = await client
      .from("user_preferences")
      .upsert(
        {
          user_id: user.id,
          daily_pass_limit: input.dailyPassLimit,
          unlock_duration_seconds: input.unlockDurationSeconds,
          max_rewarded_ads_per_utc_day: input.maxRewardedAdsPerUtcDay,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      .select(
        "daily_pass_limit, unlock_duration_seconds, max_rewarded_ads_per_utc_day, updated_at",
      )
      .single();
    if (error) {
      throw new HttpError(
        503,
        "preferences_save_failed",
        "Preferences could not be saved",
      );
    }
    return Response.json(resolveUserPreferences(config, data), {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (error) {
    return routeError(error);
  }
}

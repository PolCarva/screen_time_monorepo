import { wellbeingDailySchema } from "@screen-time/contracts";

import { requireApiUser } from "@/lib/auth";
import { HttpError, parseJson, routeError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request);
    const input = await parseJson(request, wellbeingDailySchema);
    const client = createAdminClient()!;
    const { data: device } = await client
      .from("devices")
      .select("id")
      .eq("id", input.deviceId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!device) throw new HttpError(404, "device_not_found", "Device is not registered");

    const { error } = await client.from("wellbeing_daily").upsert(
      {
        user_id: user.id,
        device_id: input.deviceId,
        date: input.date,
        platform: input.platform,
        controlled_screen_time_seconds: input.controlledScreenTimeSeconds,
        open_attempts: input.openAttempts,
        unlocks: input.unlocks,
        avoided_opens: input.avoidedOpens,
        estimated_minutes_avoided: input.estimatedMinutesAvoided,
        rewarded_ads_completed: input.rewardedAdsCompleted,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "device_id,date" },
    );
    if (error) throw new HttpError(400, "wellbeing_sync_failed", error.message);
    return new Response(null, { status: 204 });
  } catch (error) {
    return routeError(error);
  }
}

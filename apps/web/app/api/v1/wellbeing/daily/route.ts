import {
  type WellbeingSync,
  wellbeingDailySchema,
  wellbeingSyncSchema,
} from "@screen-time/contracts";
import { z } from "zod";

import { requireApiUser } from "@/lib/auth";
import { databaseHttpError, parseJson, routeError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase";

// Builds before the multi-day sync send one day with their own minutes; the
// server ignores those minutes and computes them like any other day.
const requestSchema = z.union([
  wellbeingSyncSchema,
  wellbeingDailySchema.transform(
    (day): WellbeingSync => ({
      deviceId: day.deviceId,
      platform: day.platform,
      days: [
        {
          date: day.date,
          openAttempts: day.openAttempts,
          unlocks: day.unlocks,
          avoidedOpens: day.avoidedOpens,
        },
      ],
    }),
  ),
]);

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request);
    const input = await parseJson(request, requestSchema);
    const client = createAdminClient()!;
    const { error } = await client.rpc("record_wellbeing_days", {
      p_user_id: user.id,
      p_device_id: input.deviceId,
      p_platform: input.platform,
      p_days: input.days.map((day) => ({
        local_date: day.date,
        open_attempts: day.openAttempts,
        unlocks: day.unlocks,
        avoided_opens: day.avoidedOpens,
      })),
    });
    if (error)
      throw databaseHttpError(
        error.message,
        [["device_not_found", 404, "device_not_found", "Device is not registered"]],
        {
          status: 503,
          code: "wellbeing_sync_failed",
          message: "Wellbeing data could not be synced",
        },
      );
    return new Response(null, { status: 204 });
  } catch (error) {
    return routeError(error);
  }
}

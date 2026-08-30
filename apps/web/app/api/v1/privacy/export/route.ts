import { requireApiUser } from "@/lib/auth";
import { HttpError, routeError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request);
    const client = createAdminClient()!;
    const [profile, devices, ledger, sessions, wellbeing, votes] =
      await Promise.all([
        client.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        client
          .from("devices")
          .select(
            "id, platform, app_version, os_version, locale, timezone, created_at",
          )
          .eq("user_id", user.id),
        client
          .from("token_ledger")
          .select("entry_type, amount, created_at")
          .eq("user_id", user.id),
        client
          .from("unlock_sessions")
          .select("source, app_category, duration_seconds, started_at, ends_at")
          .eq("user_id", user.id),
        client.from("wellbeing_daily").select("*").eq("user_id", user.id),
        client
          .from("votes")
          .select("impact_week_id, charity_id, created_at, updated_at")
          .eq("user_id", user.id),
      ]);
    const queryError =
      profile.error ??
      devices.error ??
      ledger.error ??
      sessions.error ??
      wellbeing.error ??
      votes.error;
    if (queryError)
      throw new HttpError(
        503,
        "export_unavailable",
        "The privacy export could not be generated",
      );
    return Response.json({
      generatedAt: new Date().toISOString(),
      profile: profile.data,
      devices: devices.data,
      tokenLedger: ledger.data,
      unlockSessions: sessions.data,
      wellbeing: wellbeing.data,
      votes: votes.data,
    });
  } catch (error) {
    return routeError(error);
  }
}

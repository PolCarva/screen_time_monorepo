import { requireApiUser } from "@/lib/auth";
import { HttpError, routeError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request);
    const client = createAdminClient()!;
    const [profile, devices, rewardIntents, ledger, sessions, wellbeing, votes] =
      await Promise.all([
        client.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        client
          .from("devices")
          .select(
            "id, platform, app_version, os_version, locale, timezone, created_at",
          )
          .eq("user_id", user.id),
        client
          .from("reward_intents")
          .select(
            "id, provider, state, client_event_id, provider_transaction_id, earned_at, verified_at, expires_at, created_at, updated_at",
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
      rewardIntents.error ??
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
    const deviceIds = (devices.data ?? []).map((device) => device.id);
    const pushDevices =
      deviceIds.length === 0
        ? { data: [], error: null }
        : await client
            .from("push_devices")
            .select("push_token, enabled, created_at, updated_at")
            .in("device_id", deviceIds);
    if (pushDevices.error)
      throw new HttpError(
        503,
        "export_unavailable",
        "The privacy export could not be generated",
      );

    return Response.json({
      generatedAt: new Date().toISOString(),
      account: {
        id: user.id,
        email: user.email ?? null,
        phone: user.phone ?? null,
        isAnonymous: Boolean(user.is_anonymous),
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at ?? null,
        linkedIdentities: (user.identities ?? []).map((identity) => ({
          provider: identity.provider,
          identityData: identity.identity_data ?? {},
          createdAt: identity.created_at,
          updatedAt: identity.updated_at,
          lastSignInAt: identity.last_sign_in_at ?? null,
        })),
      },
      profile: profile.data,
      devices: devices.data,
      pushDevices: pushDevices.data,
      rewardIntents: rewardIntents.data,
      tokenLedger: ledger.data,
      unlockSessions: sessions.data,
      wellbeing: wellbeing.data,
      votes: votes.data,
    });
  } catch (error) {
    return routeError(error);
  }
}

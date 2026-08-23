import { castVoteRequestSchema } from "@screen-time/contracts";

import { isAnonymousUser, requireApiUser } from "@/lib/auth";
import { HttpError, parseJson, routeError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase";

export async function PUT(
  request: Request,
  context: { params: Promise<{ weekId: string }> },
) {
  try {
    const user = await requireApiUser(request);
    if (isAnonymousUser(user)) {
      throw new HttpError(403, "account_required", "Link Apple or Google before voting");
    }
    const input = await parseJson(request, castVoteRequestSchema);
    const { weekId } = await context.params;
    const client = createAdminClient()!;
    const { data, error } = await client.rpc("cast_impact_vote", {
      p_user_id: user.id,
      p_impact_week_id: weekId,
      p_charity_id: input.charityId,
    });
    if (error) throw new HttpError(409, "vote_failed", error.message);
    return Response.json({ weekId: data.impact_week_id, charityId: data.charity_id, updatedAt: data.updated_at });
  } catch (error) {
    return routeError(error);
  }
}

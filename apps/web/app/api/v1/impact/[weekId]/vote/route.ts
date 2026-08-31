import { castVoteRequestSchema, uuidSchema } from "@screen-time/contracts";

import { requireApiUser } from "@/lib/auth";
import { hasGoogleIdentity } from "@/lib/google-identity";
import {
  databaseHttpError,
  HttpError,
  parseJson,
  routeError,
} from "@/lib/http";
import { createAdminClient } from "@/lib/supabase";

export async function PUT(
  request: Request,
  context: { params: Promise<{ weekId: string }> },
) {
  try {
    const user = await requireApiUser(request);
    if (!hasGoogleIdentity(user)) {
      throw new HttpError(
        403,
        "account_required",
        "Link Google before voting",
      );
    }
    const input = await parseJson(request, castVoteRequestSchema);
    const { weekId: rawWeekId } = await context.params;
    const weekId = uuidSchema.parse(rawWeekId);
    const client = createAdminClient()!;
    const { data, error } = await client.rpc("cast_impact_vote", {
      p_user_id: user.id,
      p_impact_week_id: weekId,
      p_charity_id: input.charityId,
    });
    if (error)
      throw databaseHttpError(
        error.message,
        [
          [
            "impact_week_not_open",
            409,
            "voting_closed",
            "Voting is not open for this week",
          ],
          [
            "voting_disabled",
            409,
            "voting_disabled",
            "Voting is temporarily paused",
          ],
          [
            "charity_not_in_impact_week",
            400,
            "invalid_candidate",
            "Charity is not a candidate for this week",
          ],
        ],
        {
          status: 409,
          code: "vote_failed",
          message: "Vote could not be recorded",
        },
      );
    return Response.json({
      weekId: data.impact_week_id,
      charityId: data.charity_id,
      updatedAt: data.updated_at,
    });
  } catch (error) {
    return routeError(error);
  }
}

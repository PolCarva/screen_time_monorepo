import { getBearerUser } from "@/lib/supabase";
import { getCurrentImpactWeek } from "@/lib/impact";
import { HttpError, routeError } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const user = await getBearerUser(request);
    const result = await getCurrentImpactWeek(user?.id);
    if (result.state === "unconfigured")
      throw new HttpError(
        503,
        "service_unconfigured",
        "Impact service is not configured",
      );
    if (result.state === "empty")
      throw new HttpError(
        404,
        "impact_week_not_found",
        "No published impact week is available",
      );
    if (result.state === "error")
      throw new HttpError(503, "impact_unavailable", result.message);
    return Response.json(result.week, {
      headers: {
        "cache-control": user ? "private, no-store" : "public, max-age=60",
      },
    });
  } catch (error) {
    return routeError(error);
  }
}

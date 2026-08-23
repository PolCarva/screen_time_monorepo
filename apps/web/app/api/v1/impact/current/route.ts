import { getBearerUser } from "@/lib/supabase";
import { getCurrentImpactWeek } from "@/lib/impact";
import { routeError } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const user = await getBearerUser(request);
    const week = await getCurrentImpactWeek(user?.id);
    return Response.json(week, {
      headers: { "cache-control": user ? "private, no-store" : "public, max-age=60" },
    });
  } catch (error) {
    return routeError(error);
  }
}

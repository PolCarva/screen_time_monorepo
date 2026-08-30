import { z } from "zod";

import { HttpError, parseJson, routeError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase";

const waitlistSchema = z.object({
  email: z.string().trim().email().max(254),
  platform: z.enum(["ios", "android", "both"]),
  locale: z.string().trim().max(16).optional(),
  consent: z.literal(true),
  company: z.string().max(0).optional(),
});

export async function POST(request: Request) {
  try {
    const input = await parseJson(request, waitlistSchema);
    const client = createAdminClient();
    if (!client)
      throw new HttpError(503, "waitlist_unavailable", "Waitlist is not configured");
    const { error } = await client.from("beta_waitlist").upsert(
      {
        email: input.email.toLowerCase(),
        platform: input.platform,
        locale: input.locale ?? null,
        source: "website",
        consented_at: new Date().toISOString(),
      },
      { onConflict: "email", ignoreDuplicates: true },
    );
    if (error)
      throw new HttpError(503, "waitlist_unavailable", "Waitlist is temporarily unavailable");
    return Response.json({ registered: true }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}

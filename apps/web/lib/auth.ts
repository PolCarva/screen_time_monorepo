import "server-only";

import type { User } from "@supabase/supabase-js";

import { HttpError } from "@/lib/http";
import { createAdminClient, getBearerUser } from "@/lib/supabase";

export async function requireApiUser(request: Request): Promise<User> {
  const user = await getBearerUser(request);
  if (!user) throw new HttpError(401, "unauthorized", "A valid bearer token is required");
  if (!createAdminClient()) {
    throw new HttpError(503, "backend_not_configured", "Supabase is not configured");
  }
  return user;
}

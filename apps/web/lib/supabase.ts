import "server-only";

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

import { getSupabasePublicEnv, getSupabaseServerEnv } from "@/lib/env";

export function createAdminClient(): SupabaseClient | null {
  const env = getSupabaseServerEnv();
  if (!env) return null;
  return createClient(env.url, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function getBearerUser(request: Request): Promise<User | null> {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
  const env = getSupabasePublicEnv();
  if (!token || !env) return null;

  const client = createClient(env.url, env.publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error) return null;
  return data.user;
}

export async function isAdminUser(userId: string): Promise<boolean> {
  const client = createAdminClient();
  if (!client) return false;
  const { data } = await client
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

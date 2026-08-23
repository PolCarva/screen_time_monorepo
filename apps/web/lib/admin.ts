import "server-only";

import { redirect } from "next/navigation";

import { getSupabasePublicEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/server-supabase";
import { isAdminUser } from "@/lib/supabase";

export async function requireAdminPage() {
  if (!getSupabasePublicEnv()) return { configured: false as const, user: null };

  const client = await createServerSupabaseClient();
  const { data } = await client!.auth.getUser();
  if (!data.user) redirect("/admin/login");
  if (!(await isAdminUser(data.user.id))) redirect("/admin/login?error=not-admin");
  return { configured: true as const, user: data.user };
}

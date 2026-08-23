"use server";

import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/server-supabase";

export async function requestAdminLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const client = await createServerSupabaseClient();
  if (!client || !email) redirect("/admin/login?error=configuration");
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/admin`, shouldCreateUser: false },
  });
  redirect(error ? "/admin/login?error=signin" : "/admin/login?sent=1");
}

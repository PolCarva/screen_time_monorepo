import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/server-supabase";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const requestedNext = url.searchParams.get("next");
  const next = requestedNext?.startsWith("/") ? requestedNext : "/admin";
  if (code) {
    const client = await createServerSupabaseClient();
    await client?.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL(next, url.origin));
}

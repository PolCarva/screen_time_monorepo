import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/server-supabase";
import { safeLocalRedirect } from "@/lib/redirect";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const requestedNext = url.searchParams.get("next");
  const next = safeLocalRedirect(requestedNext);
  if (!code)
    return NextResponse.redirect(
      new URL("/admin/login?error=missing-code", url.origin),
    );
  const client = await createServerSupabaseClient();
  if (!client)
    return NextResponse.redirect(
      new URL("/admin/login?error=not-configured", url.origin),
    );
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error)
    return NextResponse.redirect(
      new URL("/admin/login?error=invalid-link", url.origin),
    );
  return NextResponse.redirect(new URL(next, url.origin));
}

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { canonicalRedirect } from "@/lib/canonical-host";
import { SITE_URL } from "@/lib/site";

export async function proxy(request: NextRequest) {
  const canonical = canonicalRedirect(request.nextUrl, SITE_URL);
  if (canonical) return NextResponse.redirect(canonical, 308);
  if (!request.nextUrl.pathname.startsWith("/admin")) return NextResponse.next();
  return refreshAdminSession(request);
}

/**
 * Keeps an operator's session alive. Server Components cannot write cookies,
 * so without this the access token expired after an hour and /admin asked for
 * a new code; here the refreshed tokens are written back on every visit.
 */
async function refreshAdminSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  // Refreshes the session when the access token has expired.
  await supabase.auth.getUser();
  return response;
}

// Pages only: the API, Next's assets and app-ads.txt never pass through here.
export const config = {
  matcher: ["/((?!api/|_next/|app-ads\\.txt|\\.well-known/).*)"],
};

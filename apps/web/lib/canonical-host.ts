/**
 * Pages reached through the production *.vercel.app address move to the
 * canonical domain; the API never does. Every shipped app calls the API on
 * the vercel.app address, and a cross-origin redirect makes clients drop the
 * Authorization header, which turned every signed-in request into a 401
 * (account deletion included) when Vercel redirected the whole domain.
 */
const NEVER_REDIRECTED = [/^\/api\//, /^\/app-ads\.txt$/, /^\/\.well-known\//];

export function canonicalRedirect(
  requestUrl: URL,
  siteUrl: string,
  vercelEnvironment: string | undefined = process.env.VERCEL_ENV,
): URL | null {
  if (vercelEnvironment !== "production") return null;
  if (!requestUrl.hostname.endsWith(".vercel.app")) return null;
  const site = new URL(siteUrl);
  if (requestUrl.hostname === site.hostname) return null;
  if (NEVER_REDIRECTED.some((path) => path.test(requestUrl.pathname)))
    return null;
  return new URL(`${requestUrl.pathname}${requestUrl.search}`, site.origin);
}

/**
 * Where an email sign-in link returns: the site the request came from (this
 * computer while developing, production otherwise). It carries no query
 * string, because Supabase only honours an allow-listed callback that matches
 * exactly; /auth/callback already continues to /admin.
 */
export function authCallbackUrl(
  requestOrigin: string | null,
  configuredAppUrl = "http://localhost:3000",
): string {
  const configured = new URL(configuredAppUrl).origin;
  const trusted =
    requestOrigin === configured ||
    /^http:\/\/localhost:\d+$/.test(requestOrigin ?? "");
  return `${trusted ? requestOrigin : configured}/auth/callback`;
}

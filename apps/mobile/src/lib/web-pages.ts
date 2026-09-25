/**
 * Public pages of the Still website. The API and the site are the same
 * deployment (apps/web), so the pages hang off the API's base URL.
 */
const WEB_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

/** App Review 5.1.1(i): the policy must also be reachable inside the app. */
export const PRIVACY_POLICY_PATH = "/privacy";

/** The terms people accept when they set Still up. */
export const TERMS_PATH = "/terms";

export function webPageUrl(path: string, base: string = WEB_URL): string {
  return new URL(path, base).toString();
}

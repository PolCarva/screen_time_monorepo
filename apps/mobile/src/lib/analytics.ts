import * as Sentry from "@sentry/react-native";
import PostHog from "posthog-react-native";

const posthogKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
export const analytics = posthogKey ? new PostHog(posthogKey, { host: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com" }) : null;

export function initializeObservability() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (dsn) Sentry.init({ dsn, sendDefaultPii: false, enableNative: true, tracesSampleRate: 0.1 });
}

const blockedKeys = new Set(["app", "appName", "package", "packageName", "bundleId", "bundleIdentifier", "localAppHandle"]);
export function capture(event: string, properties: Record<string, string | number | boolean> = {}) {
  const safe = Object.fromEntries(Object.entries(properties).filter(([key]) => !blockedKeys.has(key)));
  analytics?.capture(event, safe);
}

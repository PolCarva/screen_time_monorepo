import * as Sentry from "@sentry/react-native";
import PostHog from "posthog-react-native";

import { getJson, setJson } from "./storage";

const posthogKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
let analyticsEnabled = false;
export let analytics: PostHog | null = null;

function applyAnalyticsPreference(enabled: boolean) {
  analyticsEnabled = enabled;
  if (!enabled) {
    analytics?.optOut();
    return;
  }
  if (!posthogKey) return;
  analytics ??= new PostHog(posthogKey, {
    host: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
  });
  analytics.optIn();
}

export async function initializeObservability() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (dsn)
    Sentry.init({
      dsn,
      sendDefaultPii: false,
      enableNative: true,
      tracesSampleRate: 0.1,
    });

  const enabled = await getJson("analyticsEnabled", true).catch(() => false);
  applyAnalyticsPreference(enabled);
}

export async function setAnalyticsCollectionEnabled(enabled: boolean) {
  applyAnalyticsPreference(enabled);
  await setJson("analyticsEnabled", enabled);
}

const blockedKeys = new Set([
  "app",
  "appName",
  "package",
  "packageName",
  "bundleId",
  "bundleIdentifier",
  "localAppHandle",
]);
export function capture(
  event: string,
  properties: Record<string, string | number | boolean> = {},
) {
  if (!analyticsEnabled) return;
  const safe = Object.fromEntries(
    Object.entries(properties).filter(([key]) => !blockedKeys.has(key)),
  );
  analytics?.capture(event, safe);
}

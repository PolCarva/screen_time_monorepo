/**
 * Everything the public site says about itself in one place: its address, the
 * store listings and their state, and the setup videos (docs/landing-seo-plan.md,
 * D3, D5 and D15).
 */

export const SITE_NAME = "Still";

/**
 * The canonical origin, without a trailing slash. Production must say where it
 * lives: a wrong fallback would publish canonicals and a sitemap for someone
 * else's domain.
 */
export function resolveSiteUrl(
  value: string | undefined = process.env.NEXT_PUBLIC_APP_URL,
  vercelEnvironment: string | undefined = process.env.VERCEL_ENV,
): string {
  const trimmed = value?.trim().replace(/\/+$/, "");
  if (trimmed) return trimmed;
  if (vercelEnvironment === "production")
    throw new Error("NEXT_PUBLIC_APP_URL is required in production");
  return "http://localhost:3000";
}

export const SITE_URL = resolveSiteUrl();

export type StoreStatus = "review" | "closed" | "live";

export const STORES = {
  ios: {
    url: "https://apps.apple.com/app/id6815465306",
    appId: "6815465306",
    status: "review" as StoreStatus,
  },
  android: {
    url: "https://play.google.com/store/apps/details?id=com.still.screentime",
    packageName: "com.still.screentime",
    status: "closed" as StoreStatus,
  },
};

export const REQUIREMENTS = {
  ios: "iOS 16.4 o posterior",
  android: "Android 10 o posterior",
};

/** The line under the store badges: where each version really stands. */
export function storeNote(stores = STORES): string {
  const ios = stores.ios.status === "live";
  const android = stores.android.status === "live";
  if (ios && android) return "Gratis en iPhone y Android.";
  const parts = ["Gratis"];
  parts.push(ios ? "disponible en iPhone" : "iPhone en revisión de Apple");
  parts.push(
    android
      ? "disponible en Android"
      : "Android en pruebas cerradas de Google Play",
  );
  return `${parts.join(" · ")}.`;
}

/** Store listings that anyone can open, for `sameAs` and install links. */
export function liveStoreUrls(stores = STORES): string[] {
  return [stores.ios, stores.android]
    .filter((store) => store.status === "live")
    .map((store) => store.url);
}

export type VideoSource = { src: string; poster?: string; duration: string };

/**
 * Setup videos (D15). A null entry keeps its play button hidden: the phone
 * drawn in markup stands in until the recording exists in /public/videos.
 */
export const VIDEOS: Record<
  "pause" | "chooseApps" | "androidSetup" | "iosSetup",
  VideoSource | null
> = {
  pause: null,
  chooseApps: null,
  androidSetup: null,
  iosSetup: null,
};

export const CONTACT_EMAIL = "pablocarvalhogimenez@gmail.com";

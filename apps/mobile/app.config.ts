import type { ExpoConfig } from "expo/config";

const variant = process.env.APP_VARIANT ?? "development";
const production = variant === "production";

function buildValue(
  name: string,
  developmentFallback?: string,
): string | undefined {
  const value = process.env[name];
  if (production && !value)
    throw new Error(`${name} is required for a production mobile build`);
  return value ?? developmentFallback;
}

const apiUrl = buildValue("EXPO_PUBLIC_API_URL", "http://localhost:3000");
const supabaseUrl = buildValue("EXPO_PUBLIC_SUPABASE_URL");
const supabasePublishableKey = buildValue(
  "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
);
const easProjectId = buildValue("EXPO_PUBLIC_EAS_PROJECT_ID");
const androidAppId = buildValue(
  "ADMOB_ANDROID_APP_ID",
  "ca-app-pub-3940256099942544~3347511713",
);
const iosAppId = buildValue(
  "ADMOB_IOS_APP_ID",
  "ca-app-pub-3940256099942544~1458002511",
);
const rewardedAndroid = buildValue(
  "EXPO_PUBLIC_ADMOB_REWARDED_ANDROID",
  "ca-app-pub-3940256099942544/5224354917",
);
const rewardedIos = buildValue(
  "EXPO_PUBLIC_ADMOB_REWARDED_IOS",
  "ca-app-pub-3940256099942544/1712485313",
);

if (production) {
  if (!apiUrl?.startsWith("https://"))
    throw new Error("EXPO_PUBLIC_API_URL must use HTTPS in production");
  if (!supabaseUrl?.startsWith("https://"))
    throw new Error("EXPO_PUBLIC_SUPABASE_URL must use HTTPS in production");
  for (const [name, value] of [
    ["ADMOB_ANDROID_APP_ID", androidAppId],
    ["ADMOB_IOS_APP_ID", iosAppId],
    ["EXPO_PUBLIC_ADMOB_REWARDED_ANDROID", rewardedAndroid],
    ["EXPO_PUBLIC_ADMOB_REWARDED_IOS", rewardedIos],
  ] as const) {
    if (value?.includes("3940256099942544"))
      throw new Error(
        `${name} must not use Google's sample ad identifier in production`,
      );
  }
}

const config: ExpoConfig = {
  name: production ? "Still" : `Still ${variant}`,
  slug: "still-screen-time",
  version: "0.1.0",
  orientation: "portrait",
  scheme: "still",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  runtimeVersion: { policy: "appVersion" },
  ios: {
    supportsTablet: false,
    deploymentTarget: "16.4",
    bundleIdentifier: "com.still.screentime",
    entitlements: {
      "com.apple.security.application-groups": ["group.com.still.screentime"],
      "com.apple.developer.family-controls": true,
    },
    infoPlist: {
      CFBundleDevelopmentRegion: "en",
      CFBundleLocalizations: ["en", "es"],
    },
  },
  android: {
    package: "com.still.screentime",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#F1EFE8",
    },
    permissions: [
      "android.permission.PACKAGE_USAGE_STATS",
      "android.permission.POST_NOTIFICATIONS",
    ],
  },
  plugins: [
    "@sentry/react-native",
    "expo-router",
    "expo-notifications",
    "expo-font",
    "expo-localization",
    [
      "expo-splash-screen",
      {
        image: "./assets/splash-icon.png",
        imageWidth: 220,
        resizeMode: "contain",
        backgroundColor: "#F1EFE8",
      },
    ],
    "expo-sqlite",
    "expo-status-bar",
    "expo-web-browser",
    [
      "expo-secure-store",
      {
        configureAndroidBackup: true,
        faceIDPermission: "Allow Still to protect your session.",
      },
    ],
    [
      "expo-build-properties",
      {
        ios: { deploymentTarget: "16.4" },
        android: {
          minSdkVersion: 29,
          compileSdkVersion: 36,
          targetSdkVersion: 36,
        },
      },
    ],
    ["react-native-google-mobile-ads", { androidAppId, iosAppId }],
    "./plugins/with-still-native.cjs",
  ],
  experiments: { typedRoutes: true },
  extra: {
    apiUrl,
    supabaseUrl,
    supabasePublishableKey,
    eas: { projectId: easProjectId },
  },
};

export default config;

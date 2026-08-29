import type { ExpoConfig } from "expo/config";

const variant = process.env.APP_VARIANT ?? "production";
const production = variant === "production";

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
    permissions: ["android.permission.PACKAGE_USAGE_STATS", "android.permission.POST_NOTIFICATIONS"],
  },
  plugins: [
    "@sentry/react-native",
    "expo-router",
    "expo-notifications",
    "expo-font",
    "expo-localization",
    ["expo-splash-screen", { image: "./assets/splash-icon.png", imageWidth: 220, resizeMode: "contain", backgroundColor: "#F1EFE8" }],
    "expo-sqlite",
    "expo-status-bar",
    "expo-web-browser",
    ["expo-secure-store", { configureAndroidBackup: true, faceIDPermission: "Allow Still to protect your session." }],
    ["expo-build-properties", { ios: { deploymentTarget: "16.4" }, android: { minSdkVersion: 29, compileSdkVersion: 36, targetSdkVersion: 36 } }],
    ["react-native-google-mobile-ads", { androidAppId: process.env.ADMOB_ANDROID_APP_ID ?? "ca-app-pub-3940256099942544~3347511713", iosAppId: process.env.ADMOB_IOS_APP_ID ?? "ca-app-pub-3940256099942544~1458002511" }],
    "./plugins/with-still-native.cjs",
  ],
  experiments: { typedRoutes: true },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000",
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID },
  },
};

export default config;

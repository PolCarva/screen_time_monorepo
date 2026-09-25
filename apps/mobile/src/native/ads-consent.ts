import {
  AdsConsent,
  AdsConsentDebugGeography,
  AdsConsentStatus,
  type AdsConsentInfoOptions,
} from "react-native-google-mobile-ads";

/**
 * Google's consent for ads (UMP), asked inside the onboarding instead of at
 * the first pause, and only where Google requires it: the EEA, the UK and
 * Switzerland (docs/onboarding-v2-plan.md, D12). What UMP stores is read by
 * the ads SDK in the same app process, including Android's native shield.
 */
function options(): AdsConsentInfoOptions {
  // Development only: pretend to be in the EEA to see the form (HA4).
  if (__DEV__ && process.env.EXPO_PUBLIC_DEV_UMP_EEA === "1") {
    return {
      tagForUnderAgeOfConsent: false,
      debugGeography: AdsConsentDebugGeography.EEA,
      testDeviceIdentifiers: ["EMULATOR"],
    };
  }
  return { tagForUnderAgeOfConsent: false };
}

/** Whether this user has to choose before ads are shown. */
export async function consentRequirement(): Promise<"required" | "not-required"> {
  const info = await AdsConsent.requestInfoUpdate(options());
  return info.status === AdsConsentStatus.REQUIRED ? "required" : "not-required";
}

/** Shows Google's form if it is still required; the user's answer is final either way. */
export async function askForConsent(): Promise<{
  resolved: boolean;
  canRequestAds: boolean;
}> {
  await AdsConsent.requestInfoUpdate(options());
  const info = await AdsConsent.loadAndShowConsentFormIfRequired();
  return {
    resolved:
      info.status === AdsConsentStatus.OBTAINED ||
      info.status === AdsConsentStatus.NOT_REQUIRED,
    canRequestAds: info.canRequestAds,
  };
}

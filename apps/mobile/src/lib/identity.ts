import * as AppleAuthentication from "expo-apple-authentication";
import { makeRedirectUri } from "expo-auth-session";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

import { restrictionEngine } from "@/native/restriction-engine";
import { holdOtaReload } from "./ota-policy";
import { supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

export type IdentityProvider = "google" | "apple";

class IdentityOAuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "IdentityOAuthError";
  }
}

function errorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  return typeof error.code === "string" ? error.code : null;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "";
}

function belongsToExistingAccount(error: unknown) {
  const code = errorCode(error);
  if (
    code === "email_exists" ||
    code === "identity_already_exists" ||
    code === "user_already_exists"
  )
    return true;

  return /already (?:been )?(?:registered|linked)|already exists/i.test(
    errorMessage(error),
  );
}

async function refreshIfProviderIsAlreadyLinked(
  provider: IdentityProvider,
) {
  if (!supabase) return false;
  const { data, error } = await supabase.auth.getUserIdentities();
  if (error) return false;
  const linked = (data?.identities ?? []).some(
    (identity) => identity.provider === provider,
  );
  if (!linked) return false;

  const refreshed = await supabase.auth.refreshSession();
  if (refreshed.error) throw refreshed.error;
  return true;
}

async function signInToExistingAccount(
  provider: IdentityProvider,
  redirectTo: string,
) {
  if (!supabase) throw new Error("Supabase is not configured");
  const recovered = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (recovered.error) throw recovered.error;
  if (!recovered.data.url)
    throw new Error("Identity provider did not return a recovery URL");
  return finishOAuth(
    recovered.data.url,
    redirectTo,
    recovered.data.flowId,
  );
}

async function finishOAuth(
  url: string,
  redirectTo: string,
  flowId?: string | null,
) {
  if (!supabase) throw new Error("Supabase is not configured");
  const result = await WebBrowser.openAuthSessionAsync(url, redirectTo);
  if (result.type !== "success") return false;

  const callbackUrl = new URL(result.url);
  const callbackErrorCode =
    callbackUrl.searchParams.get("error_code") ??
    callbackUrl.searchParams.get("error") ??
    "oauth_callback_error";
  const callbackError =
    callbackUrl.searchParams.get("error_description") ??
    callbackUrl.searchParams.get("error");
  if (callbackError)
    throw new IdentityOAuthError(callbackErrorCode, callbackError);

  const code = callbackUrl.searchParams.get("code");
  if (!code) throw new Error("Missing authorization code");
  const exchanged = await supabase.auth.exchangeCodeForSession(
    code,
    flowId ? { flowId } : undefined,
  );
  if (exchanged.error) throw exchanged.error;
  return true;
}

export function isIdentityProviderEnabled(provider: IdentityProvider) {
  if (provider === "apple") return Platform.OS === "ios";
  return process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED === "true";
}

// App Review requires Sign in with Apple next to Google on iOS, with at least
// the same prominence, so Apple leads there.
export function identityProviders(): IdentityProvider[] {
  const order: IdentityProvider[] =
    Platform.OS === "ios" ? ["apple", "google"] : ["google"];
  return order.filter(isIdentityProviderEnabled);
}

export function identityProviderName(provider: IdentityProvider) {
  return provider === "apple" ? "Apple" : "Google";
}

export async function getLinkedIdentityProviders(): Promise<
  IdentityProvider[]
> {
  if (!supabase) return [];
  const { data, error } = await supabase.auth.getUserIdentities();
  if (error) throw error;
  return (data?.identities ?? []).flatMap((identity) =>
    identity.provider === "google" || identity.provider === "apple"
      ? [identity.provider]
      : [],
  );
}

export async function linkIdentity(provider: IdentityProvider) {
  if (!supabase) throw new Error("Supabase is not configured");
  if (!isIdentityProviderEnabled(provider))
    throw new Error(`${provider}_identity_provider_disabled`);
  if (provider === "apple") {
    // No browser here, but Apple's sheet can sit open while an update waits.
    const releaseOta = holdOtaReload();
    try {
      return await linkAppleIdentity();
    } finally {
      releaseOta();
    }
  }
  const redirectTo = makeRedirectUri({
    scheme: "still",
    path: "auth/callback",
  });
  await restrictionEngine.beginExternalAuthSession?.();
  // An update never reloads mid sign-in, before the pause is back on.
  const releaseOta = holdOtaReload();
  try {
    const { data, error } = await supabase.auth.linkIdentity({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) {
      if (!belongsToExistingAccount(error)) throw error;
      if (await refreshIfProviderIsAlreadyLinked(provider)) return true;
      return await signInToExistingAccount(provider, redirectTo);
    }
    if (!data.url) throw new Error("Identity provider did not return a URL");

    try {
      return await finishOAuth(data.url, redirectTo, data.flowId);
    } catch (linkError) {
      // The provider can finish linking before a stale client fails to exchange
      // the callback code. Trust the authenticated identities endpoint over the
      // local error so the next render reflects the server-side success.
      if (await refreshIfProviderIsAlreadyLinked(provider)) return true;
      if (!belongsToExistingAccount(linkError)) throw linkError;
      return await signInToExistingAccount(provider, redirectTo);
    }
  } finally {
    releaseOta();
    await restrictionEngine.endExternalAuthSession?.().catch(() => undefined);
  }
}

/**
 * A fresh Sign in with Apple authorization code for account deletion: the
 * server exchanges it and revokes Still's access to the Apple ID, as Apple
 * asks of apps that offer both. Null off iOS, when no Apple ID is linked, and
 * when the person closes Apple's sheet or it fails; deletion never waits on it.
 */
export async function appleAuthorizationForDeletion(): Promise<string | null> {
  if (Platform.OS !== "ios") return null;
  const linked = await getLinkedIdentityProviders().catch(
    (): IdentityProvider[] => [],
  );
  if (!linked.includes("apple")) return null;
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [],
    });
    return credential.authorizationCode ?? null;
  } catch {
    return null;
  }
}

// Native Sign in with Apple: the system sheet returns an ID token that Supabase
// verifies against the hashed nonce, so no browser session is involved.
async function linkAppleIdentity() {
  if (!supabase) throw new Error("Supabase is not configured");
  const nonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    nonce,
  );
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    });
  } catch (error) {
    if (errorCode(error) === "ERR_REQUEST_CANCELED") return false;
    throw error;
  }
  const token = credential.identityToken;
  if (!token) throw new Error("Apple did not return an identity token");

  const { error } = await supabase.auth.linkIdentity({
    provider: "apple",
    token,
    nonce,
  });
  if (!error) return true;
  if (!belongsToExistingAccount(error)) throw error;
  if (await refreshIfProviderIsAlreadyLinked("apple")) return true;

  // This Apple ID already belongs to another Still account: recover it.
  const recovered = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token,
    nonce,
  });
  if (recovered.error) throw recovered.error;
  return true;
}

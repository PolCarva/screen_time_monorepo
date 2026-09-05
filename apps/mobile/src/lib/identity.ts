import { makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";

import { restrictionEngine } from "@/native/restriction-engine";
import { supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

export type IdentityProvider = "google";

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

export function isIdentityProviderEnabled(_provider: IdentityProvider) {
  return process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED === "true";
}

export async function getLinkedIdentityProviders(): Promise<
  IdentityProvider[]
> {
  if (!supabase) return [];
  const { data, error } = await supabase.auth.getUserIdentities();
  if (error) throw error;
  return (data?.identities ?? []).flatMap((identity) =>
    identity.provider === "google" ? [identity.provider] : [],
  );
}

export async function linkIdentity(provider: IdentityProvider) {
  if (!supabase) throw new Error("Supabase is not configured");
  if (!isIdentityProviderEnabled(provider))
    throw new Error(`${provider}_identity_provider_disabled`);
  const redirectTo = makeRedirectUri({
    scheme: "still",
    path: "auth/callback",
  });
  await restrictionEngine.beginExternalAuthSession?.();
  try {
    const { data, error } = await supabase.auth.linkIdentity({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) {
      if (!belongsToExistingAccount(error)) throw error;
      if (await refreshIfProviderIsAlreadyLinked(provider)) return true;
      return signInToExistingAccount(provider, redirectTo);
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
      return signInToExistingAccount(provider, redirectTo);
    }
  } finally {
    await restrictionEngine.endExternalAuthSession?.().catch(() => undefined);
  }
}

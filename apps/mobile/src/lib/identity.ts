import { makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";

import { supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

export type IdentityProvider = "google";

export function isIdentityProviderEnabled(_provider: IdentityProvider) {
  return process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED === "true";
}

export async function getLinkedIdentityProviders(): Promise<IdentityProvider[]> {
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
  const redirectTo = makeRedirectUri({ scheme: "still", path: "auth/callback" });
  const { data, error } = await supabase.auth.linkIdentity({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error("Identity provider did not return a URL");
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") return false;
  const code = new URL(result.url).searchParams.get("code");
  if (!code) throw new Error("Missing authorization code");
  const exchanged = await supabase.auth.exchangeCodeForSession(code);
  if (exchanged.error) throw exchanged.error;
  return true;
}

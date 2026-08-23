import { makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";

import { supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

export async function linkIdentity(provider: "apple" | "google") {
  if (!supabase) throw new Error("Supabase is not configured");
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

import type { User } from "@supabase/supabase-js";

export function hasGoogleIdentity(user: User): boolean {
  if (user.identities?.some((identity) => identity.provider === "google")) {
    return true;
  }

  const providers = user.app_metadata?.providers;
  return (
    user.app_metadata?.provider === "google" ||
    (Array.isArray(providers) && providers.includes("google"))
  );
}

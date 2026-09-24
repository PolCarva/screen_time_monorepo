import type { User } from "@supabase/supabase-js";

// Google on both platforms; Apple on iOS, where App Review requires Sign in
// with Apple next to any other account option.
const VOTING_PROVIDERS = new Set(["google", "apple"]);

export function hasVotingIdentity(user: User): boolean {
  if (
    user.identities?.some((identity) => VOTING_PROVIDERS.has(identity.provider))
  ) {
    return true;
  }

  const providers = user.app_metadata?.providers;
  return (
    VOTING_PROVIDERS.has(user.app_metadata?.provider ?? "") ||
    (Array.isArray(providers) &&
      providers.some((provider) => VOTING_PROVIDERS.has(provider)))
  );
}

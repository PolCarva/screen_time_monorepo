import * as SecureStore from "expo-secure-store";
import { createClient, type Session } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const secureStorage = {
  getItem: (storageKey: string) => SecureStore.getItemAsync(storageKey),
  setItem: (storageKey: string, value: string) =>
    SecureStore.setItemAsync(storageKey, value),
  removeItem: (storageKey: string) => SecureStore.deleteItemAsync(storageKey),
};

export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          storage: secureStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
          flowType: "pkce",
        },
      })
    : null;

/**
 * One anonymous sign-in at a time: requests that start together while there is
 * no session (the first launch, or right after deleting the account) share it
 * instead of each creating an account and keeping only the last.
 */
let anonymousSignIn: Promise<Session | null> | null = null;

export async function ensureAnonymousSession() {
  if (!supabase) return null;
  const client = supabase;
  const { data: current } = await client.auth.getSession();
  if (current.session) return current.session;
  anonymousSignIn ??= client.auth
    .signInAnonymously()
    .then(({ data, error }) => {
      if (error) throw error;
      return data.session;
    })
    .finally(() => {
      anonymousSignIn = null;
    });
  return anonymousSignIn;
}

/** A fresh access token for a session the server just refused, or null. */
export async function refreshSessionAfterRefusal() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.refreshSession();
  return error ? null : data.session;
}

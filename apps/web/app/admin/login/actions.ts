"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { authCallbackUrl } from "@/lib/auth-callback";
import { clientAddressFrom, consumeRateLimit } from "@/lib/rate-limit";
import { createServerSupabaseClient } from "@/lib/server-supabase";
import { createAdminClient } from "@/lib/supabase";

/** The address a code was requested for, kept out of the URL. */
const PENDING_EMAIL_COOKIE = "still_admin_login";
/** Matches Supabase's default email code lifetime. */
const PENDING_EMAIL_SECONDS = 60 * 60;
const TEN_MINUTES = 10 * 60;

function normalizeEmail(value: FormDataEntryValue | null): string | null {
  const email = String(value ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254
    ? email
    : null;
}

async function pendingEmail(): Promise<string | null> {
  return (await cookies()).get(PENDING_EMAIL_COOKIE)?.value ?? null;
}

/**
 * Sends a sign-in code only to operators. Anyone else gets the same answer and
 * no email, so the form cannot be used to mail arbitrary addresses nor to find
 * out who is an operator.
 */
export async function requestAdminCode(formData: FormData) {
  const email = normalizeEmail(formData.get("email"));
  if (!email) redirect("/admin/login?error=email");
  const admin = createAdminClient();
  const client = await createServerSupabaseClient();
  if (!admin || !client) redirect("/admin/login?error=configuration");

  const requestHeaders = await headers();
  const address = clientAddressFrom(requestHeaders);
  const allowed = await Promise.all([
    consumeRateLimit(admin, "admin-code:address", address, 5, TEN_MINUTES),
    consumeRateLimit(admin, "admin-code:email", email, 3, TEN_MINUTES),
  ]).then(
    (checks) => checks.every(Boolean),
    () => null,
  );
  if (allowed === null) redirect("/admin/login?error=configuration");
  if (!allowed) redirect("/admin/login?error=rate");

  const { data: isOperator, error: lookupError } = await admin.rpc(
    "admin_login_allowed",
    { p_email: email },
  );
  if (lookupError) redirect("/admin/login?error=configuration");
  if (isOperator === true) {
    // Supabase's built-in email sends a link; with custom SMTP the template can
    // carry the code instead ({{ .Token }}). Both sign in: the link through
    // /auth/callback in this same browser, the code through verifyAdminCode.
    const { error } = await client.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: authCallbackUrl(
          requestHeaders.get("origin"),
          process.env.NEXT_PUBLIC_APP_URL,
        ),
      },
    });
    if (error) console.error("Admin sign-in code was not sent", error.message);
  }

  (await cookies()).set(PENDING_EMAIL_COOKIE, email, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    maxAge: PENDING_EMAIL_SECONDS,
  });
  redirect("/admin/login?step=code");
}

/** Signs the operator in; the session then stays in this browser. */
export async function verifyAdminCode(formData: FormData) {
  const email = await pendingEmail();
  if (!email) redirect("/admin/login?error=expired");
  const code = String(formData.get("code") ?? "").replace(/\s+/g, "");
  if (!/^\d{6,10}$/.test(code)) redirect("/admin/login?step=code&error=code");
  const admin = createAdminClient();
  const client = await createServerSupabaseClient();
  if (!admin || !client) redirect("/admin/login?error=configuration");

  const address = clientAddressFrom(await headers());
  const allowed = await Promise.all([
    consumeRateLimit(admin, "admin-verify:address", address, 10, TEN_MINUTES),
    consumeRateLimit(admin, "admin-verify:email", email, 10, TEN_MINUTES),
  ]).then(
    (checks) => checks.every(Boolean),
    () => null,
  );
  if (allowed === null) redirect("/admin/login?step=code&error=configuration");
  if (!allowed) redirect("/admin/login?step=code&error=rate");

  const { error } = await client.auth.verifyOtp({
    email,
    token: code,
    type: "email",
  });
  if (error) redirect("/admin/login?step=code&error=code");
  (await cookies()).delete({ name: PENDING_EMAIL_COOKIE, path: "/admin" });
  redirect("/admin");
}

export async function chooseAnotherEmail() {
  (await cookies()).delete({ name: PENDING_EMAIL_COOKIE, path: "/admin" });
  redirect("/admin/login");
}

export async function signOutAdmin() {
  const client = await createServerSupabaseClient();
  await client?.auth.signOut();
  redirect("/admin/login");
}

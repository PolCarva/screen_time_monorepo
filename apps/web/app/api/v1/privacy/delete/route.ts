import { requireApiUser } from "@/lib/auth";
import { HttpError, routeError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(request);
    const client = createAdminClient()!;
    const pseudonym = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(user.id),
    );
    const pseudonymHex = Array.from(new Uint8Array(pseudonym), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");

    const { error: pseudonymizeError } = await client.rpc(
      "pseudonymize_financial_ledger",
      {
        p_user_id: user.id,
        p_former_user_hash: pseudonymHex,
      },
    );
    if (pseudonymizeError) {
      throw new HttpError(
        503,
        "pseudonymization_failed",
        "Financial records could not be pseudonymized",
      );
    }
    const { error } = await client.auth.admin.deleteUser(user.id);
    if (error) {
      const { error: restoreError } = await client.rpc(
        "restore_financial_ledger_identity",
        {
          p_user_id: user.id,
          p_former_user_hash: pseudonymHex,
        },
      );
      if (restoreError)
        console.error("Critical privacy deletion rollback failure", {
          formerUserHash: pseudonymHex,
          restoreError,
        });
      throw new HttpError(
        503,
        restoreError ? "delete_rollback_failed" : "delete_failed",
        restoreError
          ? "Account deletion needs operator attention"
          : "Account could not be deleted",
      );
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    return routeError(error);
  }
}

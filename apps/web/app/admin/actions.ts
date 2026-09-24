"use server";

import { charitySchema, remoteConfigSchema } from "@screen-time/contracts";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminPage } from "@/lib/admin";
import { validateDonationProof } from "@/lib/donation-proof";
import { createAdminClient } from "@/lib/supabase";

const uuid = z.string().uuid();
export type AdminActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const actionError = (message: string): AdminActionState => ({
  status: "error",
  message,
});
const actionSuccess = (message: string): AdminActionState => ({
  status: "success",
  message,
});

export async function closeVoting(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdminPage();
  if (!admin.configured || !admin.user)
    return actionError("Supabase no está configurado.");
  try {
    const weekId = uuid.parse(String(formData.get("weekId") ?? ""));
    const client = createAdminClient()!;
    const { error } = await client.rpc("admin_close_impact_voting", {
      p_admin_user_id: admin.user.id,
      p_week_id: weekId,
    });
    if (error)
      return actionError(
        "No se pudo cerrar la votación. Revisa el estado de la semana.",
      );
    revalidatePath("/admin");
    revalidatePath("/impacto");
    revalidatePath("/");
    return actionSuccess("Votación cerrada.");
  } catch {
    return actionError("Los datos de la semana no son válidos.");
  }
}

export async function confirmRevenue(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdminPage();
  if (!admin.configured || !admin.user)
    return actionError("Supabase no está configurado.");
  try {
    const weekId = uuid.parse(String(formData.get("weekId") ?? ""));
    const grossRevenueMinor = Math.round(
      Number(formData.get("grossRevenue")) * 100,
    );
    if (!Number.isSafeInteger(grossRevenueMinor) || grossRevenueMinor < 0)
      return actionError("Ingresa un monto válido.");
    const client = createAdminClient()!;
    const { error } = await client.rpc("admin_confirm_impact_revenue", {
      p_admin_user_id: admin.user.id,
      p_week_id: weekId,
      p_gross_revenue_minor: grossRevenueMinor,
    });
    if (error)
      return actionError(
        "No se pudo confirmar el ingreso. Revisa el estado de la semana.",
      );
    revalidatePath("/admin");
    revalidatePath("/impacto");
    revalidatePath("/");
    return actionSuccess("Ingreso confirmado y distribución congelada.");
  } catch {
    return actionError("Los datos enviados no son válidos.");
  }
}

export async function recordDonation(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdminPage();
  if (!admin.configured || !admin.user)
    return actionError("Supabase no está configurado.");
  try {
    const weekId = uuid.parse(String(formData.get("weekId") ?? ""));
    const charityId = uuid.parse(String(formData.get("charityId") ?? ""));
    const amountMinor = Math.round(Number(formData.get("amount")) * 100);
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 1)
      return actionError("Ingresa un monto válido.");
    const proofFile = formData.get("proofFile");
    const proofType = await validateDonationProof(proofFile);
    const client = createAdminClient()!;
    const proofPath = `${weekId}/${crypto.randomUUID()}.${proofType.extension}`;
    const { error: uploadError } = await client.storage
      .from("donation-proofs")
      .upload(proofPath, proofFile as File, {
        contentType: proofType.contentType,
        upsert: false,
      });
    if (uploadError) return actionError("No se pudo almacenar el comprobante.");
    const { data: publicProof } = client.storage
      .from("donation-proofs")
      .getPublicUrl(proofPath);
    const { error } = await client.rpc("admin_record_impact_donation", {
      p_admin_user_id: admin.user.id,
      p_week_id: weekId,
      p_charity_id: charityId,
      p_amount_minor: amountMinor,
      p_proof_url: publicProof.publicUrl,
    });
    if (error) {
      await client.storage.from("donation-proofs").remove([proofPath]);
      return actionError(
        "No se pudo registrar la donación. El comprobante no fue publicado.",
      );
    }
    revalidatePath("/admin");
    revalidatePath("/impacto");
    revalidatePath("/");
    return actionSuccess("Donación y comprobante publicados.");
  } catch (error) {
    return actionError(
      error instanceof Error
        ? error.message
        : "Los datos enviados no son válidos.",
    );
  }
}

/**
 * Weeks open by themselves (ensure_current_impact_week, run by the daily jobs
 * and on every read). This only runs the same rollover now, for an operator
 * who just added the first project or published the first configuration.
 */
export async function openCurrentWeek(
  _previous: AdminActionState,
  _formData: FormData,
): Promise<AdminActionState> {
  void _previous;
  void _formData;
  const admin = await requireAdminPage();
  if (!admin.configured || !admin.user)
    return actionError("Supabase no está configurado.");
  const client = createAdminClient()!;
  const { data: weekId, error } = await client.rpc("ensure_current_impact_week");
  if (error) return actionError("No se pudo abrir la semana de impacto.");
  if (!weekId)
    return actionError(
      "Publica una configuración y crea al menos una entidad activa para abrir la semana.",
    );
  revalidatePath("/admin");
  revalidatePath("/impacto");
  revalidatePath("/");
  return actionSuccess("Semana de impacto abierta.");
}

export async function publishConfig(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdminPage();
  if (!admin.configured || !admin.user)
    return actionError("Supabase no está configurado.");
  try {
    const impactPercentage = Number(formData.get("impactPercentage"));
    const payload = remoteConfigSchema.parse({
      version: 1,
      unlockDurationSeconds: Math.round(
        Number(formData.get("unlockDurationMinutes")) * 60,
      ),
      maxRewardedAdsPerUtcDay: Number(formData.get("maxRewardedAdsPerUtcDay")),
      maxRewardTokenBalance: Number(formData.get("maxRewardTokenBalance")),
      impactPercentage,
      platformPercentage: 100 - impactPercentage,
      estimatedMinutesPerAvoidedOpen: Number(
        formData.get("estimatedMinutesPerAvoidedOpen"),
      ),
      estimatedRewardedEcpmUsd: Number(formData.get("estimatedRewardedEcpmUsd")),
      rewardProvider: String(formData.get("rewardProvider")),
      votingEnabled: formData.get("votingEnabled") === "on",
      iosRestrictionEnabled: formData.get("iosRestrictionEnabled") === "on",
      androidRestrictionEnabled:
        formData.get("androidRestrictionEnabled") === "on",
      iosHomeOnCancelEnabled: formData.get("iosHomeOnCancelEnabled") === "on",
      publishedAt: new Date().toISOString(),
    });
    const client = createAdminClient()!;
    const { error } = await client.rpc("admin_publish_remote_config", {
      p_admin_user_id: admin.user.id,
      p_payload: payload,
    });
    if (error) return actionError("No se pudo publicar la configuración.");
    revalidatePath("/admin");
    revalidatePath("/impacto");
    revalidatePath("/");
    return actionSuccess("Configuración publicada y auditada.");
  } catch {
    return actionError("Revisa los límites y porcentajes de la configuración.");
  }
}

export async function createCharity(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdminPage();
  if (!admin.configured || !admin.user)
    return actionError("Supabase no está configurado.");
  try {
    const input = charitySchema.omit({ id: true }).parse({
      name: String(formData.get("name") ?? "").trim(),
      logoUrl: String(formData.get("logoUrl") ?? "").trim() || null,
      shortDescription: String(formData.get("shortDescription") ?? "").trim(),
      website: String(formData.get("website") ?? "").trim(),
      country: String(formData.get("country") ?? "").trim(),
      category: String(formData.get("category") ?? ""),
    });
    const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
      return actionError("El slug debe usar minúsculas, números y guiones.");
    const client = createAdminClient()!;
    const { error } = await client.rpc("admin_create_charity", {
      p_admin_user_id: admin.user.id,
      p_name: input.name,
      p_slug: slug,
      p_short_description: input.shortDescription,
      p_website: input.website,
      p_country: input.country,
      p_category: input.category,
      p_logo_url: input.logoUrl,
    });
    if (error) return actionError("No se pudo crear la entidad; revisa el slug y la URL.");
    revalidatePath("/admin");
    return actionSuccess("Entidad creada y disponible para la próxima semana.");
  } catch {
    return actionError("Los datos de la entidad no son válidos.");
  }
}

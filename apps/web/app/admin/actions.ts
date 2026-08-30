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
    revalidatePath("/impact");
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
    revalidatePath("/impact");
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
    revalidatePath("/impact");
    return actionSuccess("Donación y comprobante publicados.");
  } catch (error) {
    return actionError(
      error instanceof Error
        ? error.message
        : "Los datos enviados no son válidos.",
    );
  }
}

export async function openNextWeek(
  _previous: AdminActionState,
  _formData: FormData,
): Promise<AdminActionState> {
  void _previous;
  void _formData;
  const admin = await requireAdminPage();
  if (!admin.configured || !admin.user)
    return actionError("Supabase no está configurado.");
  const client = createAdminClient()!;
  const { data: active, error: activeError } = await client
    .from("impact_weeks")
    .select("id")
    .in("status", ["open", "voting_closed", "donation_pending"])
    .limit(1)
    .maybeSingle();
  if (activeError) return actionError("No se pudo revisar la semana activa.");
  if (active)
    return actionError("Completa la semana activa antes de abrir otra.");

  const { data: latestWeek, error: latestWeekError } = await client
    .from("impact_weeks")
    .select("week_end")
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestWeekError)
    return actionError("No se pudo revisar la última semana.");
  const now = new Date();
  const day = now.getUTCDay();
  const currentMonday = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - ((day + 6) % 7),
    ),
  );
  const afterLatest = latestWeek?.week_end
    ? new Date(`${latestWeek.week_end}T00:00:00.000Z`).getTime() + 86_400_000
    : 0;
  const monday = new Date(Math.max(currentMonday.getTime(), afterLatest));
  const sunday = new Date(monday.getTime() + 6 * 86_400_000);
  const dateOnly = (date: Date) => date.toISOString().slice(0, 10);
  const [configResult, charitiesResult] = await Promise.all([
    client
      .from("remote_config_versions")
      .select("payload")
      .eq("is_active", true)
      .maybeSingle(),
    client
      .from("charities")
      .select("id")
      .eq("is_active", true)
      .order("created_at")
      .limit(3),
  ]);
  if (configResult.error || charitiesResult.error)
    return actionError("No se pudo cargar la configuración de impacto.");
  const config = remoteConfigSchema.safeParse(configResult.data?.payload);
  const charities = charitiesResult.data;
  if (!charities || charities.length === 0)
    return actionError("Se necesita al menos una entidad activa.");
  if (!config.success)
    return actionError("Publica una configuración operativa válida antes de abrir la semana.");
  const impactPercentage = config.data.impactPercentage;
  const platformPercentage = config.data.platformPercentage;
  const { data: weekId, error } = await client.rpc("admin_open_impact_week", {
    p_admin_user_id: admin.user.id,
    p_week_start: dateOnly(monday),
    p_week_end: dateOnly(sunday),
    p_impact_percentage: impactPercentage,
    p_platform_percentage: platformPercentage,
    p_charity_ids: charities.map((charity) => charity.id),
  });
  if (error || !weekId)
    return actionError("No se pudo abrir la semana de impacto.");
  revalidatePath("/admin");
  revalidatePath("/impact");
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
      dailyEmergencyUnlocks: Number(formData.get("dailyEmergencyUnlocks")),
      maxRewardedAdsPerUtcDay: Number(formData.get("maxRewardedAdsPerUtcDay")),
      maxRewardTokenBalance: Number(formData.get("maxRewardTokenBalance")),
      impactPercentage,
      platformPercentage: 100 - impactPercentage,
      estimatedMinutesPerAvoidedOpen: Number(
        formData.get("estimatedMinutesPerAvoidedOpen"),
      ),
      rewardProvider: String(formData.get("rewardProvider")),
      votingEnabled: formData.get("votingEnabled") === "on",
      iosRestrictionEnabled: formData.get("iosRestrictionEnabled") === "on",
      androidRestrictionEnabled:
        formData.get("androidRestrictionEnabled") === "on",
      publishedAt: new Date().toISOString(),
    });
    const client = createAdminClient()!;
    const { error } = await client.rpc("admin_publish_remote_config", {
      p_admin_user_id: admin.user.id,
      p_payload: payload,
    });
    if (error) return actionError("No se pudo publicar la configuración.");
    revalidatePath("/admin");
    revalidatePath("/impact");
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

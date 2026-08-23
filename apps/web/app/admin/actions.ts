"use server";

import { revalidatePath } from "next/cache";

import { requireAdminPage } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase";

export async function closeVoting(formData: FormData) {
  const admin = await requireAdminPage();
  if (!admin.configured || !admin.user) return;
  const weekId = String(formData.get("weekId") ?? "");
  const client = createAdminClient()!;
  const { error } = await client.rpc("admin_close_impact_voting", {
    p_admin_user_id: admin.user.id,
    p_week_id: weekId,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/impact");
}

export async function confirmRevenue(formData: FormData) {
  const admin = await requireAdminPage();
  if (!admin.configured || !admin.user) return;
  const weekId = String(formData.get("weekId") ?? "");
  const grossRevenueMinor = Math.round(Number(formData.get("grossRevenue")) * 100);
  if (!Number.isSafeInteger(grossRevenueMinor) || grossRevenueMinor < 0) throw new Error("Invalid revenue");
  const client = createAdminClient()!;
  const { error } = await client.rpc("admin_confirm_impact_revenue", {
    p_admin_user_id: admin.user.id,
    p_week_id: weekId,
    p_gross_revenue_minor: grossRevenueMinor,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/impact");
}

export async function recordDonation(formData: FormData) {
  const admin = await requireAdminPage();
  if (!admin.configured || !admin.user) return;
  const weekId = String(formData.get("weekId") ?? "");
  const charityId = String(formData.get("charityId") ?? "");
  const proofUrl = String(formData.get("proofUrl") ?? "");
  const amountMinor = Math.round(Number(formData.get("amount")) * 100);
  const client = createAdminClient()!;
  const { error } = await client.rpc("admin_record_impact_donation", {
    p_admin_user_id: admin.user.id,
    p_week_id: weekId,
    p_charity_id: charityId,
    p_amount_minor: amountMinor,
    p_proof_url: proofUrl,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/impact");
}

export async function openNextWeek() {
  const admin = await requireAdminPage();
  if (!admin.configured || !admin.user) return;
  const client = createAdminClient()!;
  const { data: active } = await client
    .from("impact_weeks")
    .select("id")
    .in("status", ["open", "voting_closed", "donation_pending"])
    .limit(1)
    .maybeSingle();
  if (active) throw new Error("Finish the active impact week first");

  const { data: latestWeek } = await client
    .from("impact_weeks")
    .select("week_end")
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  const now = new Date();
  const day = now.getUTCDay();
  const currentMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((day + 6) % 7)));
  const afterLatest = latestWeek?.week_end
    ? new Date(`${latestWeek.week_end}T00:00:00.000Z`).getTime() + 86_400_000
    : 0;
  const monday = new Date(Math.max(currentMonday.getTime(), afterLatest));
  const sunday = new Date(monday.getTime() + 6 * 86_400_000);
  const dateOnly = (date: Date) => date.toISOString().slice(0, 10);
  const [{ data: config }, { data: charities }] = await Promise.all([
    client.from("remote_config_versions").select("payload").eq("is_active", true).maybeSingle(),
    client.from("charities").select("id").eq("is_active", true).order("created_at").limit(3),
  ]);
  if (!charities || charities.length === 0) throw new Error("At least one active charity is required");
  const payload = config?.payload as Record<string, unknown> | undefined;
  const impactPercentage = Number(payload?.impactPercentage ?? 80);
  const platformPercentage = Number(payload?.platformPercentage ?? 20);
  const { data: weekId, error } = await client.rpc("admin_open_impact_week", {
    p_admin_user_id: admin.user.id,
    p_week_start: dateOnly(monday),
    p_week_end: dateOnly(sunday),
    p_impact_percentage: impactPercentage,
    p_platform_percentage: platformPercentage,
    p_charity_ids: charities.map((charity) => charity.id),
  });
  if (error) throw new Error(error.message);
  if (!weekId) throw new Error("Impact week was not created");
  revalidatePath("/admin");
  revalidatePath("/impact");
}

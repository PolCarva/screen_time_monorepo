import { impactWeekSchema } from "@screen-time/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { z } from "zod";

import { PrimaryButton } from "@/components/primary-button";
import { Screen } from "@/components/screen";
import { Body, Data, Display, Eyebrow, Heading, Mono } from "@/components/typography";
import { localize, t } from "@/i18n";
import { apiFetch } from "@/lib/api";
import { ensureAnonymousSession } from "@/lib/supabase";
import { colors, fonts, radius, spacing } from "@/theme/tokens";

const voteResponseSchema = z.object({
  weekId: z.string().uuid(),
  charityId: z.string().uuid(),
  updatedAt: z.string(),
});

export default function ImpactScreen() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["impact-current"],
    queryFn: () => apiFetch("/api/v1/impact/current", impactWeekSchema),
  });
  const week = query.data;

  useEffect(() => {
    const current = week?.candidates.find((candidate) => candidate.selectedByCurrentUser);
    if (current) setSelectedId(current.charity.id);
  }, [week]);

  const vote = useMutation({
    mutationFn: async () => {
      if (!week || !selectedId) throw new Error("project_required");
      const session = await ensureAnonymousSession();
      if (!session || session.user.is_anonymous) throw new Error("account_required");
      return apiFetch(`/api/v1/impact/${week.id}/vote`, voteResponseSchema, {
        method: "PUT",
        body: JSON.stringify({ charityId: selectedId }),
        headers: { "idempotency-key": Crypto.randomUUID() },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["impact-current"] });
      Alert.alert(localize("Vote saved", "Voto guardado"), localize("You can change it until the weekly close.", "Puedes cambiarlo hasta el cierre de la semana."));
    },
    onError: (error) => {
      const accountRequired = error instanceof Error && error.message === "account_required";
      Alert.alert(
        accountRequired ? localize("Link your account", "Vincula tu cuenta") : localize("Could not vote", "No se pudo votar"),
        accountRequired
          ? localize("Link Apple or Google in Settings to participate.", "Vincula Apple o Google desde Ajustes para participar.")
          : localize("Check your connection and try again.", "Revisa tu conexión e inténtalo otra vez."),
      );
    },
  });

  return (
    <Screen>
      <View style={styles.header}>
        <Eyebrow>{localize("PUBLIC RECORD / THIS WEEK", "REGISTRO PÚBLICO / ESTA SEMANA")}</Eyebrow>
        <Display>{localize("The fund\nleaves a trail.", "El fondo\ndeja rastro.")}</Display>
        <Body style={styles.lede}>
          {localize(
            "Estimated, reconciled, donated, and published are different states. Still shows each one.",
            "Estimado, conciliado, donado y publicado son estados distintos. Still muestra cada uno.",
          )}
        </Body>
      </View>

      <View style={styles.fund}>
        <View style={styles.fundHeader}>
          <View style={styles.fundDate}>
            <Eyebrow>{localize("RECORD", "REGISTRO")}</Eyebrow>
            <Mono>{week ? `${week.weekStart} / ${week.weekEnd}` : "—"}</Mono>
          </View>
          <Text style={[styles.badge, !week?.isEstimated && styles.badgeConfirmed]}>
            {week?.isEstimated ? t("estimated") : localize("Confirmed", "Confirmado")}
          </Text>
        </View>
        <Data style={styles.amount}>
          {week
            ? new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 0,
              }).format(week.impactFundMinor / 100)
            : "—"}
        </Data>
        <Body style={styles.muted}>
          {week?.impactPercentage ?? 80}% {localize("of recorded advertising revenue", "del ingreso publicitario registrado")}
        </Body>
        <View style={styles.fundMeta}>
          <View><Eyebrow>{localize("PARTICIPANTS", "PARTICIPANTES")}</Eyebrow><Mono>{week?.participants ?? 0}</Mono></View>
          <View><Eyebrow>{localize("ACTIONS", "ACCIONES")}</Eyebrow><Mono>{week?.rewardedAds ?? 0}</Mono></View>
        </View>
      </View>

      <View style={styles.candidateHeading}>
        <Eyebrow>{localize("VOTE / ACTIVE CAUSES", "VOTO / CAUSAS ACTIVAS")}</Eyebrow>
        <Mono>{week?.status === "open" ? localize("OPEN", "ABIERTO") : localize("CLOSED", "CERRADO")}</Mono>
      </View>
      {week?.candidates.map((candidate) => {
        const selected = selectedId === candidate.charity.id;
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            key={candidate.charity.id}
            onPress={() => setSelectedId(candidate.charity.id)}
            style={({ pressed }) => [styles.candidate, selected && styles.selected, pressed && styles.pressed]}
          >
            <View style={styles.candidateTop}>
              <View style={[styles.selection, selected && styles.selectionOn]}>
                <Mono style={styles.selectionLabel}>{selected ? "✓" : ""}</Mono>
              </View>
              <View style={styles.nameWrap}>
                <Heading style={styles.name}>{candidate.charity.name}</Heading>
                <Body style={styles.description}>{candidate.charity.shortDescription}</Body>
              </View>
              <Data style={styles.percent}>{candidate.percentage}%</Data>
            </View>
            <View style={styles.track}>
              <View style={[styles.progress, { width: `${candidate.percentage}%` }]} />
            </View>
            <Mono style={styles.category}>{candidate.charity.category.toUpperCase()}</Mono>
          </Pressable>
        );
      })}
      <PrimaryButton
        disabled={!week || week.status !== "open" || !selectedId || vote.isPending}
        onPress={() => vote.mutate()}
      >
        {vote.isPending ? localize("Saving…", "Guardando…") : t("voteNow")}
      </PrimaryButton>
      <Body style={styles.footnote}>
        {localize(
          "Link Apple or Google in Settings to vote and recover access. You can change your vote until the weekly close.",
          "Vincula Apple o Google en Ajustes para votar y recuperar acceso. Puedes cambiar el voto hasta el cierre semanal.",
        )}
      </Body>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.lg },
  lede: { color: colors.muted },
  fund: {
    paddingVertical: spacing.lg,
    gap: spacing.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.ink,
  },
  fundHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  fundDate: { gap: spacing.xs },
  badge: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1,
    backgroundColor: colors.record,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  badgeConfirmed: { backgroundColor: colors.impact },
  amount: { marginTop: spacing.lg, fontSize: 58, lineHeight: 60, letterSpacing: -3 },
  muted: { fontSize: 13, color: colors.muted },
  fundMeta: {
    paddingTop: spacing.lg,
    flexDirection: "row",
    gap: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
  },
  candidateHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  candidate: {
    minHeight: 174,
    paddingVertical: spacing.lg,
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
  },
  selected: { borderTopColor: colors.ink },
  pressed: { opacity: 0.72 },
  candidateTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  selection: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.ink,
    borderRadius: 4,
  },
  selectionOn: { backgroundColor: colors.impact },
  selectionLabel: { fontFamily: fonts.monoSemiBold },
  nameWrap: { flex: 1 },
  name: { fontSize: 19, lineHeight: 22 },
  description: { marginTop: spacing.xs, color: colors.muted, fontSize: 13, lineHeight: 19 },
  percent: { fontSize: 22, lineHeight: 24 },
  track: { height: 8, backgroundColor: colors.paperRaised },
  progress: { height: 8, backgroundColor: colors.impact },
  category: { color: colors.muted, fontSize: 10 },
  footnote: { fontSize: 12, lineHeight: 18, textAlign: "center", color: colors.muted },
});

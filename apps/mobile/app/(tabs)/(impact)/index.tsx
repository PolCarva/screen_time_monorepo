import { impactWeekSchema } from "@screen-time/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { z } from "zod";

import { PrimaryButton } from "@/components/primary-button";
import { Screen } from "@/components/screen";
import { Surface } from "@/components/surface";
import { Body, Display, Eyebrow } from "@/components/typography";
import { localize, t } from "@/i18n";
import { apiFetch } from "@/lib/api";
import { ensureAnonymousSession } from "@/lib/supabase";
import { colors, fonts, spacing } from "@/theme/tokens";

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
      <View>
        <Eyebrow>{localize("Digital wellbeing · real impact", "Bienestar digital · impacto real")}</Eyebrow>
        <Display>{t("impact")}</Display>
      </View>
      <Surface style={styles.fund}>
        <View style={styles.top}>
          <Eyebrow>{localize("Impact Fund", "Fondo de impacto")}</Eyebrow>
          <Text style={styles.badge}>{week?.isEstimated ? t("estimated") : localize("Confirmed", "Confirmado")}</Text>
        </View>
        <Text style={styles.amount}>
          {week
            ? new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 0,
              }).format(week.impactFundMinor / 100)
            : "—"}
        </Text>
        <Body style={styles.muted}>{week?.impactPercentage ?? 80}% {localize("of advertising revenue allocated", "del ingreso publicitario asignado")}</Body>
      </Surface>
      <Eyebrow>{localize("Active projects", "Proyectos activos")}</Eyebrow>
      {week?.candidates.map((candidate) => {
        const selected = selectedId === candidate.charity.id;
        return (
          <Pressable key={candidate.charity.id} onPress={() => setSelectedId(candidate.charity.id)}>
            <Surface style={[styles.candidate, selected && styles.selected]}>
              <View style={styles.top}>
                <View style={styles.titleWrap}>
                  <View style={styles.category}>
                    <Text>{selected ? "✓" : "⌁"}</Text>
                  </View>
                  <View style={styles.nameWrap}>
                    <Text style={styles.name}>{candidate.charity.name}</Text>
                    <Body style={styles.muted}>{candidate.charity.shortDescription}</Body>
                  </View>
                </View>
                <Text style={styles.percent}>{candidate.percentage}%</Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.progress, { width: `${candidate.percentage}%` }]} />
              </View>
            </Surface>
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
        {localize("To vote, link Apple or Google in Settings. You can change your vote until the weekly close.", "Para votar debes vincular Apple o Google en Ajustes. Puedes cambiar tu voto hasta el cierre semanal.")}
      </Body>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fund: { backgroundColor: "rgba(168,181,154,.18)" },
  top: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  badge: {
    fontFamily: fonts.sansBold,
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1,
    backgroundColor: colors.white,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 99,
  },
  amount: { fontFamily: fonts.display, fontSize: 58, color: colors.forest },
  muted: { fontSize: 11, color: colors.muted },
  candidate: { gap: spacing.md },
  selected: { borderColor: colors.sage, borderWidth: 2 },
  titleWrap: { flexDirection: "row", gap: 12, flex: 1 },
  nameWrap: { flex: 1 },
  category: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.stone,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink },
  percent: { fontFamily: fonts.sansBold, fontSize: 13 },
  track: { height: 5, backgroundColor: colors.stone, borderRadius: 99 },
  progress: { height: 5, backgroundColor: colors.sage, borderRadius: 99 },
  footnote: { fontSize: 11, textAlign: "center", color: colors.muted },
});

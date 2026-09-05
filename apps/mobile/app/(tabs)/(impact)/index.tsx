import { impactWeekSchema } from "@screen-time/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { z } from "zod";

import { AttentionField } from "@/components/attention-field";
import { FieldApertureMark } from "@/components/field-aperture-mark";
import { PrimaryButton } from "@/components/primary-button";
import { Screen } from "@/components/screen";
import { Body, Data, Eyebrow, Heading, Mono } from "@/components/typography";
import { localize, t } from "@/i18n";
import { ApiError, apiFetch } from "@/lib/api";
import { getLinkedIdentityProviders } from "@/lib/identity";
import { isMissingImpactWeekError } from "@/lib/impact-errors";
import { ensureAnonymousSession } from "@/lib/supabase";
import { useAppState } from "@/state/app-state";
import { colors, fonts, radius, spacing } from "@/theme/tokens";

const voteResponseSchema = z.object({
  weekId: z.string().uuid(),
  charityId: z.string().uuid(),
  updatedAt: z.string(),
});

function StateNotice({
  title,
  body,
  action,
  onPress,
}: {
  title: string;
  body: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.stateNotice}>
      <Heading style={styles.stateTitle}>{title}</Heading>
      <Body style={styles.muted}>{body}</Body>
      {action && onPress ? (
        <PrimaryButton variant="secondary" onPress={onPress}>
          {action}
        </PrimaryButton>
      ) : null}
    </View>
  );
}

export default function ImpactScreen() {
  const queryClient = useQueryClient();
  const { config } = useAppState();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const query = useQuery({
    queryKey: ["impact-current"],
    queryFn: () => apiFetch("/api/v1/impact/current", impactWeekSchema),
  });
  const week = query.data;
  const savedVote = week?.candidates.find(
    (candidate) => candidate.selectedByCurrentUser,
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void getLinkedIdentityProviders()
        .then((providers) => {
          if (active) setGoogleConnected(providers.includes("google"));
        })
        .catch(() => {
          if (active) setGoogleConnected(false);
        });
      return () => {
        active = false;
      };
    }, []),
  );

  useEffect(() => {
    const current = week?.candidates.find(
      (candidate) => candidate.selectedByCurrentUser,
    );
    if (current) setSelectedId(current.charity.id);
  }, [week]);

  const vote = useMutation({
    mutationFn: async () => {
      if (!week || !selectedId) throw new Error("project_required");
      const session = await ensureAnonymousSession();
      if (!session || session.user.is_anonymous)
        throw new Error("account_required");
      return apiFetch(`/api/v1/impact/${week.id}/vote`, voteResponseSchema, {
        method: "PUT",
        body: JSON.stringify({ charityId: selectedId }),
        headers: { "idempotency-key": Crypto.randomUUID() },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["impact-current"] });
      Alert.alert(
        localize("Vote saved", "Voto guardado"),
        localize(
          "You can change it until the weekly close.",
          "Puedes cambiarlo hasta el cierre semanal.",
        ),
      );
    },
    onError: (error) => {
      if (__DEV__) console.warn("Impact vote failed", error);
      const accountRequired =
        (error instanceof ApiError && error.code === "account_required") ||
        (error instanceof Error && error.message === "account_required");
      Alert.alert(
        accountRequired
          ? localize("Link your account", "Vincula tu cuenta")
          : localize("Could not vote", "No se pudo votar"),
        accountRequired
          ? localize(
              "Link Google in Settings to participate.",
              "Vincula Google desde Ajustes para participar.",
            )
          : localize(
              "Check your connection and try again.",
              "Revisa tu conexión e inténtalo otra vez.",
            ),
      );
    },
  });

  const amount = week
    ? new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: week.currency,
        maximumFractionDigits: 0,
      }).format(week.impactFundMinor / 100)
    : "—";
  const stage = week?.isEstimated
    ? localize("ESTIMATED", "ESTIMADO")
    : localize("RECONCILED", "CONCILIADO");
  const noPublishedWeek = isMissingImpactWeekError(query.error);
  const votingOpen = week?.status === "open" && config.votingEnabled;

  async function openExternal(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        localize("Could not open the link", "No se pudo abrir el enlace"),
        localize(
          "Copy it from the public Impact page or try again later.",
          "Cópialo desde la página pública de Impacto o inténtalo más tarde.",
        ),
      );
    }
  }

  return (
    <Screen contentContainerStyle={styles.screen}>
      <View style={styles.topline}>
        <FieldApertureMark size={34} />
        <Eyebrow>
          {localize("IMPACT / WEEKLY RECORD", "IMPACTO / REGISTRO SEMANAL")}
        </Eyebrow>
      </View>

      {query.isLoading ? (
        <StateNotice
          title={localize(
            "Loading this week’s record",
            "Cargando el registro semanal",
          )}
          body={localize(
            "Amounts and states come from the public ledger.",
            "Los montos y estados provienen del registro público.",
          )}
        />
      ) : noPublishedWeek ? (
        <StateNotice
          title={localize(
            "No weekly record yet",
            "Todavía no hay registro semanal",
          )}
          body={localize(
            "The first real record will appear after operations opens a week.",
            "El primer registro real aparecerá cuando operaciones abra una semana.",
          )}
          action={localize("Try again", "Reintentar")}
          onPress={() => void query.refetch()}
        />
      ) : query.isError ? (
        <StateNotice
          title={localize(
            "The record is unavailable",
            "El registro no está disponible",
          )}
          body={localize(
            "Nothing was inferred or replaced with demo data.",
            "No se infirió ni reemplazó nada con datos de demostración.",
          )}
          action={localize("Try again", "Reintentar")}
          onPress={() => void query.refetch()}
        />
      ) : week ? (
        <>
          <View style={styles.fund}>
            <View style={styles.fundHeader}>
              <View style={styles.fundDate}>
                <Eyebrow>
                  {localize("AVAILABLE FUND", "FONDO DISPONIBLE")}
                </Eyebrow>
                <Mono>
                  {week.weekStart} / {week.weekEnd}
                </Mono>
              </View>
              <View
                style={[
                  styles.badge,
                  !week.isEstimated && styles.badgeConfirmed,
                ]}
              >
                <Text style={styles.badgeText}>{stage}</Text>
              </View>
            </View>
            <Data style={styles.amount}>{amount}</Data>
            <Body style={styles.muted}>
              {week.impactPercentage}%{" "}
              {localize(
                "of recorded advertising revenue",
                "del ingreso publicitario registrado",
              )}
            </Body>
            <AttentionField
              mode="impact"
              values={week.candidates.map((candidate) => candidate.percentage)}
              accessibilityLabel={localize(
                `Impact allocation field for ${amount}.`,
                `Campo de asignación de impacto por ${amount}.`,
              )}
            />
            <View style={styles.fundMeta}>
              <View>
                <Eyebrow>{localize("PARTICIPANTS", "PARTICIPANTES")}</Eyebrow>
                <Mono>{week.participants}</Mono>
              </View>
              <View>
                <Eyebrow>
                  {localize("VERIFIED ACTIONS", "ACCIONES VERIFICADAS")}
                </Eyebrow>
                <Mono>{week.rewardedAds}</Mono>
              </View>
              <View>
                <Eyebrow>{localize("STATUS", "ESTADO")}</Eyebrow>
                <Mono>{week.status.replaceAll("_", " ").toUpperCase()}</Mono>
              </View>
            </View>
            {week.donationProofUrl ? (
              <Pressable
                accessibilityRole="link"
                onPress={() => void openExternal(week.donationProofUrl!)}
                style={({ pressed }) => [
                  styles.proof,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.actionLabel}>
                  {localize(
                    "Open published proof",
                    "Abrir comprobante publicado",
                  )}
                </Text>
                <Text style={styles.arrow}>↗</Text>
              </Pressable>
            ) : (
              <Body style={styles.pendingProof}>
                {localize(
                  "Proof is published after donation. This amount is not yet presented as donated.",
                  "El comprobante se publica después de la donación. Este monto todavía no se presenta como donado.",
                )}
              </Body>
            )}
          </View>

          <View style={styles.candidateHeading}>
            <Eyebrow>
              {localize("ALLOCATION / OPEN VOTE", "ASIGNACIÓN / VOTO ABIERTO")}
            </Eyebrow>
            <Mono>
              {votingOpen
                ? localize("OPEN", "ABIERTO")
                : config.votingEnabled
                  ? localize("CLOSED", "CERRADO")
                  : localize("PAUSED", "EN PAUSA")}
            </Mono>
          </View>

          {week.candidates.length === 0 ? (
            <StateNotice
              title={localize(
                "No projects published yet",
                "Aún no hay proyectos publicados",
              )}
              body={localize(
                "Still will not invent a placeholder cause.",
                "Still no inventará una causa de relleno.",
              )}
            />
          ) : (
            week.candidates.map((candidate) => {
              const selected = selectedId === candidate.charity.id;
              const filled = Math.round(candidate.percentage / 10);
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{
                    checked: selected,
                    disabled: !votingOpen,
                  }}
                  disabled={!votingOpen}
                  key={candidate.charity.id}
                  onPress={() => setSelectedId(candidate.charity.id)}
                  style={({ pressed }) => [
                    styles.candidate,
                    selected && styles.selected,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.candidateTop}>
                    <View
                      style={[styles.selection, selected && styles.selectionOn]}
                    >
                      <Mono style={styles.selectionLabel}>
                        {selected ? "✓" : ""}
                      </Mono>
                    </View>
                    <View style={styles.nameWrap}>
                      <Heading style={styles.name}>
                        {candidate.charity.name}
                      </Heading>
                      <Body style={styles.description}>
                        {candidate.charity.shortDescription}
                      </Body>
                    </View>
                    <Data style={styles.percent}>{candidate.percentage}%</Data>
                  </View>
                  <View accessible={false} style={styles.voteField}>
                    {Array.from({ length: 10 }).map((_, index) => (
                      <View
                        key={index}
                        style={[
                          styles.voteModule,
                          index < filled && styles.voteModuleOn,
                          selected &&
                            index < filled &&
                            styles.voteModuleSelected,
                        ]}
                      />
                    ))}
                  </View>
                  <View style={styles.candidateMeta}>
                    <Mono>
                      {candidate.charity.category.toUpperCase()} /{" "}
                      {candidate.charity.country.toUpperCase()}
                    </Mono>
                    <Pressable
                      accessibilityRole="link"
                      hitSlop={12}
                      onPress={() =>
                        void openExternal(candidate.charity.website)
                      }
                    >
                      <Text style={styles.website}>↗</Text>
                    </Pressable>
                  </View>
                </Pressable>
              );
            })
          )}

          <PrimaryButton
            disabled={!votingOpen || !selectedId || vote.isPending}
            onPress={() => vote.mutate()}
          >
            {vote.isPending
              ? localize("Saving…", "Guardando…")
              : !config.votingEnabled
                ? localize("Voting paused", "Votación en pausa")
                : t("voteNow")}
          </PrimaryButton>
          <Body style={styles.footnote}>
            {savedVote
              ? localize(
                  `Your vote for ${savedVote.charity.name} is saved. You can change it until the weekly close.`,
                  `Tu voto por ${savedVote.charity.name} está guardado. Puedes cambiarlo hasta el cierre semanal.`,
                )
              : googleConnected
                ? localize(
                    "Google is connected. Choose an organization and tap Vote now.",
                    "Google está conectado. Elige una organización y toca Votar ahora.",
                  )
                : localize(
                    "Link Google in Settings to vote. Your choice can change until the weekly close.",
                    "Vincula Google en Ajustes para votar. Puedes cambiar tu elección hasta el cierre semanal.",
                  )}
          </Body>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: 0 },
  topline: {
    minHeight: 58,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stateNotice: {
    minHeight: 260,
    paddingVertical: spacing.xxl,
    gap: spacing.lg,
    justifyContent: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
  },
  stateTitle: { fontSize: 25, lineHeight: 28 },
  muted: { color: colors.graphiteSoft, fontSize: 13, lineHeight: 20 },
  fund: {
    paddingVertical: spacing.xl,
    gap: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
  },
  fundHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  fundDate: { gap: spacing.xs },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.sm,
  },
  badgeConfirmed: { borderColor: colors.success },
  badgeText: {
    color: colors.graphite,
    fontFamily: fonts.brandSemiBold,
    fontSize: 9,
    letterSpacing: 1,
  },
  amount: {
    marginTop: spacing.sm,
    fontSize: 68,
    lineHeight: 68,
    letterSpacing: -3.5,
  },
  fundMeta: {
    paddingTop: spacing.md,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
  },
  proof: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
  },
  actionLabel: {
    color: colors.graphite,
    fontFamily: fonts.brandSemiBold,
    fontSize: 14,
  },
  arrow: {
    color: colors.graphite,
    fontFamily: fonts.brandMedium,
    fontSize: 20,
  },
  pendingProof: {
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
    color: colors.warning,
    fontSize: 12,
    lineHeight: 18,
  },
  candidateHeading: {
    minHeight: 84,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  candidate: {
    minHeight: 178,
    paddingVertical: spacing.lg,
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
  },
  selected: { borderTopColor: colors.graphite },
  pressed: { opacity: 0.62 },
  candidateTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  selection: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.graphite,
    borderRadius: radius.sm,
  },
  selectionOn: { backgroundColor: colors.graphite },
  selectionLabel: { color: colors.chalk },
  nameWrap: { flex: 1 },
  name: { fontSize: 19, lineHeight: 22 },
  description: {
    marginTop: spacing.xs,
    color: colors.graphiteSoft,
    fontSize: 13,
    lineHeight: 19,
  },
  percent: { fontSize: 21, lineHeight: 24 },
  voteField: { flexDirection: "row", gap: spacing.xs },
  voteModule: {
    flex: 1,
    height: 9,
    borderRadius: radius.xs,
    backgroundColor: colors.fog,
  },
  voteModuleOn: { backgroundColor: colors.mineral },
  voteModuleSelected: { backgroundColor: colors.peach },
  candidateMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  website: {
    color: colors.graphite,
    fontFamily: fonts.brandSemiBold,
    fontSize: 19,
  },
  footnote: {
    paddingVertical: spacing.lg,
    color: colors.graphiteSoft,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
});

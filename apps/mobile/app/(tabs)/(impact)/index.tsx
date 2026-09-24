import {
  impactAmountFractionDigits,
  impactWeekSchema,
  returnedTimeParts,
  type ImpactWeek,
} from "@screen-time/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { z } from "zod";

import { AttentionField } from "@/components/attention-field";
import { FieldApertureMark } from "@/components/field-aperture-mark";
import { IdentityButtons } from "@/components/identity-buttons";
import {
  AnimatedNumber,
  CheckFill,
  GrowIn,
  PressableScale,
  Reveal,
} from "@/components/motion";
import { PrimaryButton } from "@/components/primary-button";
import { Screen } from "@/components/screen";
import {
  closeAction,
  notNowAction,
  retryAction,
  useStillSheet,
} from "@/components/still-sheet";
import { Body, Eyebrow, Heading, Mono } from "@/components/typography";
import { localize, t } from "@/i18n";
import { ApiError, apiFetch } from "@/lib/api";
import { openExternalBrowser } from "@/lib/external-browser";
import {
  getLinkedIdentityProviders,
  identityProviderName,
  identityProviders,
  linkIdentity,
  type IdentityProvider,
} from "@/lib/identity";
import { isMissingImpactWeekError } from "@/lib/impact-errors";
import { ensureAnonymousSession } from "@/lib/supabase";
import { useAppState } from "@/state/app-state";
import { colors, fonts, radius, spacing } from "@/theme/tokens";

const voteResponseSchema = z.object({
  weekId: z.string().uuid(),
  charityId: z.string().uuid(),
  updatedAt: z.string(),
});

const WEEK_STATUS_LABELS: Record<ImpactWeek["status"], [string, string]> = {
  draft: ["BEING PREPARED", "EN PREPARACIÓN"],
  open: ["VOTING OPEN", "VOTACIÓN ABIERTA"],
  voting_closed: ["VOTING CLOSED", "VOTACIÓN CERRADA"],
  donation_pending: ["DONATION IN PROGRESS", "DONACIÓN EN CURSO"],
  donated: ["DONATED", "DONADO"],
};

function weekRange(start: string, end: string) {
  // ISO dates are calendar days, not instants: read them at local noon.
  const format = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
  });
  return `${format.format(new Date(`${start}T12:00:00`))} – ${format.format(new Date(`${end}T12:00:00`))}`;
}

const count = new Intl.NumberFormat(undefined);
const decimal = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

/** "45 min" or "3,4 h", from the minutes the server estimated. */
function returnedTime(minutes: number) {
  const { value, unit } = returnedTimeParts(minutes);
  return `${decimal.format(value)} ${unit}`;
}

function people(value: number) {
  return localize(
    `${count.format(value)} ${value === 1 ? "person" : "people"}`,
    `${count.format(value)} ${value === 1 ? "persona" : "personas"}`,
  );
}

function StateNotice({
  title,
  body,
  action,
  onPress,
}: {
  title: string;
  body?: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.stateNotice}>
      <Heading style={styles.stateTitle}>{title}</Heading>
      {body ? <Body style={styles.muted}>{body}</Body> : null}
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
  const sheet = useStillSheet();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [linkedIdentities, setLinkedIdentities] = useState<IdentityProvider[]>(
    [],
  );
  const [identityBusy, setIdentityBusy] = useState<IdentityProvider | null>(
    null,
  );
  const accountConnected = linkedIdentities.length > 0;
  const offersApple = identityProviders().includes("apple");
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
          if (active) setLinkedIdentities(providers);
        })
        .catch(() => {
          if (active) setLinkedIdentities([]);
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
      sheet.toast({
        message: localize(
          "Vote saved. You can change it until the week closes.",
          "Voto guardado. Puedes cambiarlo hasta el cierre de la semana.",
        ),
      });
    },
    onError: (error) => {
      if (__DEV__) console.warn("Impact vote failed", error);
      const accountRequired =
        (error instanceof ApiError && error.code === "account_required") ||
        (error instanceof Error && error.message === "account_required");
      if (accountRequired) {
        void sheet.show({
          title: offersApple
            ? localize("Connect an account to vote", "Conecta una cuenta para votar")
            : localize("Connect Google to vote", "Conecta Google para votar"),
          message: localize(
            "Your vote is saved as soon as you connect, and you can change it until the week closes.",
            "Tu voto se guarda apenas conectes, y puedes cambiarlo hasta el cierre de la semana.",
          ),
          actions: [
            ...identityProviders().map((provider, index) => ({
              label: localize(
                `Continue with ${identityProviderName(provider)}`,
                `Continuar con ${identityProviderName(provider)}`,
              ),
              variant: index === 0 ? ("signal" as const) : ("secondary" as const),
              onPress: () => connectAndVote(provider),
            })),
            notNowAction(),
          ],
        });
        return;
      }
      void sheet.show({
        title: localize("Your vote wasn't saved", "No se guardó tu voto"),
        message: localize("Check your connection.", "Revisa tu conexión."),
        actions: [retryAction(() => submitVote.current()), closeAction()],
      });
    },
  });
  // The sheets act after they close; a ref keeps them on the latest mutation.
  const submitVote = useRef(() => vote.mutate());
  submitVote.current = () => vote.mutate();

  async function connectAndVote(
    provider: IdentityProvider,
    { vote = true }: { vote?: boolean } = {},
  ) {
    setIdentityBusy(provider);
    try {
      const linked = await linkIdentity(provider);
      const providers = await getLinkedIdentityProviders();
      setLinkedIdentities(providers);
      const connected = linked || providers.length > 0;
      if (connected && vote) submitVote.current();
    } catch (error) {
      if (__DEV__) console.warn(`${provider} identity link failed`, error);
      const name = identityProviderName(provider);
      void sheet.show({
        title: localize(`${name} didn't connect`, `No se conectó ${name}`),
        message: localize(
          "Check your connection and try again.",
          "Revisa tu conexión y vuelve a intentarlo.",
        ),
        actions: [
          retryAction(() => connectAndVote(provider, { vote })),
          closeAction(),
        ],
      });
    } finally {
      setIdentityBusy(null);
    }
  }

  // Cents while the fund is small, so a young fund never reads as zero.
  const fractionDigits = week ? impactAmountFractionDigits(week.impactFundMinor) : 0;
  const currencyFormat = useMemo(
    () =>
      week
        ? new Intl.NumberFormat(undefined, {
            style: "currency",
            currency: week.currency,
            minimumFractionDigits: fractionDigits,
            maximumFractionDigits: fractionDigits,
          })
        : null,
    [fractionDigits, week],
  );
  const formatAmount = (value: number) => currencyFormat?.format(value) ?? "—";
  const amount = week ? formatAmount(week.impactFundMinor / 100) : "—";
  const stage = week?.isEstimated
    ? localize("ESTIMATED", "ESTIMADO")
    : localize("CONFIRMED", "CONFIRMADO");
  const noPublishedWeek = isMissingImpactWeekError(query.error);
  const votingOpen = week?.status === "open" && config.votingEnabled;

  async function openExternal(url: string) {
    try {
      await openExternalBrowser(url);
    } catch {
      void sheet.show({
        title: localize("The link didn't open", "No se abrió el enlace"),
        message: localize(
          "Try again in a moment.",
          "Vuelve a intentarlo en un momento.",
        ),
        actions: [retryAction(() => openExternal(url)), closeAction()],
      });
    }
  }

  return (
    <Screen contentContainerStyle={styles.screen}>
      <View style={styles.topline}>
        <FieldApertureMark size={34} />
        <Eyebrow>{localize("IMPACT", "IMPACTO")}</Eyebrow>
      </View>

      {query.isLoading ? (
        <StateNotice
          title={localize(
            "Loading this week's fund…",
            "Cargando el fondo de esta semana…",
          )}
        />
      ) : noPublishedWeek ? (
        <StateNotice
          title={localize(
            "This week's fund will appear here",
            "El fondo de esta semana aparecerá aquí",
          )}
          action={localize("Try again", "Reintentar")}
          onPress={() => void query.refetch()}
        />
      ) : query.isError ? (
        <StateNotice
          title={localize("The fund didn't load", "El fondo no cargó")}
          action={localize("Try again", "Reintentar")}
          onPress={() => void query.refetch()}
        />
      ) : week ? (
        <>
          <View style={styles.fund}>
            <View style={styles.fundHeader}>
              <View style={styles.fundDate}>
                <Eyebrow>
                  {localize("THIS WEEK'S FUND", "FONDO DE LA SEMANA")}
                </Eyebrow>
                <Mono>{weekRange(week.weekStart, week.weekEnd)}</Mono>
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
            <AnimatedNumber
              format={formatAmount}
              style={styles.amount}
              value={week.impactFundMinor / 100}
            />
            <Body style={styles.muted}>
              {week.impactPercentage}%{" "}
              {localize(
                "of this week's ad revenue",
                "del ingreso por anuncios de la semana",
              )}
              {week.isEstimated
                ? localize(
                    ". It grows with every ad watched, and AdMob confirms it the next day.",
                    ". Crece con cada anuncio visto y AdMob lo confirma al día siguiente.",
                  )
                : ""}
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
                <Eyebrow>{localize("ADS WATCHED", "ANUNCIOS VISTOS")}</Eyebrow>
                <Mono>{count.format(week.rewardedAds)}</Mono>
              </View>
              <View>
                <Eyebrow>
                  {localize("PEOPLE WHO CHIPPED IN", "PERSONAS QUE APORTARON")}
                </Eyebrow>
                <Mono>{count.format(week.participants)}</Mono>
              </View>
              <View>
                <Eyebrow>{localize("STATUS", "ESTADO")}</Eyebrow>
                <Mono>
                  {localize(
                    WEEK_STATUS_LABELS[week.status][0],
                    WEEK_STATUS_LABELS[week.status][1],
                  )}
                </Mono>
              </View>
            </View>
            {week.donationProofUrl ? (
              <PressableScale
                accessibilityRole="link"
                dimTo={0.62}
                onPress={() => void openExternal(week.donationProofUrl!)}
                scaleTo={1}
                style={styles.proof}
              >
                <Text style={styles.actionLabel}>
                  {localize("See the receipt", "Ver comprobante")}
                </Text>
                <Text style={styles.arrow}>↗</Text>
              </PressableScale>
            ) : (
              <Body style={styles.pendingProof}>
                {localize(
                  "Once the donation is made, you'll see the receipt here.",
                  "Cuando se haga la donación, verás aquí el comprobante.",
                )}
              </Body>
            )}
          </View>

          <View style={styles.returned}>
            <Eyebrow>{localize("TIME GIVEN BACK", "TIEMPO RECUPERADO")}</Eyebrow>
            <AnimatedNumber
              // Whole minutes while it counts, so it never reads "12,3 min".
              format={(minutes) => returnedTime(Math.round(minutes))}
              style={styles.returnedAmount}
              value={week.minutesReturned}
            />
            <Body>
              {week.people > 0
                ? localize(
                    `${people(week.people)} got it back this week with Still.`,
                    `${people(week.people)} lo ${week.people === 1 ? "recuperó" : "recuperaron"} esta semana con Still.`,
                  )
                : localize(
                    "This week's time appears here once Still pauses an app.",
                    "El tiempo de esta semana aparece aquí cuando Still pausa una app.",
                  )}
            </Body>
            <Body style={styles.muted}>
              {localize(
                `Since the start: ${returnedTime(week.allTime.minutesReturned)} for ${people(week.allTime.people)}, and ${count.format(week.allTime.rewardedAds)} ads watched.`,
                `Desde el inicio: ${returnedTime(week.allTime.minutesReturned)} para ${people(week.allTime.people)}, y ${count.format(week.allTime.rewardedAds)} anuncios vistos.`,
              )}
            </Body>
            <Body style={styles.footnoteLeft}>
              {localize(
                `Estimated at ${config.estimatedMinutesPerAvoidedOpen} min for each time someone chose not to go in.`,
                `Estimado en ${config.estimatedMinutesPerAvoidedOpen} min por cada vez que alguien decidió no entrar.`,
              )}
            </Body>
          </View>

          <View style={styles.candidateHeading}>
            <Eyebrow>{localize("PROJECTS · VOTE", "PROYECTOS · VOTACIÓN")}</Eyebrow>
            <Mono>
              {votingOpen
                ? localize("OPEN", "ABIERTA")
                : config.votingEnabled
                  ? localize("CLOSED", "CERRADA")
                  : localize("PAUSED", "EN PAUSA")}
            </Mono>
          </View>

          {week.candidates.length === 0 ? (
            <StateNotice
              title={localize(
                "This week's projects will appear here",
                "Los proyectos de esta semana aparecerán aquí",
              )}
            />
          ) : (
            week.candidates.map((candidate, candidateIndex) => {
              const selected = selectedId === candidate.charity.id;
              const filled = Math.round(candidate.percentage / 10);
              return (
                <Reveal
                  delay={160}
                  index={candidateIndex}
                  key={candidate.charity.id}
                >
                  <PressableScale
                    accessibilityLabel={`${candidate.charity.name}, ${candidate.percentage}%`}
                    accessibilityRole="radio"
                    accessibilityState={{
                      checked: selected,
                      disabled: !votingOpen,
                    }}
                    dimTo={0.62}
                    disabled={!votingOpen}
                    onPress={() => setSelectedId(candidate.charity.id)}
                    scaleTo={0.99}
                    style={[styles.candidate, selected && styles.selected]}
                  >
                    <View style={styles.candidateTop}>
                      <View style={styles.selection}>
                        <CheckFill checked={selected} color={colors.graphite}>
                          <Mono style={styles.selectionLabel}>✓</Mono>
                        </CheckFill>
                      </View>
                      <View style={styles.nameWrap}>
                        <Heading style={styles.name}>
                          {candidate.charity.name}
                        </Heading>
                        <Body style={styles.description}>
                          {candidate.charity.shortDescription}
                        </Body>
                      </View>
                      <AnimatedNumber
                        format={(value) => `${Math.round(value)}%`}
                        style={styles.percent}
                        value={candidate.percentage}
                      />
                    </View>
                    <GrowIn
                      axis="x"
                      delay={260 + candidateIndex * 55}
                      style={styles.voteField}
                    >
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
                    </GrowIn>
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
                  </PressableScale>
                </Reveal>
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
          {!savedVote && !accountConnected && votingOpen ? (
            <IdentityButtons
              busy={identityBusy}
              linked={linkedIdentities}
              onLink={(provider) =>
                void connectAndVote(provider, { vote: Boolean(selectedId) })
              }
              style={styles.identityButtons}
            />
          ) : null}
          <Body style={styles.footnote}>
            {savedVote
              ? localize(
                  `Your vote for ${savedVote.charity.name} is saved. You can change it until the week closes.`,
                  `Tu voto por ${savedVote.charity.name} está guardado. Puedes cambiarlo hasta el cierre de la semana.`,
                )
              : accountConnected
                ? localize(
                    "Choose a project and tap Vote now.",
                    "Elige un proyecto y toca Votar ahora.",
                  )
                : offersApple
                  ? localize(
                      "To vote, connect Apple or Google. You can change your vote until the week closes.",
                      "Para votar, conecta Apple o Google. Puedes cambiar tu voto hasta el cierre de la semana.",
                    )
                  : localize(
                      "To vote, connect Google. You can change your vote until the week closes.",
                      "Para votar, conecta Google. Puedes cambiar tu voto hasta el cierre de la semana.",
                    )}
          </Body>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: 0 },
  identityButtons: { marginTop: spacing.sm },
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
  returned: {
    paddingVertical: spacing.xl,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
  },
  returnedAmount: {
    fontSize: 44,
    lineHeight: 46,
    letterSpacing: -1.8,
  },
  footnoteLeft: {
    color: colors.graphiteSoft,
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
  candidateTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  selection: {
    width: 28,
    height: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.graphite,
    borderRadius: radius.sm,
  },
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

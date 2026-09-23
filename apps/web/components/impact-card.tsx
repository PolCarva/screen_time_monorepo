import {
  type ImpactWeek,
  impactAmountFractionDigits,
  returnedTimeParts,
} from "@screen-time/contracts";
import { AttentionField } from "@/components/attention-field";
import type { ImpactWeekResult } from "@/lib/impact";

/** Cents while the fund is small, so a young fund never reads as zero. */
export function formatFund(minor: number, currency = "USD"): string {
  const digits = impactAmountFractionDigits(minor);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(minor / 100);
}

const count = new Intl.NumberFormat("es");
const decimal = new Intl.NumberFormat("es", { maximumFractionDigits: 1 });

export function formatReturnedTime(minutes: number): string {
  const { value, unit } = returnedTimeParts(minutes);
  return `${decimal.format(value)} ${unit}`;
}
const statusLabels: Record<ImpactWeek["status"], string> = {
  draft: "En preparación",
  open: "Votación abierta",
  voting_closed: "Votación cerrada",
  donation_pending: "Donación pendiente",
  donated: "Comprobante publicado",
};

export function ImpactCard({
  week,
  compact = false,
}: {
  week: ImpactWeek;
  compact?: boolean;
}) {
  const amount = formatFund(week.impactFundMinor, week.currency);
  return (
    <article
      className={`impact-ledger${compact ? " impact-ledger--compact" : ""}`}
    >
      <header className="impact-ledger__header">
        <div>
          <span className="mono-label">REGISTRO / {week.weekStart}</span>
          <span className="impact-ledger__date">hasta {week.weekEnd}</span>
        </div>
        <div className="impact-ledger__statuses">
          <span className={`status status--${week.status}`}>
            {statusLabels[week.status]}
          </span>
          <span
            className={`status ${week.isEstimated ? "status--estimated" : "status--confirmed"}`}
          >
            {week.isEstimated ? "Estimado" : "Conciliado"}
          </span>
        </div>
      </header>
      <div className="impact-ledger__amount">
        <p>{amount}</p>
        <span>
          {week.impactPercentage}% del ingreso publicitario de la semana
          {week.isEstimated && week.estimatedRevenueMinor > 0
            ? ". Incluye lo estimado por cada anuncio que AdMob todavía no informó."
            : ""}
        </span>
      </div>
      <AttentionField
        kind="impact"
        values={week.candidates.map((candidate) => candidate.percentage)}
        label={`Campo de asignación del fondo por ${amount}`}
      />
      <div
        className="candidate-ledger"
        role="list"
        aria-label="Distribución de votos por proyecto"
      >
        {week.candidates.map((candidate, index) => (
          <div
            className="candidate-ledger__row"
            key={candidate.charity.id}
            role="listitem"
          >
            <span className="candidate-ledger__index" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="candidate-ledger__cause">
              <strong>{candidate.charity.name}</strong>
              <span>
                {candidate.charity.category} · {candidate.charity.country}
              </span>
            </div>
            <b>{candidate.percentage}%</b>
          </div>
        ))}
      </div>
      <dl className="impact-ledger__meta">
        <div>
          <dt>Anuncios vistos</dt>
          <dd>{count.format(week.rewardedAds)}</dd>
        </div>
        <div>
          <dt>Personas que aportaron</dt>
          <dd>{count.format(week.participants)}</dd>
        </div>
        <div>
          <dt>Tiempo recuperado</dt>
          <dd>
            {formatReturnedTime(week.minutesReturned)}
            {week.people > 0
              ? ` · ${count.format(week.people)} ${week.people === 1 ? "persona" : "personas"}`
              : ""}
          </dd>
        </div>
        <div>
          <dt>Estado del monto</dt>
          <dd>{week.isEstimated ? "Estimado" : "Conciliado"}</dd>
        </div>
      </dl>
      <p className="impact-ledger__all-time">
        Desde el inicio: {count.format(week.allTime.people)}{" "}
        {week.allTime.people === 1 ? "persona" : "personas"} recuperaron{" "}
        {formatReturnedTime(week.allTime.minutesReturned)} ·{" "}
        {count.format(week.allTime.rewardedAds)}{" "}
        {week.allTime.rewardedAds === 1 ? "anuncio visto" : "anuncios vistos"}
        {week.allTime.donatedMinor > 0
          ? ` · ${formatFund(week.allTime.donatedMinor)} donados`
          : ""}
        .
      </p>
    </article>
  );
}

const unavailableCopy: Record<
  Exclude<ImpactWeekResult["state"], "ready">,
  { label: string; title: string; body: string }
> = {
  unconfigured: {
    label: "REGISTRO / SIN CONFIGURAR",
    title: "Impacto aún no disponible",
    body: "El servicio de impacto todavía no está conectado. No mostramos cifras de ejemplo como si fueran reales.",
  },
  empty: {
    label: "REGISTRO / SIN SEMANAS",
    title: "Todavía no hay una semana publicada",
    body: "El primer registro aparecerá aquí cuando operaciones abra una semana de impacto.",
  },
  error: {
    label: "REGISTRO / NO DISPONIBLE",
    title: "No pudimos cargar el registro",
    body: "Los datos reales no están disponibles temporalmente. Inténtalo de nuevo más tarde.",
  },
};

export function ImpactUnavailable({
  state,
  compact = false,
}: {
  state: Exclude<ImpactWeekResult["state"], "ready">;
  compact?: boolean;
}) {
  const copy = unavailableCopy[state];
  return (
    <article
      className={`impact-ledger${compact ? " impact-ledger--compact" : ""}`}
    >
      <header className="impact-ledger__header">
        <span className="mono-label">{copy.label}</span>
      </header>
      <div className="impact-ledger__amount">
        <p aria-hidden="true">—</p>
        <span>{copy.title}</span>
      </div>
      <p>{copy.body}</p>
    </article>
  );
}

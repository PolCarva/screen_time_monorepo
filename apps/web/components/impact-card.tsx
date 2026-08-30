import type { ImpactWeek } from "@screen-time/contracts";
import { AttentionField } from "@/components/attention-field";
import type { ImpactWeekResult } from "@/lib/impact";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
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
  const amount = money.format(week.impactFundMinor / 100);
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
          {week.impactPercentage}% del ingreso publicitario registrado
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
          <dt>Participantes</dt>
          <dd>{week.participants.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Acciones verificadas</dt>
          <dd>{week.rewardedAds.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Estado del monto</dt>
          <dd>{week.isEstimated ? "A confirmar" : "Conciliado"}</dd>
        </div>
      </dl>
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

import type { ImpactWeek } from "@screen-time/contracts";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const statusLabels: Record<ImpactWeek["status"], string> = {
  draft: "Semana en preparación",
  open: "Semana abierta",
  voting_closed: "Votación cerrada",
  donation_pending: "Donación pendiente",
  donated: "Comprobante publicado",
};

export function ImpactCard({ week, compact = false }: { week: ImpactWeek; compact?: boolean }) {
  return (
    <article className={`impact-ledger${compact ? " impact-ledger--compact" : ""}`}>
      <header className="impact-ledger__header">
        <div>
          <span className="mono-label">REGISTRO / {week.weekStart}</span>
          <span className="impact-ledger__date">hasta {week.weekEnd}</span>
        </div>
        <div className="impact-ledger__statuses">
          <span className={`status status--${week.status}`}>{statusLabels[week.status]}</span>
          <span className={`status ${week.isEstimated ? "status--estimated" : "status--confirmed"}`}>
            {week.isEstimated ? "Estimado" : "Confirmado"}
          </span>
        </div>
      </header>
      <div className="impact-ledger__amount">
        <p>{money.format(week.impactFundMinor / 100)}</p>
        <span>{week.impactPercentage}% del ingreso publicitario registrado</span>
      </div>
      <div className="candidate-ledger" role="list" aria-label="Distribución de votos por causa">
        {week.candidates.map((candidate, index) => (
          <div className="candidate-ledger__row" key={candidate.charity.id} role="listitem">
            <span className="candidate-ledger__index" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="candidate-ledger__cause">
              <strong>{candidate.charity.name}</strong>
              <span>{candidate.charity.category}</span>
            </div>
            <div className="candidate-ledger__result">
              <b>{candidate.percentage}%</b>
              <span aria-hidden="true">
                <i style={{ "--progress": `${candidate.percentage}%` } as React.CSSProperties} />
              </span>
            </div>
          </div>
        ))}
      </div>
      <dl className="impact-ledger__meta">
        <div><dt>Participantes</dt><dd>{week.participants.toLocaleString()}</dd></div>
        <div><dt>Acciones registradas</dt><dd>{week.rewardedAds.toLocaleString()}</dd></div>
        <div><dt>Estado del monto</dt><dd>{week.isEstimated ? "A confirmar al cierre" : "Conciliado"}</dd></div>
      </dl>
    </article>
  );
}

import type { ImpactWeek } from "@screen-time/contracts";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function ImpactCard({ week, compact = false }: { week: ImpactWeek; compact?: boolean }) {
  return (
    <article className={`impact-card${compact ? " impact-card--compact" : ""}`}>
      <div className="eyebrow-row">
        <span className="eyebrow">Fondo de impacto</span>
        <span className={`status status--${week.status}`}>{week.isEstimated ? "Estimado" : "Confirmado"}</span>
      </div>
      <p className="impact-amount">{money.format(week.impactFundMinor / 100)}</p>
      <p className="muted">{week.impactPercentage}% del ingreso publicitario de la semana</p>
      <div className="candidate-list">
        {week.candidates.map((candidate) => (
          <div className="candidate" key={candidate.charity.id}>
            <div>
              <strong>{candidate.charity.name}</strong>
              <span>{candidate.charity.category}</span>
            </div>
            <b>{candidate.percentage}%</b>
            <i style={{ "--progress": `${candidate.percentage}%` } as React.CSSProperties} />
          </div>
        ))}
      </div>
      <div className="impact-meta">
        <span>{week.participants.toLocaleString()} votantes</span>
        <span>{week.rewardedAds.toLocaleString()} acciones</span>
      </div>
    </article>
  );
}

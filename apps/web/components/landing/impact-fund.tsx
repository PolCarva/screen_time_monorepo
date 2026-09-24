import Link from "next/link";
import type { CSSProperties } from "react";

import { categoryLabels, formatFund, statusLabels } from "@/components/impact-card";
import { stagger } from "@/components/motion/stagger";
import type { PublicImpact } from "@/lib/impact";

import styles from "./impact-fund.module.css";

const weekDay = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const SHARE_COLORS = ["var(--mineral-light)", "var(--mineral)", "var(--peach)"];

const STEPS = [
  "Ves un anuncio opcional para entrar",
  "El 80 % de su ingreso entra al fondo de la semana",
  "Votas qué proyecto lo recibe",
  "Publicamos el comprobante: ves adónde llegó tu aporte",
];

function FundCard({ impact }: { impact: PublicImpact }) {
  if (impact.state !== "ready") {
    return (
      <div className={styles.card} data-reveal="" style={stagger(1)}>
        <div className={styles.cardTop}>
          <span className="eyebrow">Fondo de la semana</span>
        </div>
        <p className={styles.pending}>
          El fondo de esta semana se publica cuando se abre la votación.
        </p>
        <FundStates />
      </div>
    );
  }
  const week = impact.week;
  const totalVotes = week.candidates.reduce((sum, candidate) => sum + candidate.votes, 0);
  return (
    <div className={styles.card} data-reveal="" style={stagger(1)}>
      <div className={styles.cardTop}>
        <span className="eyebrow">
          Semana del {weekDay.format(new Date(`${week.weekStart}T00:00:00Z`))}
        </span>
        <span className={`eyebrow ${styles.status}`}>{statusLabels[week.status]}</span>
      </div>
      {week.impactFundMinor > 0 ? (
        <>
          <p className={styles.amount}>{formatFund(week.impactFundMinor, week.currency)}</p>
          <p className={styles.amountNote}>
            {week.isEstimated ? "Estimado" : "Confirmado"} · reunido esta semana
            por la comunidad · {week.impactPercentage} % del ingreso publicitario
          </p>
        </>
      ) : (
        // A new week starts at zero; say what fills it instead (D17).
        <p className={styles.pending}>
          La semana recién empieza: el fondo se llena con los anuncios que la
          comunidad elige ver.
        </p>
      )}
      {week.candidates.length > 0 ? (
        <>
          <div aria-hidden="true" className={styles.bar}>
            {week.candidates.map((candidate, index) => (
              <span
                key={candidate.charity.id}
                style={
                  {
                    flexGrow: totalVotes > 0 ? Math.max(candidate.votes, 0.001) : 1,
                    background: totalVotes > 0 ? SHARE_COLORS[index % 3] : "var(--fog)",
                    "--row": index,
                  } as CSSProperties
                }
              />
            ))}
          </div>
          <ul className={styles.projects}>
            {week.candidates.map((candidate, index) => (
              <li key={candidate.charity.id} style={{ "--row": index } as CSSProperties}>
                <span className={styles.project}>
                  <strong>{candidate.charity.name}</strong>
                  <span className="eyebrow">
                    {categoryLabels[candidate.charity.category]} ·{" "}
                    {candidate.charity.country}
                  </span>
                </span>
                <span className={styles.share}>
                  {totalVotes > 0 ? `${candidate.percentage} %` : "Sin votos"}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <FundStates />
    </div>
  );
}

function FundStates() {
  return (
    <dl className={styles.states}>
      <div>
        <dt className="eyebrow">Estimado</dt>
        <dd>al ver el anuncio</dd>
      </div>
      <div>
        <dt className="eyebrow">Confirmado</dt>
        <dd>AdMob, al día siguiente</dd>
      </div>
      <div>
        <dt className="eyebrow">Comprobante</dt>
        <dd>al donar</dd>
      </div>
    </dl>
  );
}

export function ImpactFund({ impact }: { impact: PublicImpact }) {
  return (
    <section aria-labelledby="impact-title" className={styles.section} id="impacto">
      <div className={`shell ${styles.grid}`}>
        <div className={styles.copy}>
          <p className="eyebrow">Lo que ganan los demás · fondo semanal</p>
          <h2 className="section-title" data-reveal="mask" id="impact-title">
            Tu pausa también ayuda a alguien más.
          </h2>
          <p className="lead" data-reveal="fade" style={stagger(1)}>
            Cuando decides entrar y ves un anuncio, el 80 % de lo que genera va
            a un fondo semanal. La comunidad vota a qué proyecto va y publicamos
            el comprobante. Tu tiempo vuelve a ti; lo que generas llega a
            proyectos reales.
          </p>
          <ol className={styles.steps}>
            {STEPS.map((step, index) => (
              <li data-reveal="" key={step} style={stagger(index + 1)}>
                <span className="eyebrow">{String(index + 1).padStart(2, "0")}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <Link className={`underline-link ${styles.more}`} href="/impacto">
            Ver adónde llegó cada donación
          </Link>
        </div>
        <FundCard impact={impact} />
      </div>
    </section>
  );
}

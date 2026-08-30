import type { Metadata } from "next";
import Link from "next/link";

import { ImpactCard, ImpactUnavailable } from "@/components/impact-card";
import { SiteHeader } from "@/components/site-header";
import { getCurrentImpactWeek } from "@/lib/impact";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Registro de impacto",
  description:
    "Monto semanal, asignación, votación y comprobantes del fondo de impacto de Still.",
};

export default async function ImpactPage() {
  const result = await getCurrentImpactWeek();
  if (result.state !== "ready") {
    return (
      <main>
        <SiteHeader />
        <section className="impact-page-hero shell-wide">
          <div className="impact-page-hero__copy">
            <p className="mono-label">REGISTRO PÚBLICO / ESTADO REAL</p>
            <h1>El fondo deja rastro.</h1>
            <p>
              Esta página nunca sustituye información ausente por cifras de
              demostración.
            </p>
            <Link className="text-link" href="/">
              Volver al inicio
            </Link>
          </div>
          <ImpactUnavailable state={result.state} />
        </section>
      </main>
    );
  }
  const week = result.week;
  const steps = [
    {
      index: "01",
      state: "ACTIVO",
      done: true,
      title: "Semana abierta",
      body: "El ingreso se actualiza como estimación. La votación permanece abierta hasta el cierre publicado.",
    },
    {
      index: "02",
      state: week.status === "open" ? "PENDIENTE" : "COMPLETO",
      done: week.status !== "open",
      title: "Cierre y conciliación",
      body: "Se confirma el ingreso, se congela la asignación y se preserva el resultado de la votación.",
    },
    {
      index: "03",
      state: week.status === "donated" ? "COMPLETO" : "PENDIENTE",
      done: week.status === "donated",
      title: "Donación y comprobante",
      body: "La donación se registra manualmente. El comprobante público solo aparece después de existir.",
    },
  ] as const;

  return (
    <main>
      <SiteHeader />
      <section className="impact-page-hero shell-wide">
        <div className="impact-page-hero__copy">
          <p className="mono-label">
            REGISTRO PÚBLICO / {week.weekStart} — {week.weekEnd}
          </p>
          <h1>El fondo deja rastro.</h1>
          <p>
            Still asigna {week.impactPercentage}% del ingreso publicitario al
            fondo semanal. Mientras la semana está abierta, el monto es
            estimado. Cada cambio de estado queda visible.
          </p>
        </div>
        <ImpactCard week={week} />
      </section>

      <section className="fund-route shell-wide" aria-labelledby="route-title">
        <header className="fund-route__heading">
          <p className="mono-label">RUTA DEL FONDO / 3 ESTADOS</p>
          <h2 id="route-title">Del registro al comprobante.</h2>
        </header>
        <div className="fund-route__steps">
          {steps.map((step) => (
            <article
              className={`fund-route__step${step.done ? " is-done" : ""}`}
              key={step.index}
            >
              <span>{step.index}</span>
              <b>{step.state}</b>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
        <div className="fund-route__actions">
          {week.donationProofUrl ? (
            <a className="button button--ink" href={week.donationProofUrl}>
              Ver comprobante
            </a>
          ) : (
            <p className="proof-pending">
              El comprobante se publicará después de registrar la donación.
            </p>
          )}
          <Link className="text-link" href="/">
            Volver al inicio
          </Link>
        </div>
      </section>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { ImpactCard, ImpactUnavailable } from "@/components/impact-card";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getPublicImpact } from "@/lib/impact";
import { pageMetadata } from "@/lib/seo";

// Same live data as the home page, regenerated at most every five minutes
// (docs/landing-seo-plan.md, D7).
export const revalidate = 300;

export const metadata: Metadata = pageMetadata({
  path: "/impacto",
  image: "/impacto/opengraph-image",
  title: "Impacto de Still: el fondo que dona el 80 % de los anuncios",
  description:
    "Cuánto se reunió, a qué proyectos se donó y cómo vota la comunidad cada semana. Números en vivo de una app gratis que dona lo que generan sus anuncios.",
});

const H1 = "Una app que dona el 80 % de sus anuncios: el registro completo";

export default async function ImpactPage() {
  const result = await getPublicImpact();
  if (result.state !== "ready") {
    return (
      <>
        <SiteHeader />
        <main id="contenido">
          <section className="impact-page-hero shell-wide">
            <div className="impact-page-hero__copy">
              <p className="mono-label">IMPACTO / REGISTRO PÚBLICO</p>
              <h1>{H1}</h1>
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
        <SiteFooter />
      </>
    );
  }
  const week = result.week;
  const steps = [
    {
      index: "01",
      state: "ACTIVO",
      done: true,
      title: "Semana abierta",
      body: "Cada anuncio confirmado por AdMob suma lo que se estima que generó, y el informe diario de AdMob lo ajusta. La votación queda abierta hasta el domingo.",
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
    <>
      <SiteHeader />
      <main id="contenido">
        <section className="impact-page-hero shell-wide">
          <div className="impact-page-hero__copy">
            <p className="mono-label">
              REGISTRO PÚBLICO / {week.weekStart} — {week.weekEnd}
            </p>
            <h1>{H1}</h1>
            <p>
              Still asigna {week.impactPercentage}% del ingreso publicitario al
              fondo semanal. Mientras la semana está abierta, el monto es
              estimado. Cada cambio de estado queda visible.
            </p>
          </div>
          <ImpactCard week={week} />
        </section>

        <section
          className="fund-route shell-wide"
          aria-labelledby="route-title"
        >
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
      <SiteFooter />
    </>
  );
}

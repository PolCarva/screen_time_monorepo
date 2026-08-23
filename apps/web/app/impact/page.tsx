import Link from "next/link";

import { ImpactCard } from "@/components/impact-card";
import { SiteHeader } from "@/components/site-header";
import { getCurrentImpactWeek } from "@/lib/impact";

export const revalidate = 300;

export default async function ImpactPage() {
  const week = await getCurrentImpactWeek();
  return (
    <main>
      <SiteHeader />
      <section className="page-hero shell page-hero--impact">
        <div>
          <p className="eyebrow">Semana {week.weekStart} — {week.weekEnd}</p>
          <h1>Impacto que se puede <em>seguir.</em></h1>
          <p>La plataforma asigna {week.impactPercentage}% de sus ingresos publicitarios al Impact Fund. El monto abierto es estimado hasta el cierre.</p>
        </div>
        <ImpactCard week={week} />
      </section>
      <section className="transparency shell">
        <p className="eyebrow">La ruta del fondo</p>
        <div className="timeline">
          <article className="is-done"><span>1</span><h3>Semana abierta</h3><p>El ingreso se actualiza diariamente como estimado.</p></article>
          <article className={week.status !== "open" ? "is-done" : ""}><span>2</span><h3>Cierre y conciliación</h3><p>Se confirma el ingreso y se congela la asignación.</p></article>
          <article className={week.status === "donated" ? "is-done" : ""}><span>3</span><h3>Donación verificada</h3><p>El comprobante se publica después del registro manual.</p></article>
        </div>
        {week.donationProofUrl ? <a className="button button--dark" href={week.donationProofUrl}>Ver comprobante</a> : <p className="proof-pending">El comprobante aparecerá aquí después de la donación.</p>}
        <Link className="text-link" href="/">← Volver al inicio</Link>
      </section>
    </main>
  );
}

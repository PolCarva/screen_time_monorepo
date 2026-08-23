import Link from "next/link";

import { ImpactCard } from "@/components/impact-card";
import { SiteHeader } from "@/components/site-header";
import { getCurrentImpactWeek } from "@/lib/impact";

export default async function HomePage() {
  const impact = await getCurrentImpactWeek();

  return (
    <main>
      <SiteHeader />
      <section className="hero shell">
        <div className="hero-copy">
          <p className="eyebrow">Bienestar digital · impacto real</p>
          <h1>Menos pantalla.<br /><em>Más vida.</em></h1>
          <p className="hero-lede">Una pausa amable antes de abrir las apps que más te distraen. Tú eliges volver o recuperar esos minutos.</p>
          <div className="hero-actions" id="download">
            <span className="button button--dark">Beta privada · iOS</span>
            <span className="button button--ghost">Beta privada · Android</span>
          </div>
          <p className="fine-print">18+ · Tu selección y tu historial de uso permanecen en el dispositivo.</p>
        </div>
        <div className="phone-stage" aria-label="Vista de la intervención en la app">
          <div className="orbit orbit--one" />
          <div className="orbit orbit--two" />
          <div className="phone">
            <div className="phone-top"><span>9:41</span><span>● ●</span></div>
            <div className="token-seal"><span>⌁</span></div>
            <p className="phone-kicker">Una pausa antes de entrar</p>
            <h2>¿Realmente quieres abrir esta app?</h2>
            <p>Llevas 1 h 14 min hoy</p>
            <button>Usar 1 Unlock Token</button>
            <span className="not-now">Ahora no</span>
          </div>
        </div>
      </section>

      <section className="principles shell">
        <p className="eyebrow">Cómo funciona</p>
        <div className="principle-grid">
          <article><span>01</span><h3>Interrumpe el hábito</h3><p>Una fricción breve y deliberada cuando intentas entrar.</p></article>
          <article><span>02</span><h3>Elige con intención</h3><p>Regresa o usa un token para desbloquear 10 minutos.</p></article>
          <article><span>03</span><h3>Convierte atención</h3><p>La plataforma destina parte del ingreso publicitario al fondo.</p></article>
        </div>
      </section>

      <section className="impact-preview shell">
        <div className="impact-copy">
          <p className="eyebrow">Transparencia semanal</p>
          <h2>Tu atención puede sostener algo real.</h2>
          <p>Cada semana publicamos el ingreso estimado, la asignación 80/20, la votación y, al donar, el comprobante.</p>
          <Link className="text-link" href="/impact">Ver el fondo de esta semana →</Link>
        </div>
        <ImpactCard week={impact} />
      </section>

      <footer className="footer shell">
        <div className="brand"><span className="brand-mark">⌁</span><span>still</span></div>
        <p>Unlock your time. Make an impact.</p>
        <div><Link href="/impact">Impacto</Link><Link href="/admin">Administración</Link></div>
      </footer>
    </main>
  );
}

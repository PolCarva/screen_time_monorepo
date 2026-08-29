import Link from "next/link";

import { BrandLockup } from "@/components/brand-mark";
import { ImpactCard } from "@/components/impact-card";
import { InterventionDemo } from "@/components/intervention-demo";
import { SiteHeader } from "@/components/site-header";
import { getCurrentImpactWeek } from "@/lib/impact";

const mechanics = [
  {
    index: "01",
    time: "00:00",
    title: "El reflejo se corta.",
    body: "Still aparece justo antes de las apps que elegiste. No bloquea el teléfono ni clasifica tu atención.",
  },
  {
    index: "02",
    time: "00:01",
    title: "La decisión vuelve.",
    body: "No entrar requiere un toque. Si decides seguir, un pase abre la app durante 10 minutos.",
  },
  {
    index: "03",
    time: "10:00",
    title: "El corte regresa.",
    body: "Cuando el pase termina, la pausa vuelve a estar activa. Nada queda abierto por accidente.",
  },
] as const;

const faqs = [
  {
    question: "¿Still bloquea todo el teléfono?",
    answer:
      "No. Protege sólo las apps que elegiste y aparece antes de abrirlas. Puedes no entrar con un toque o usar un pase de 10 minutos.",
  },
  {
    question: "¿Qué información sale del dispositivo?",
    answer:
      "Los nombres de las apps, sus identificadores y el historial detallado permanecen en tu teléfono. Still comparte únicamente los conteos necesarios para pases, votos e impacto.",
  },
  {
    question: "¿Cómo funciona el fondo de impacto?",
    answer:
      "La plataforma asigna una parte de sus ingresos al fondo; un anuncio individual no equivale a una donación. Cada semana publicamos el monto estimado, el cierre, la asignación y el comprobante.",
  },
] as const;

export default async function HomePage() {
  const impact = await getCurrentImpactWeek();

  return (
    <main>
      <SiteHeader />

      <section className="hero shell-wide">
        <div className="hero__meta mono-label">
          <span>UNA PAUSA ANTES DE ENTRAR</span>
          <span>IOS + ANDROID / BETA PRIVADA</span>
        </div>
        <div className="hero__copy">
          <h1>
            Una pausa
            <span>que <mark>cuenta.</mark></span>
          </h1>
          <div className="hero__lede">
            <p>
              Still aparece antes de las apps que abres por reflejo. Salir es un toque.
              Entrar sigue siendo una elección.
            </p>
            <div className="hero__actions" id="download">
              <a className="button button--signal" href="#beta-status">
                Ver disponibilidad
              </a>
              <Link className="text-link" href="/impact">Ver el fondo semanal</Link>
            </div>
            <p className="fine-print">18+ · Los nombres de tus apps no salen de tu dispositivo.</p>
          </div>
        </div>
        <InterventionDemo />
      </section>

      <section className="mechanism shell-wide" aria-labelledby="mechanism-title">
        <header className="section-heading">
          <p className="mono-label">SECUENCIA / CÓMO FUNCIONA</p>
          <h2 id="mechanism-title">Un segundo cambia la secuencia.</h2>
          <p>No necesitas otra meta diaria. Necesitas ver el momento que normalmente desaparece.</p>
        </header>
        <ol className="mechanism__list">
          {mechanics.map((item) => (
            <li key={item.index}>
              <span className="mechanism__index">{item.index}</span>
              <span className="mechanism__time">{item.time}</span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="choice-section">
        <div className="shell-wide choice-section__grid">
          <div className="choice-section__statement">
            <p className="mono-label">DISEÑADO PARA SALIR</p>
            <h2>La opción más fácil es no entrar.</h2>
            <p>
              Still no es una puerta cerrada. Es un intervalo claro: contexto suficiente,
              una salida visible y una alternativa con duración explícita.
            </p>
          </div>
          <div className="choice-spec" aria-label="Jerarquía de la intervención">
            <div className="choice-spec__row choice-spec__row--primary">
              <span>01 / ACCIÓN PRIMARIA</span>
              <strong>No entrar</strong>
              <b>1 toque</b>
            </div>
            <div className="choice-spec__cut"><span>00:01 / ELECCIÓN</span></div>
            <div className="choice-spec__row">
              <span>02 / ALTERNATIVA</span>
              <strong>Usar 1 pase</strong>
              <b>10 min</b>
            </div>
          </div>
        </div>
      </section>

      <section className="day-record shell-wide" aria-labelledby="day-record-title">
        <header className="section-heading section-heading--compact">
          <p className="mono-label">HOY / HASTA AHORA</p>
          <h2 id="day-record-title">Un registro, no una nota.</h2>
          <p>Still describe lo que pasó. No convierte tu día en un score.</p>
        </header>
        <div className="day-record__dashboard">
          <div className="day-record__hero-stat">
            <strong>1:14</strong>
            <span>horas / apps elegidas</span>
          </div>
          <div className="time-strip" aria-label="Actividad de apps elegidas entre las 8 y las 18 horas">
            <span className="time-strip__label">08:00</span>
            <div className="time-strip__track" aria-hidden="true">
              <i style={{ left: "7%", width: "8%" }} />
              <i style={{ left: "31%", width: "15%" }} />
              <i className="is-cut" style={{ left: "61%", width: "3%" }} />
              <i style={{ left: "76%", width: "11%" }} />
            </div>
            <span className="time-strip__label">18:00</span>
          </div>
          <dl className="day-record__stats">
            <div><dt>Aperturas evitadas</dt><dd>06</dd><dd className="metric-context">seis decisiones de no entrar</dd></div>
            <div><dt>Tiempo fuera del flujo</dt><dd>42 min</dd><dd className="metric-context">estimado con tu configuración</dd></div>
            <div><dt>Última actualización</dt><dd>14:32</dd><dd className="metric-context">datos procesados en el dispositivo</dd></div>
          </dl>
        </div>
      </section>

      <section className="impact-section shell-wide" aria-labelledby="impact-title">
        <div className="impact-section__copy">
          <p className="mono-label">REGISTRO PÚBLICO / CADA SEMANA</p>
          <h2 id="impact-title">El fondo deja rastro.</h2>
          <p>
            Publicamos el monto estimado, el cierre, la asignación y el comprobante.
            Un anuncio individual no “dona”: la plataforma asigna parte de su ingreso al fondo.
          </p>
          <Link className="text-link" href="/impact">Abrir el registro completo</Link>
        </div>
        <ImpactCard week={impact} />
      </section>

      <section className="privacy-statement shell-wide">
        <p className="mono-label">PRIVADO POR DISEÑO</p>
        <h2>Los nombres de tus apps se quedan en tu teléfono.</h2>
        <div>
          <p>
            Still comparte conteos generales para pases, votos e impacto. La selección de apps,
            sus identificadores y tu historial detallado permanecen en el dispositivo.
          </p>
          <Link className="text-link" href="/privacy">Leer la política completa</Link>
        </div>
      </section>

      <section className="faq-section shell-wide" aria-labelledby="faq-title">
        <header>
          <p className="mono-label">PREGUNTAS / SIN LETRA PEQUEÑA</p>
          <h2 id="faq-title">Antes de empezar.</h2>
        </header>
        <dl className="faq-section__list">
          {faqs.map((item, index) => (
            <div key={item.question}>
              <dt>
                <span className="mono-label">0{index + 1}</span>
                {item.question}
              </dt>
              <dd>{item.answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="closing-cta" id="beta-status" aria-labelledby="closing-title">
        <div className="shell-wide closing-cta__inner">
          <p className="mono-label">00:01 / TUYO</p>
          <h2 id="closing-title">Antes de entrar, un segundo es tuyo.</h2>
          <span className="beta-status">BETA PRIVADA / IOS + ANDROID</span>
          <p>Acceso por invitación · disponibilidad limitada por país y plataforma.</p>
        </div>
      </section>

      <footer className="site-footer shell-wide">
        <BrandLockup />
        <p>Una pausa que cuenta.</p>
        <nav aria-label="Pie">
          <Link href="/impact">Impacto</Link>
          <Link href="/privacy">Privacidad</Link>
        </nav>
      </footer>
    </main>
  );
}

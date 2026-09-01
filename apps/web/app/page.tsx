import Image from "next/image";
import Link from "next/link";

import { AttentionField } from "@/components/attention-field";
import { BetaSignupForm } from "@/components/beta-signup-form";
import { BrandLockup } from "@/components/brand-mark";
import { ImpactCard, ImpactUnavailable } from "@/components/impact-card";
import { InterventionDemo } from "@/components/intervention-demo";
import { SiteHeader } from "@/components/site-header";
import { getCurrentImpactWeek } from "@/lib/impact";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const impactResult = await getCurrentImpactWeek();
  const impact = impactResult.state === "ready" ? impactResult.week : null;

  return (
    <main>
      <SiteHeader />

      <section className="hero-v3 shell-wide">
        <div className="hero-v3__meta mono-label">
          <span>QUIET TECHNOLOGY / BETA PRIVADA</span>
          <span>ANDROID</span>
        </div>
        <div className="hero-v3__grid">
          <div className="hero-v3__copy">
            <h1>
              Un segundo
              <br />
              antes de entrar.
            </h1>
            <p>
              Still aparece antes de las apps que abres automáticamente. Hace
              visible la decisión; no la toma por ti.
            </p>
            <div className="hero-v3__actions" id="download">
              <a className="button button--ink" href="#beta-status">
                Ver disponibilidad
              </a>
              <a className="text-link" href="#intervencion">
                Ver la intervención
              </a>
            </div>
            <p className="fine-print">
              18+ · Los nombres de las apps y el historial detallado permanecen
              en tu dispositivo.
            </p>
          </div>
          <InterventionDemo />
        </div>
        <dl className="hero-v3__facts">
          <div>
            <dt>Tiempo recuperado</dt>
            <dd>En tu dispositivo</dd>
          </div>
          <div>
            <dt>Apps protegidas</dt>
            <dd>Elegidas por ti</dd>
          </div>
          <div>
            <dt>Fondo semanal</dt>
            <dd>
              {impact
                ? new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: impact.currency,
                    maximumFractionDigits: 0,
                  }).format(impact.impactFundMinor / 100)
                : "Sin publicar"}
            </dd>
          </div>
          <div>
            <dt>Siguiente acción</dt>
            <dd>Ver disponibilidad →</dd>
          </div>
        </dl>
      </section>

      <section
        className="observed-section shell-wide"
        aria-labelledby="problem-title"
      >
        <div className="observed-section__image">
          <Image
            alt="Una persona repara una silla usada con luz natural"
            fill
            priority={false}
            sizes="(max-width: 800px) 100vw, 62vw"
            src="/images/v3/repair-chair-wide.png"
          />
          <span className="image-caption">
            ATENCIÓN APLICADA / REPARAR EN VEZ DE REEMPLAZAR
          </span>
        </div>
        <div className="observed-section__copy">
          <p className="mono-label">EL PROBLEMA / CASI INVISIBLE</p>
          <h2 id="problem-title">
            La app suele abrirse antes de que aparezca una intención.
          </h2>
          <p>
            Still no intenta convencerte de abandonar el teléfono. Inserta
            contexto en el único punto donde sirve: justo antes de entrar.
          </p>
          <dl className="observed-section__record">
            <div>
              <dt>GESTO</dt>
              <dd>gesto automático</dd>
            </div>
            <div className="is-current">
              <dt>PAUSA</dt>
              <dd>la decisión aparece</dd>
            </div>
            <div>
              <dt>ELECCIÓN</dt>
              <dd>volver o usar un pase</dd>
            </div>
          </dl>
        </div>
      </section>

      <section
        className="sequence-section"
        id="intervencion"
        aria-labelledby="sequence-title"
      >
        <div className="shell-wide sequence-section__inner">
          <header className="section-intro">
            <p className="mono-label">INTERVENCIÓN / AUTOMÁTICO → CONSCIENTE</p>
            <h2 id="sequence-title">
              El campo se abre. La elección queda en el centro.
            </h2>
            <p>
              Una transición de 520 ms, un háptico y dos caminos explícitos. Sin
              respiración guiada, culpa, score ni animación en loop.
            </p>
          </header>
          <ol className="sequence-list">
            <li>
              <span>00</span>
              <h3>Denso</h3>
              <p>
                El gesto ya empezó. Los módulos registran una apertura
                automática.
              </p>
            </li>
            <li className="is-open">
              <span>01</span>
              <h3>Abierto</h3>
              <p>El campo se separa una vez y revela el contexto de hoy.</p>
            </li>
            <li>
              <span>10</span>
              <h3>Elegido</h3>
              <p>
                Volver es una acción. Continuar abre un pase con duración clara.
              </p>
            </li>
          </ol>
        </div>
      </section>

      <section
        className="product-section shell-wide"
        id="producto"
        aria-labelledby="product-title"
      >
        <div
          className="product-section__device"
          aria-label="Vista de la pantalla Hoy de Still"
        >
          <div className="phone-screen">
            <header>
              <span>ESTRUCTURA DEL PRODUCTO</span>
              <b>•••</b>
            </header>
            <div className="phone-screen__hero">
              <strong>—</strong>
              <div>
                <b>minutos</b>
                <span>recuperados hoy</span>
              </div>
            </div>
            <p>
              Tus métricas aparecen aquí únicamente después de registrarse en
              el dispositivo.
            </p>
            <dl>
              <div>
                <dt>Apps protegidas</dt>
                <dd>—</dd>
              </div>
              <div>
                <dt>Aperturas evitadas</dt>
                <dd>—</dd>
              </div>
            </dl>
            <div className="phone-screen__field">
              <span>TIEMPO EN APPS / 7 DÍAS</span>
              <AttentionField
                label="Tiempo en apps seleccionadas durante siete días"
                values={[]}
              />
            </div>
            <div className="phone-screen__row">
              <span>
                <small>FONDO DE IMPACTO</small>
                <b>DATOS REALES</b>
              </span>
              <em>ESTADO →</em>
            </div>
            <div className="phone-screen__row">
              <span>
                <small>SIGUIENTE</small>
                <b>Revisar apps protegidas</b>
              </span>
              <em>→</em>
            </div>
          </div>
        </div>
        <div className="product-section__copy">
          <p className="mono-label">PRODUCTO / CINCO RESPUESTAS</p>
          <h2 id="product-title">Hoy empieza con lo que importa ahora.</h2>
          <ol>
            <li>
              <span>01</span>
              <p>
                <strong>Tiempo recuperado.</strong> Una métrica protagonista,
                sin score.
              </p>
            </li>
            <li>
              <span>02</span>
              <p>
                <strong>Apps protegidas.</strong> La selección actual se
                entiende de inmediato.
              </p>
            </li>
            <li>
              <span>03</span>
              <p>
                <strong>Progreso.</strong> El field representa datos reales, no
                decoración.
              </p>
            </li>
            <li>
              <span>04</span>
              <p>
                <strong>Impacto.</strong> Monto y estado antes que una historia
                emotiva.
              </p>
            </li>
            <li>
              <span>05</span>
              <p>
                <strong>Siguiente acción.</strong> Una sola cosa concreta por
                hacer.
              </p>
            </li>
          </ol>
        </div>
      </section>

      <section className="impact-section-v3" aria-labelledby="impact-title">
        <div className="shell-wide impact-section-v3__inner">
          <div className="impact-section-v3__copy">
            <p className="mono-label">IMPACTO / DATO, ESTADO, PRUEBA</p>
            <h2 id="impact-title">El fondo no necesita una metáfora verde.</h2>
            <p>
              Still muestra cuánto hay disponible, de dónde viene, si está
              estimado o conciliado, cómo se asigna y cuándo existe comprobante.
            </p>
            <ul>
              <li>
                <span />
                Ingresos registrados, no promesas por anuncio.
              </li>
              <li>
                <span />
                Votación visible y cierre semanal.
              </li>
              <li>
                <span />
                Comprobante sólo después de donar.
              </li>
            </ul>
            <Link className="text-link" href="/impact">
              Abrir el registro completo
            </Link>
          </div>
          {impactResult.state === "ready" ? (
            <ImpactCard week={impactResult.week} />
          ) : (
            <ImpactUnavailable state={impactResult.state} />
          )}
        </div>
      </section>

      <section className="care-section shell-wide" aria-labelledby="care-title">
        <div className="care-section__copy">
          <p className="mono-label">RESULTADO / TIEMPO APLICADO</p>
          <h2 id="care-title">
            Menos gesto automático. Más espacio para algo concreto.
          </h2>
          <p>
            La marca no inventa minutos ni promete resultados. Registra lo que
            ocurrió y deja que cada persona decida dónde poner ese tiempo.
          </p>
          <div className="care-section__principles">
            <span>Sin rachas</span>
            <span>Sin culpa</span>
            <span>Sin vigilancia de nombres</span>
            <span>Sin decorado “eco”</span>
          </div>
        </div>
        <div className="care-section__image">
          <Image
            alt="Dos manos remiendan una prenda oscura junto a una ventana"
            fill
            sizes="(max-width: 800px) 100vw, 42vw"
            src="/images/v3/mend-jacket-portrait.png"
          />
        </div>
      </section>

      <section
        className="privacy-section shell-wide"
        aria-labelledby="privacy-title"
      >
        <div>
          <p className="mono-label">PRIVADO POR DISEÑO</p>
          <h2 id="privacy-title">Los nombres se quedan en el dispositivo.</h2>
        </div>
        <div>
          <p>
            Still comparte sólo conteos generales necesarios para pases, impacto
            y operación. La selección de apps y el detalle de uso no salen del
            teléfono.
          </p>
          <Link className="text-link" href="/privacy">
            Leer la política en lenguaje claro
          </Link>
        </div>
      </section>

      <section className="closing-v3" id="beta-status">
        <div className="shell-wide closing-v3__inner">
          <p className="mono-label">BETA PRIVADA / ANDROID</p>
          <h2>El momento antes de entrar también puede ser tuyo.</h2>
          <div>
            <BetaSignupForm />
            <span>
              Acceso por invitación · disponibilidad limitada por país y
              plataforma.
            </span>
          </div>
        </div>
      </section>

      <footer className="site-footer shell-wide">
        <BrandLockup />
        <p>Quiet technology for a conscious moment.</p>
        <nav aria-label="Pie">
          <Link href="/impact">Impacto</Link>
          <Link href="/privacy">Privacidad</Link>
          <Link href="/terms">Términos</Link>
        </nav>
      </footer>
    </main>
  );
}

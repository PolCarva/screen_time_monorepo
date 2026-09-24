import type { PublicImpact } from "@/lib/impact";
import { VIDEOS, storeNote } from "@/lib/site";

import { liveNumbers } from "./live-numbers";
import { PauseScreen, Phone } from "./phone";
import { PhoneVideo } from "./phone-video";
import styles from "./hero.module.css";
import { StoreBadges } from "./store-badges";

export function Hero({ impact }: { impact: PublicImpact }) {
  const live = liveNumbers(impact);
  const stats = [
    { label: "Tiempo devuelto", value: live.returned, pending: "Se mide mientras usas Still" },
    { label: "Donado hasta hoy", value: live.donated, pending: "Se publica con la primera donación" },
    { label: "Personas haciendo pausas", value: live.people, pending: "Se cuenta desde la primera pausa" },
  ];

  return (
    <section aria-labelledby="hero-title" className={styles.hero} id="top">
      <div className={`shell ${styles.grid}`}>
        <div className={styles.copy}>
          {/* The keyword heading sits where the small label was (D6). */}
          <h1 className="eyebrow" id="hero-title">
            Still · App gratis para usar menos el celular
          </h1>
          <p className={styles.display}>Un segundo antes de entrar.</p>
          <p className={styles.lead}>
            <strong>Una pausa que suma.</strong> Still aparece antes de las
            apps que abres por reflejo. Si vuelves, ganas tiempo para ti. Si
            entras, el anuncio que ves suma a un proyecto que la comunidad
            elige cada semana.
          </p>
          <div className={styles.badges}>
            <StoreBadges />
          </div>
          <p className={styles.note}>{storeNote()}</p>
          <div className={styles.statsSpacer} />
          <dl className={styles.stats}>
            {stats.map((stat, index) => (
              <div className={styles.stat} key={stat.label}>
                <dt className="eyebrow">
                  {index === 0 ? <span aria-hidden="true" className={styles.dot} /> : null}
                  {stat.label}
                </dt>
                <dd className={stat.value ? undefined : styles.pending}>
                  {stat.value ?? stat.pending}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <figure className={styles.visual}>
          <div aria-hidden="true" className={`${styles.bar} ${styles.barTop}`} />
          <div aria-hidden="true" className={`${styles.bar} ${styles.barLeft}`} />
          <div aria-hidden="true" className={`${styles.bar} ${styles.barRight}`} />
          <div aria-hidden="true" className={`${styles.bar} ${styles.barBottom}`} />
          <div className={styles.phoneSlot}>
            <div className={styles.phone}>
              <Phone size="lg" tone="dark">
                <PauseScreen app="Instagram" full opens={7} />
              </Phone>
            </div>
          </div>
          <figcaption className="sr-only">
            Así se ve la pausa de Still antes de abrir Instagram: cuántas veces
            se abrió hoy, «Ya no quiero entrar» y «Ver anuncio».
          </figcaption>
          {VIDEOS.pause ? (
            <div className={styles.caption}>
              <PhoneVideo label="Mira la pausa en video" video={VIDEOS.pause} />
            </div>
          ) : null}
        </figure>
      </div>
    </section>
  );
}

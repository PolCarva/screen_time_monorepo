import type { PublicImpact } from "@/lib/impact";
import { storeNote } from "@/lib/site";

import styles from "./download-cta.module.css";
import { liveNumbers } from "./live-numbers";
import { StoreBadges } from "./store-badges";
import { WaitlistForm } from "./waitlist-form";

export function DownloadCta({ impact }: { impact: PublicImpact }) {
  const live = liveNumbers(impact);
  const hasTotals = Boolean(live.returned || live.donated);

  return (
    <section aria-labelledby="download-title" className={styles.section} id="descargar">
      <div className={`shell ${styles.grid}`}>
        <div className={styles.copy}>
          <p className={`eyebrow eyebrow--dark ${styles.live}`}>
            <span aria-hidden="true" className={styles.dot} />
            {hasTotals ? "En vivo" : "Empieza hoy"}
          </p>
          <h2 className={styles.title} id="download-title">
            {hasTotals ? (
              <>
                {live.returned ? <span>{live.returned}</span> : null}
                {live.returned ? " devueltas. " : null}
                {live.donated ? <span>{live.donated}</span> : null}
                {live.donated ? " donados." : null}
              </>
            ) : (
              "Una pausa que suma, desde hoy."
            )}
          </h2>
          <p className={styles.sub}>
            {live.people
              ? `Entre ${live.people} personas que eligen con intención. Tu primera pausa suma desde hoy.`
              : "Tu primera pausa suma desde hoy: vuelves con tu tiempo, o entras y tu anuncio ayuda a un proyecto."}
          </p>
          <div className={styles.badges}>
            <StoreBadges />
          </div>
          <p className={styles.note}>{storeNote()}</p>
        </div>
        <div className={styles.card}>
          <h3>¿Te avisamos?</h3>
          <p>Un solo correo cuando Still esté publicada en tu tienda. Sin boletines.</p>
          <WaitlistForm />
        </div>
      </div>
    </section>
  );
}

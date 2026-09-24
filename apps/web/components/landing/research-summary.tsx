import Link from "next/link";

import { STUDIES } from "@/lib/landing-content";

import styles from "./research-summary.module.css";

export function ResearchSummary() {
  return (
    <section aria-labelledby="research-title" className={styles.section} id="investigacion">
      <div className={`shell ${styles.inner}`}>
        <div className={styles.top}>
          <div className={styles.heading}>
            <p className="eyebrow eyebrow--dark">Investigación</p>
            <h2 className="section-title" id="research-title">
              La ciencia detrás de la pausa.
            </h2>
          </div>
          <div className={styles.intro}>
            <p>
              Estos estudios evaluaron pausas antes de abrir una app en otras
              herramientas, o el uso del teléfono en general. Still usa el mismo
              principio; cuando tengamos datos propios, los publicaremos aquí.
            </p>
            <Link className="underline-link" href="/investigacion">
              Qué dicen y qué no sabemos todavía
            </Link>
          </div>
        </div>
        <ul className={styles.grid}>
          {STUDIES.map((study) => (
            <li className="reveal" key={study.id}>
              <a className={styles.study} href={study.url} rel="noopener">
                <span className={`eyebrow eyebrow--dark ${styles.source}`}>
                  [{study.id}] {study.source}
                </span>
                <h3 className={styles.title}>{study.title}</h3>
                <span className={styles.detail}>{study.detail}</span>
                <span className={`underline-link ${styles.link}`}>{study.linkLabel}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

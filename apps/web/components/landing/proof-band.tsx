import Link from "next/link";

import { STUDIES_DISCLAIMER } from "@/lib/landing-content";

import styles from "./proof-band.module.css";

const ITEMS = [
  {
    figure: "57 %",
    text: "menos aperturas de las apps elegidas después de seis semanas con una pausa.",
    source: "[1] PNAS · 2023 · 280 personas",
  },
  {
    figure: "1 de 3",
    text: "intentos de abrir la app terminó en «mejor no» después de la pausa.",
    source: "[1] PNAS · 2023 · 36 % de los intentos",
  },
  {
    figure: "−⅓",
    text: "de actividad diaria en redes sociales en un experimento de campo con 269 jóvenes.",
    source: "[2] Autoridad de Competencia de Dinamarca · 2025",
  },
];

export function ProofBand() {
  return (
    <section aria-labelledby="proof-title" className={styles.band}>
      <div className={`shell ${styles.inner}`}>
        <div className={styles.top}>
          <h2 className="eyebrow" id="proof-title">
            Lo que midió la investigación sobre pausas antes de abrir una app
          </h2>
          <Link className="underline-link" href="/investigacion">
            Ver los estudios
          </Link>
        </div>
        <ul className={styles.grid}>
          {ITEMS.map((item) => (
            <li className={`${styles.item} reveal`} key={item.figure}>
              <p className={styles.figure}>{item.figure}</p>
              <p className={styles.text}>{item.text}</p>
              <p className={`eyebrow ${styles.source}`}>{item.source}</p>
            </li>
          ))}
        </ul>
        <p className={styles.disclaimer}>{STUDIES_DISCLAIMER}</p>
      </div>
    </section>
  );
}

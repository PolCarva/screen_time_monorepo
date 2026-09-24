import Link from "next/link";

import { stagger } from "@/components/motion/stagger";
import type { FaqEntry } from "@/lib/landing-content";

import styles from "./faq.module.css";

/** Native disclosures: they open without JavaScript and stay crawlable (D10). */
export function Faq({ items }: { items: FaqEntry[] }) {
  return (
    <section aria-labelledby="faq-title" className={styles.section} id="preguntas">
      <div className={`shell ${styles.grid}`}>
        <div className={styles.heading}>
          <p className="eyebrow">Preguntas</p>
          <h2 className="section-title" data-reveal="mask" id="faq-title">
            Preguntas frecuentes
          </h2>
          <p>
            ¿No encuentras la respuesta?{" "}
            <Link className="underline-link" href="/soporte">
              Escríbenos en Soporte
            </Link>
            .
          </p>
        </div>
        <div className={styles.list}>
          {items.map((item, index) => (
            <details
              className={styles.item}
              data-reveal=""
              key={item.question}
              open={index === 0}
              style={stagger(Math.min(index, 5))}
            >
              <summary>{item.question}</summary>
              <div className={styles.answer}>
                <p>{item.answer}</p>
                {item.link ? (
                  <Link className="underline-link" href={item.link.href}>
                    {item.link.label}
                  </Link>
                ) : null}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

import styles from "./why-second.module.css";

const STAGES = [
  { label: "00 · Gesto", title: "La mano abre la app", text: "antes de que aparezca una intención." },
  { label: "01 · Pausa", title: "Still aparece", text: "y te muestra cuántas veces entraste hoy.", on: true },
  {
    label: "10 · Decisión",
    title: "Cualquier camino suma",
    text: "vuelves con tu tiempo, o entras y tu anuncio aporta al fondo.",
  },
];

export function WhySecond() {
  return (
    <section aria-labelledby="why-second-title" className={styles.section}>
      <div className={`shell ${styles.grid}`}>
        <div className={styles.copy}>
          <p className="eyebrow">Por qué un segundo</p>
          <h2 className="section-title" id="why-second-title">
            Casi nadie te pide abrir esa app. Lo hace la mano.
          </h2>
          <p className="lead">
            La mayoría de las veces que tomas el celular no hubo notificación:
            fue un gesto. Still no intenta convencerte de nada. Pone un segundo
            entre el gesto y la app para que la intención alcance a la mano.
          </p>
        </div>
        <div className={styles.side}>
          <div className={`${styles.stat} reveal`}>
            <p className={styles.figure}>89 %</p>
            <p className={styles.statText}>
              de las interacciones con el teléfono las empieza la persona, no
              una notificación.
            </p>
            <p className={`eyebrow ${styles.source}`}>
              [3] Computers in Human Behavior · 2021
            </p>
          </div>
          <ol className={styles.stages}>
            {STAGES.map((stage) => (
              <li
                className={`${styles.stage}${stage.on ? ` ${styles.stageOn}` : ""} reveal`}
                key={stage.label}
              >
                <span className={`eyebrow ${styles.stageLabel}`}>{stage.label}</span>
                <span className={styles.stageTitle}>{stage.title}</span>
                <span className={styles.stageText}>{stage.text}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

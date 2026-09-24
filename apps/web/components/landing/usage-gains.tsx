import styles from "./usage-gains.module.css";

const GAINS = [
  { label: "Menos reflejo", figure: "−57 %", text: "aperturas de las apps elegidas tras seis semanas.", ref: "[1]" },
  { label: "Más sueño", figure: "+16 min", text: "para dormir, con 38 % menos redes sociales de noche.", ref: "[2]" },
  { label: "Más foco", figure: "−40 %", text: "actividad en redes durante el horario de clases; la mitad de sesiones.", ref: "[2]" },
  {
    label: "Más intención",
    figure: "13 sem.",
    text: "siguiendo a 1.039 personas: las aperturas se vuelven más intencionales.",
    ref: "[4]",
  },
];

const EXAMPLE_APPS = [
  ["Instagram", "7 aperturas · 3 evitadas"],
  ["TikTok", "4 aperturas · 2 evitadas"],
  ["YouTube", "2 aperturas · 1 evitada"],
];

export function UsageGains() {
  return (
    <section aria-labelledby="gains-title" className={styles.section}>
      <div className={`shell ${styles.inner}`}>
        <div className={styles.top}>
          <div className={styles.heading}>
            <p className="eyebrow">Lo que ganas tú</p>
            <h2 className="section-title" id="gains-title">
              Lo que cambia cuando aparece la pausa.
            </h2>
          </div>
          <p className="lead">
            Resultados medidos en estudios sobre pausas antes de abrir una app.
            Tu propio cambio lo ves en Still, día a día.
          </p>
        </div>
        <div className={styles.body}>
          <ul className={styles.cards}>
            {GAINS.map((gain) => (
              <li className={`${styles.card} reveal`} key={gain.label}>
                <span className={`eyebrow ${styles.cardLabel}`}>{gain.label}</span>
                <span className={styles.figure}>{gain.figure}</span>
                <span className={styles.cardText}>{gain.text}</span>
                <span className={`eyebrow ${styles.ref}`}>{gain.ref}</span>
              </li>
            ))}
          </ul>
          <figure className={`${styles.today} reveal`}>
            <div className={styles.todayTop}>
              <span className="eyebrow">Hoy · en Still</span>
              <span className={`eyebrow ${styles.chip}`}>Ejemplo</span>
            </div>
            <p className={styles.todayTitle}>Un registro, no un puntaje.</p>
            <dl className={styles.metrics}>
              <div className={styles.metric}>
                <dt>tiempo ahorrado estimado</dt>
                <dd>38 min</dd>
              </div>
              <div className={styles.metric}>
                <dt>entradas evitadas</dt>
                <dd>6</dd>
              </div>
            </dl>
            <ul className={styles.apps}>
              {EXAMPLE_APPS.map(([app, detail]) => (
                <li key={app}>
                  <span>{app}</span>
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
            <figcaption className={styles.todayNote}>
              Sin rachas ni notas: cuántas veces se abrió cada app, cuántas
              elegiste no entrar y el tiempo que recuperaste.
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}

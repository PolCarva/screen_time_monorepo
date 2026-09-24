import styles from "./why-still.module.css";

const ICON_PROPS = {
  "aria-hidden": true,
  fill: "none",
  height: 26,
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  strokeWidth: 1.8,
  viewBox: "0 0 24 24",
  width: 26,
};

const REASONS = [
  {
    title: "Nunca quedas bloqueado",
    text: "Si no hay anuncio ni pase guardado, una pausa breve te deja entrar igual.",
    icon: (
      <svg {...ICON_PROPS}>
        <rect height="11" rx="2" width="16" x="4" y="10" />
        <path d="M8 10V7a4 4 0 0 1 7.5-2" />
      </svg>
    ),
  },
  {
    title: "Tú eliges cuánto",
    text: "Si entras, eliges el tiempo. Cuando termina, vuelve la pausa.",
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2.5 2.5" />
        <path d="M9 2h6" />
      </svg>
    ),
  },
  {
    title: "Sin rachas ni culpa",
    text: "Sin puntajes ni mensajes que juzguen tu día. Un registro, no una nota.",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M4 6h16" />
        <path d="M4 12h10" />
        <path d="M4 18h13" />
      </svg>
    ),
  },
  {
    title: "Privado por diseño",
    text: "Los nombres de tus apps y tu historial detallado se quedan en tu teléfono.",
    icon: (
      <svg {...ICON_PROPS}>
        <rect height="20" rx="3" width="12" x="6" y="2" />
        <path d="M11 18h2" />
      </svg>
    ),
  },
  {
    title: "Gratis y con propósito",
    text: "Sin suscripción. Los anuncios son opcionales y el 80 % de su ingreso se dona.",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M20 12v9H4v-9" />
        <path d="M2 7h20v5H2z" />
        <path d="M12 21V7" />
        <path d="M12 7C10 3 7 3 7 5s5 2 5 2 5 0 5-2-3-2-5 2" />
      </svg>
    ),
  },
  {
    title: "Sin cuenta obligatoria",
    text: "Tu cuenta es anónima. Apple o Google solo para votar o cambiar de teléfono.",
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
      </svg>
    ),
  },
];

export function WhyStill() {
  return (
    <section aria-labelledby="why-still-title" className={styles.section}>
      <div className={`shell ${styles.inner}`}>
        <div className={styles.heading}>
          <p className="eyebrow">Por qué Still</p>
          <h2 className="section-title" id="why-still-title">
            Hecho para decidir, no para castigarte.
          </h2>
        </div>
        <ul className={styles.grid}>
          {REASONS.map((reason) => (
            <li className={`${styles.item} reveal`} key={reason.title}>
              {reason.icon}
              <h3>{reason.title}</h3>
              <p>{reason.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

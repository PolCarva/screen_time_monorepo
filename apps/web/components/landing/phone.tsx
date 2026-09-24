import type { CSSProperties, ReactNode } from "react";

import styles from "./phone.module.css";

type PhoneProps = {
  size: "lg" | "md";
  tone: "dark" | "light";
  children: ReactNode;
};

/** A phone outline around one of Still's screens, drawn in markup. */
export function Phone({ size, tone, children }: PhoneProps) {
  return (
    <div aria-hidden="true" className={`${styles.frame} ${styles[size]}`}>
      <div className={`${styles.screen} ${styles[tone]}`}>{children}</div>
    </div>
  );
}

const MODULE_ROWS: { y: number; fills: string[] }[] = [
  { y: 0, fills: ["#4E5451", "#697F8C", "#4E5451", "#A7B5BA", "#4E5451"] },
  { y: 22, fills: ["#697F8C", "#4E5451", "#A7B5BA", "#4E5451", "#697F8C"] },
  { y: 98, fills: ["#A7B5BA", "#4E5451", "#697F8C", "#4E5451", "#A7B5BA"] },
  { y: 120, fills: ["#4E5451", "#A7B5BA", "#4E5451", "#697F8C", "#4E5451"] },
];

/** The attention field: rows of modules with the middle row open. */
export function FieldModules() {
  return (
    <svg className={styles.field} viewBox="0 0 262 132">
      {MODULE_ROWS.map((row) =>
        row.fills.map((fill, index) => (
          <rect
            fill={fill}
            height="12"
            key={`${row.y}-${index}`}
            rx="3"
            width="46"
            x={index * 54}
            y={row.y}
          />
        )),
      )}
      <g className={styles.fieldLeft}>
        <rect fill="#4E5451" height="12" rx="3" width="46" x="0" y="60" />
        <rect fill="#697F8C" height="12" rx="3" width="46" x="54" y="60" />
      </g>
      <g className={styles.fieldRight}>
        <rect fill="var(--peach)" height="12" rx="3" width="102" x="160" y="60" />
      </g>
    </svg>
  );
}

/** Still's pause, as it appears before the chosen app opens. */
export function PauseScreen({
  app,
  opens,
  full = false,
}: {
  app: string;
  opens: number;
  full?: boolean;
}) {
  return (
    <>
      <p className={styles.label}>{app}</p>
      <FieldModules />
      <p className={styles.headline}>{`${app} se abrió\n${opens} veces hoy.`}</p>
      <p className={styles.question}>Si entras, eliges por cuánto tiempo.</p>
      <div className={styles.actions}>
        <span className={styles.primary}>Ya no quiero entrar</span>
        <span className={styles.secondary}>Ver anuncio</span>
      </div>
      {full ? <p className={styles.footnote}>Entrar también es una elección.</p> : null}
    </>
  );
}

const APPS: [string, boolean][] = [
  ["Instagram", true],
  ["TikTok", true],
  ["YouTube", true],
  ["X", false],
  ["Reddit", false],
];

export function ChooseAppsScreen() {
  return (
    <>
      <p className={styles.label}>Apps con pausa</p>
      <p className={styles.title}>¿Cuáles abres sin pensar?</p>
      <ul className={styles.list}>
        {APPS.map(([name, on], index) => (
          <li className={styles.row} key={name}>
            <span>{name}</span>
            <span
              className={`${styles.toggle}${on ? ` ${styles.toggleOn}` : ""}`}
              style={{ "--row": index } as CSSProperties}
            />
          </li>
        ))}
      </ul>
      <div className={styles.actions}>
        <span className={styles.primary}>Continuar · 3 apps</span>
      </div>
    </>
  );
}

const SETUP = {
  android: {
    title: "Activa Still en Accesibilidad",
    steps: [
      "Abre Ajustes → Accesibilidad",
      "Apps descargadas → Still",
      "Activa «Usar Still» y toca Permitir",
    ],
    note: "Still solo lo usa para saber cuándo se abre una de tus apps y mostrar la pausa.",
    action: "Abrir Ajustes",
  },
  ios: {
    title: "Crea una automatización en Atajos",
    steps: [
      "Atajos → Automatización → Automatización personal",
      "App → Instagram → «Se abra» → Ejecutar de inmediato",
      "Acción: «Pausar antes de abrir»",
    ],
    note: "Still te guía paso a paso y nunca crea ni lee tus automatizaciones.",
    action: "Abrir Atajos",
  },
} as const;

export function SetupScreen({ platform }: { platform: "android" | "ios" }) {
  const setup = SETUP[platform];
  return (
    <>
      <p className={styles.label}>Paso 2 de 3</p>
      <p className={styles.title}>{setup.title}</p>
      <ol className={styles.list}>
        {setup.steps.map((step, index) => (
          <li className={styles.step} key={step} style={{ "--row": index } as CSSProperties}>
            <span>{index + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <p className={styles.note}>{setup.note}</p>
      <div className={styles.actions}>
        <span className={styles.primary}>{setup.action}</span>
      </div>
    </>
  );
}

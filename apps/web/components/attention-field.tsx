import type { CSSProperties } from "react";

type AttentionFieldProps = {
  kind?: "progress" | "intervention" | "impact";
  values?: number[];
  label: string;
  passes?: number;
  dark?: boolean;
};

export function AttentionField({ kind = "progress", values = [], label, passes = 0, dark = false }: AttentionFieldProps) {
  if (kind === "intervention") {
    return (
      <div aria-label={label} className={`field field--intervention${dark ? " is-dark" : ""}`} role="img">
        <div className="field-half field-half--left" aria-hidden="true">
          {Array.from({ length: 18 }).map((_, index) => <i className={index === 11 ? "is-choice-mineral" : ""} key={index} />)}
        </div>
        <span className="field-aperture" aria-hidden="true" />
        <div className="field-half field-half--right" aria-hidden="true">
          {Array.from({ length: 18 }).map((_, index) => <i className={index === 9 ? "is-choice-peach" : ""} key={index} />)}
        </div>
      </div>
    );
  }

  if (kind === "impact") {
    const source = values.slice(0, 10);
    if (source.length === 0) {
      return (
        <div
          aria-label={label}
          className="field field--impact field--empty"
          role="img"
        />
      );
    }
    const maximum = Math.max(...source, 1);
    return (
      <div aria-label={label} className="field field--impact" role="img">
        {source.map((value, index) => (
          <i
            className={index === source.length - 1 ? "is-choice-peach" : ""}
            key={index}
            style={{ "--field-height": `${20 + (value / maximum) * 80}%`, "--field-index": index } as CSSProperties}
          />
        ))}
      </div>
    );
  }

  const normalized = values.length === 7 ? values : Array(7).fill(0);
  const maximum = Math.max(...normalized, 1);
  return (
    <div aria-label={label} className="field field--progress" role="img">
      {normalized.map((value, day) => {
        const active = value === 0 ? 0 : Math.max(1, Math.round((value / maximum) * 5));
        return (
          <span className="field-day" key={day} aria-hidden="true">
            {Array.from({ length: 5 }).map((_, module) => <i className={`${module < active ? "is-active" : ""}${day === 6 && passes > 0 && module === Math.min(active, 4) ? " is-choice-peach" : ""}`} key={module} />)}
          </span>
        );
      })}
    </div>
  );
}

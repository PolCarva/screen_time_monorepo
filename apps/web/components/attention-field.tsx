import type { CSSProperties } from "react";

type AttentionFieldProps = {
  values?: number[];
  label: string;
};

/** The impact field: one module per recent week, the latest in peach. */
export function AttentionField({ values = [], label }: AttentionFieldProps) {
  const source = values.slice(0, 10);
  if (source.length === 0) {
    return (
      <div aria-label={label} className="field field--impact field--empty" role="img" />
    );
  }
  const maximum = Math.max(...source, 1);
  return (
    <div aria-label={label} className="field field--impact" role="img">
      {source.map((value, index) => (
        <i
          className={index === source.length - 1 ? "is-choice-peach" : ""}
          key={index}
          style={
            {
              "--field-height": `${20 + (value / maximum) * 80}%`,
              "--field-index": index,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

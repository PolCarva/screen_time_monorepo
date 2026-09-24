import type { CSSProperties } from "react";

/** Position in a staggered reveal: each step waits 90 ms more (globals.css). */
export function stagger(index: number, extra?: CSSProperties): CSSProperties {
  return { "--stagger": index, ...extra } as CSSProperties;
}

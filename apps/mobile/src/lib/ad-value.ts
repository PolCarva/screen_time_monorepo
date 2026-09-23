import type { AdValue } from "@screen-time/contracts";

/**
 * How both SDKs number an impression's precision: Android's
 * `AdValue.PrecisionType` and iOS's `GADAdValuePrecision` agree on 0 unknown,
 * 1 estimated, 2 publisher provided, 3 precise.
 */
const PRECISIONS: Record<number, AdValue["precision"]> = {
  0: "unknown",
  1: "estimated",
  2: "publisher_provided",
  3: "precise",
};

/** Largest value the claim accepts; the server caps what it counts far lower. */
const MAX_VALUE_MICROS = 10_000_000;

/**
 * What one impression paid, as the claim sends it (impression-level ad
 * revenue). Anything the SDK sent that is not a usable amount is dropped, and
 * the server then falls back to the eCPM (docs/real-impact-stats-plan.md, D5).
 */
export function adValueFromMicros(
  valueMicros: number,
  currency: string | null | undefined,
  precision: number,
): AdValue | undefined {
  if (!Number.isFinite(valueMicros) || valueMicros < 0) return undefined;
  const code = String(currency ?? "").toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return undefined;
  return {
    valueMicros: Math.min(MAX_VALUE_MICROS, Math.round(valueMicros)),
    currency: code,
    precision: PRECISIONS[Math.round(precision)] ?? "unknown",
  };
}

/** The React Native paid event reports the value in currency units. */
export function adValueFromPaidEvent(
  event: { value: number; currency: string; precision: number } | null | undefined,
): AdValue | undefined {
  if (!event) return undefined;
  return adValueFromMicros(event.value * 1_000_000, event.currency, event.precision);
}

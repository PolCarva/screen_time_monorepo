import { formatFund, formatReturnedTime } from "@/components/impact-card";
import type { PublicImpact } from "@/lib/impact";

const count = new Intl.NumberFormat("es");

/**
 * The live totals in words. A total that is still zero shows when it will
 * exist instead of a zero that reads like a failure (D17).
 */
export function liveNumbers(impact: PublicImpact) {
  const allTime = impact.state === "ready" ? impact.week.allTime : null;
  const currency = impact.state === "ready" ? impact.week.currency : "USD";
  return {
    returned:
      allTime && allTime.minutesReturned > 0
        ? formatReturnedTime(allTime.minutesReturned)
        : null,
    donated:
      allTime && allTime.donatedMinor > 0
        ? formatFund(allTime.donatedMinor, currency)
        : null,
    people: allTime && allTime.people > 0 ? count.format(allTime.people) : null,
  };
}

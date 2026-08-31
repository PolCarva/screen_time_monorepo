import { ApiError } from "./api-error";

export function isMissingImpactWeekError(error: unknown): boolean {
  return error instanceof ApiError && error.code === "impact_week_not_found";
}

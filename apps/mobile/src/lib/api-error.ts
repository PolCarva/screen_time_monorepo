export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * The API answered from another host. Clients drop the Authorization header
 * when a redirect changes host, so every signed-in call came back 401 when
 * Vercel redirected the whole vercel.app domain (docs/app-store-review-plan.md §13).
 */
export const API_REDIRECTED = "api_redirected";

export async function apiErrorFromResponse(
  response: Response,
): Promise<ApiError> {
  try {
    const body = (await response.clone().json()) as {
      error?: { code?: unknown; message?: unknown };
    };
    if (
      typeof body.error?.code === "string" &&
      typeof body.error.message === "string"
    ) {
      return new ApiError(response.status, body.error.code, body.error.message);
    }
  } catch {
    // Non-JSON upstream responses still get a stable, non-sensitive error.
  }
  return new ApiError(
    response.status,
    "http_error",
    `Request failed with status ${response.status}`,
  );
}

/** True when the response came from another origin than the one requested. */
export function answeredFromAnotherHost(
  requestUrl: string,
  responseUrl: string | null | undefined,
): boolean {
  if (!responseUrl) return false;
  try {
    return new URL(responseUrl).origin !== new URL(requestUrl).origin;
  } catch {
    return false;
  }
}

/**
 * Why a request failed, in the terms the app shows: no connection, a session
 * the server did not accept (a 401, or a redirect that dropped the token), or
 * anything else on the server's side.
 */
export type RequestFailure = "offline" | "session" | "server";

export function requestFailure(error: unknown): RequestFailure {
  if (error instanceof ApiError) {
    if (error.status === 0) return "offline";
    if (error.status === 401 || error.code === API_REDIRECTED) return "session";
    return "server";
  }
  // fetch rejects with a TypeError when there is no network, and Supabase's
  // auth client wraps that same failure in AuthRetryableFetchError.
  if (error instanceof TypeError) return "offline";
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? String(error.name)
      : "";
  if (name === "AuthRetryableFetchError") return "offline";
  if (name.startsWith("Auth")) return "session";
  return "server";
}

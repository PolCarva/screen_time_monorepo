import { z } from "zod";

import { ApiError, apiErrorFromResponse } from "@/lib/api-error";
import { ensureAnonymousSession } from "@/lib/supabase";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";
const REQUEST_TIMEOUT_MS = 15_000;

export async function apiFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const response = await apiRequest(path, init);
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success)
    throw new ApiError(
      502,
      "invalid_response",
      "The server returned an invalid response",
    );
  return parsed.data;
}

export { ApiError } from "@/lib/api-error";

export async function apiRequest(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  if (init?.signal?.aborted) controller.abort();
  else init?.signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let rejectOnAbort: ((reason: ApiError) => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    rejectOnAbort = reject;
  });
  const rejectAborted = () =>
    rejectOnAbort?.(
      new ApiError(
        0,
        "request_timeout",
        "The request timed out or was cancelled",
      ),
    );
  if (controller.signal.aborted) rejectAborted();
  else
    controller.signal.addEventListener("abort", rejectAborted, { once: true });
  try {
    // Authentication is part of the request deadline too. A slow session
    // refresh must not leave the UI waiting forever before fetch even starts.
    const session = await Promise.race([ensureAnonymousSession(), aborted]);
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        accept: "application/json",
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...(session ? { authorization: `Bearer ${session.access_token}` } : {}),
        ...init?.headers,
      },
    });
    if (!response.ok) throw await apiErrorFromResponse(response);
    return response;
  } catch (error) {
    if (controller.signal.aborted && !(error instanceof ApiError)) {
      throw new ApiError(
        0,
        "request_timeout",
        "The request timed out or was cancelled",
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    controller.signal.removeEventListener("abort", rejectAborted);
    init?.signal?.removeEventListener("abort", abortFromCaller);
  }
}

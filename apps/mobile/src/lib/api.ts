import { z } from "zod";

import {
  API_REDIRECTED,
  ApiError,
  answeredFromAnotherHost,
  apiErrorFromResponse,
} from "@/lib/api-error";
import {
  ensureAnonymousSession,
  refreshSessionAfterRefusal,
} from "@/lib/supabase";

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
    const url = `${API_URL}${path}`;
    const send = (accessToken: string | undefined) =>
      fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          accept: "application/json",
          ...(init?.body ? { "content-type": "application/json" } : {}),
          ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
          ...init?.headers,
        },
      });
    let response = await send(session?.access_token);
    const redirected = answeredFromAnotherHost(url, response.url);
    if (response.status === 401 && session && !redirected) {
      // A token the server refused is refreshed once; the server rejects the
      // request before doing anything, so asking again is safe.
      const refreshed = await Promise.race([
        refreshSessionAfterRefusal(),
        aborted,
      ]);
      if (refreshed) response = await send(refreshed.access_token);
    }
    if (!response.ok) {
      if (redirected)
        throw new ApiError(
          response.status,
          API_REDIRECTED,
          "The API answered from another address",
        );
      throw await apiErrorFromResponse(response);
    }
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

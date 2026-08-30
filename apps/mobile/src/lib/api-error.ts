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

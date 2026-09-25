import { type ZodType } from "zod";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export async function parseJson<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "invalid_json", "Request body must be valid JSON");
  }
  return parseBody(body, schema);
}

/**
 * Like `parseJson`, for routes whose older clients send no body at all: an
 * empty body is validated as `{}`.
 */
export async function parseOptionalJson<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<T> {
  const text = await request.text();
  if (text.trim() === "") return parseBody({}, schema);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new HttpError(400, "invalid_json", "Request body must be valid JSON");
  }
  return parseBody(body, schema);
}

function parseBody<T>(body: unknown, schema: ZodType<T>): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new HttpError(
      400,
      "validation_error",
      "Request validation failed",
      result.error.flatten(),
    );
  }
  return result.data;
}

export function requireIdempotencyKey(request: Request): string {
  const value = request.headers.get("idempotency-key")?.trim();
  if (!value || value.length > 128) {
    throw new HttpError(
      400,
      "idempotency_key_required",
      "A valid Idempotency-Key header is required",
    );
  }
  return value;
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  return Response.json(data, {
    ...init,
    headers: {
      "cache-control": "no-store",
      ...init.headers,
    },
  });
}

type DatabaseRule = readonly [
  needle: string,
  status: number,
  code: string,
  message: string,
];

export function databaseHttpError(
  databaseMessage: string,
  rules: readonly DatabaseRule[],
  fallback: { status: number; code: string; message: string },
): HttpError {
  const match = rules.find(([needle]) => databaseMessage.includes(needle));
  return match
    ? new HttpError(match[1], match[2], match[3])
    : new HttpError(fallback.status, fallback.code, fallback.message);
}

export function routeError(error: unknown): Response {
  const requestId = crypto.randomUUID();
  if (error instanceof HttpError) {
    return json(
      {
        error: {
          code: error.code,
          message: error.message,
          requestId,
          details: error.details,
        },
      },
      { status: error.status },
    );
  }
  console.error("Unhandled route error", { requestId, error });
  return json(
    {
      error: {
        code: "internal_error",
        message: "An unexpected error occurred",
        requestId,
      },
    },
    { status: 500 },
  );
}

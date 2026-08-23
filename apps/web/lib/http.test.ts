import { describe, expect, it } from "vitest";
import { z } from "zod";

import { HttpError, parseJson, requireIdempotencyKey, routeError } from "./http";

describe("HTTP boundary", () => {
  it("validates JSON with the route schema", async () => {
    const request = new Request("https://still.test/api", {
      method: "POST",
      body: JSON.stringify({ count: 3 }),
    });
    await expect(parseJson(request, z.object({ count: z.number().int().positive() }))).resolves.toEqual({ count: 3 });
  });

  it("rejects invalid request bodies without exposing internals", async () => {
    const request = new Request("https://still.test/api", { method: "POST", body: "{}" });
    await expect(parseJson(request, z.object({ count: z.number() }))).rejects.toMatchObject({
      status: 400,
      code: "validation_error",
    });
  });

  it("requires bounded idempotency keys", () => {
    expect(requireIdempotencyKey(new Request("https://still.test", { headers: { "idempotency-key": "reward:123" } }))).toBe("reward:123");
    expect(() => requireIdempotencyKey(new Request("https://still.test"))).toThrow(HttpError);
  });

  it("returns the stable API error envelope", async () => {
    const response = routeError(new HttpError(409, "conflict", "Already processed"));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "conflict", message: "Already processed" },
    });
  });
});

import { describe, expect, it } from "vitest";

import { apiErrorFromResponse } from "./api-error";

describe("mobile API errors", () => {
  it("reads the stable server error envelope", async () => {
    const error = await apiErrorFromResponse(
      Response.json(
        { error: { code: "conflict", message: "Already processed" } },
        { status: 409 },
      ),
    );
    expect(error).toMatchObject({
      status: 409,
      code: "conflict",
      message: "Already processed",
    });
  });

  it("does not expose arbitrary non-JSON upstream bodies", async () => {
    const error = await apiErrorFromResponse(
      new Response("proxy internals", { status: 502 }),
    );
    expect(error).toMatchObject({
      status: 502,
      code: "http_error",
      message: "Request failed with status 502",
    });
  });
});

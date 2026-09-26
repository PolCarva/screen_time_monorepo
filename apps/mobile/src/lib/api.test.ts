import { describe, expect, it } from "vitest";

import {
  API_REDIRECTED,
  ApiError,
  answeredFromAnotherHost,
  apiErrorFromResponse,
  requestFailure,
} from "./api-error";

describe("request failures", () => {
  it("tells a missing connection from a refused session", () => {
    expect(requestFailure(new TypeError("Network request failed"))).toBe(
      "offline",
    );
    expect(
      requestFailure(new ApiError(0, "request_timeout", "timed out")),
    ).toBe("offline");
    expect(
      requestFailure(
        Object.assign(new Error("fetch failed"), {
          name: "AuthRetryableFetchError",
        }),
      ),
    ).toBe("offline");
    expect(
      requestFailure(new ApiError(401, "unauthorized", "A valid bearer token")),
    ).toBe("session");
    expect(
      requestFailure(new ApiError(401, API_REDIRECTED, "another address")),
    ).toBe("session");
    expect(
      requestFailure(
        Object.assign(new Error("Anonymous sign-ins are disabled"), {
          name: "AuthApiError",
        }),
      ),
    ).toBe("session");
  });

  it("leaves everything else to the server", () => {
    expect(requestFailure(new ApiError(500, "http_error", "boom"))).toBe(
      "server",
    );
    expect(requestFailure(new ApiError(502, "invalid_response", "bad"))).toBe(
      "server",
    );
    expect(requestFailure("something")).toBe("server");
  });

  it("notices an answer from another host", () => {
    const asked = "https://screen-time-monorepo-web.vercel.app/api/v1/config";
    expect(
      answeredFromAnotherHost(asked, "https://get-still.app/api/v1/config"),
    ).toBe(true);
    expect(answeredFromAnotherHost(asked, asked)).toBe(false);
    expect(answeredFromAnotherHost(asked, "")).toBe(false);
    expect(answeredFromAnotherHost(asked, undefined)).toBe(false);
    expect(answeredFromAnotherHost(asked, "not a url")).toBe(false);
  });
});

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

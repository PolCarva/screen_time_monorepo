/// <reference types="node" />

import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const decodeUriComponent = require("decode-uri-component") as (
  input: string,
) => string;

describe("patched URI decoder", () => {
  it("preserves the dependency's expected decoding behavior", () => {
    expect(decodeUriComponent("hello+world")).toBe("hello world");
    expect(decodeUriComponent("%E2%9C%93")).toBe("✓");
    expect(decodeUriComponent("%E2%9C%93%AA")).toBe("✓%AA");
  });

  it("handles long malformed inputs in bounded linear time", () => {
    const input = "%AA".repeat(10_000);
    const startedAt = performance.now();

    expect(decodeUriComponent(input)).toBe(input);
    expect(performance.now() - startedAt).toBeLessThan(250);
  });
});

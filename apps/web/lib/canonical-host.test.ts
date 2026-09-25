import { describe, expect, it } from "vitest";

import { canonicalRedirect } from "./canonical-host";

const SITE = "https://get-still.app";
const vercel = (path: string) =>
  new URL(`https://screen-time-monorepo-web.vercel.app${path}`);

describe("canonical host", () => {
  it("moves pages from the production vercel.app address to the site", () => {
    expect(canonicalRedirect(vercel("/privacy?x=1"), SITE, "production")?.href).toBe(
      "https://get-still.app/privacy?x=1",
    );
    expect(canonicalRedirect(vercel("/"), SITE, "production")?.href).toBe(
      "https://get-still.app/",
    );
  });

  it("never redirects what shipped apps and ad networks call", () => {
    for (const path of [
      "/api/v1/privacy/delete",
      "/api/v1/config",
      "/app-ads.txt",
      "/.well-known/apple-app-site-association",
    ])
      expect(canonicalRedirect(vercel(path), SITE, "production")).toBeNull();
  });

  it("leaves the site itself, previews and local runs alone", () => {
    expect(
      canonicalRedirect(new URL("https://get-still.app/privacy"), SITE, "production"),
    ).toBeNull();
    expect(canonicalRedirect(vercel("/privacy"), SITE, "preview")).toBeNull();
    expect(
      canonicalRedirect(new URL("http://localhost:3000/privacy"), SITE, undefined),
    ).toBeNull();
  });
});

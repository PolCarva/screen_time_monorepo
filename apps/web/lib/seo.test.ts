import { describe, expect, it } from "vitest";

import { PUBLIC_ROUTES } from "./routes";
import { pageMetadata } from "./seo";

describe("pageMetadata", () => {
  it("gives each page its own canonical and a complete Open Graph object", () => {
    const metadata = pageMetadata({
      path: "/guias/dejar-de-scrollear",
      title: "Cómo dejar de scrollear | Still",
      description: "Una guía.",
      type: "article",
      publishedTime: "2026-09-24",
    });

    expect(metadata.title).toEqual({ absolute: "Cómo dejar de scrollear | Still" });
    expect(metadata.alternates?.canonical).toBe("/guias/dejar-de-scrollear");
    expect(metadata.openGraph).toMatchObject({
      title: "Cómo dejar de scrollear | Still",
      description: "Una guía.",
      url: "/guias/dejar-de-scrollear",
      siteName: "Still",
      locale: "es_LA",
      type: "article",
      publishedTime: "2026-09-24",
      modifiedTime: "2026-09-24",
    });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
    expect(metadata.robots).toBeUndefined();
  });

  it("names the share image: the page's own, else the home page's", () => {
    const own = pageMetadata({
      path: "/investigacion",
      title: "T",
      description: "D",
      image: "/investigacion/opengraph-image",
    });
    const fallback = pageMetadata({ path: "/terms", title: "T", description: "D" });
    expect(own.openGraph?.images).toEqual([
      expect.objectContaining({ url: "/investigacion/opengraph-image", width: 1200 }),
    ]);
    expect(fallback.openGraph?.images).toEqual([
      expect.objectContaining({ url: "/opengraph-image" }),
    ]);
    expect(fallback.twitter?.images).toEqual(fallback.openGraph?.images);
  });

  it("keeps a noindex page out of the index but followable", () => {
    expect(
      pageMetadata({ path: "/x", title: "X", description: "Y", noindex: true })
        .robots,
    ).toEqual({ index: false, follow: true });
  });
});

describe("public routes", () => {
  it("are unique, rooted and dated", () => {
    const paths = PUBLIC_ROUTES.map((route) => route.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const route of PUBLIC_ROUTES) {
      expect(route.path.startsWith("/")).toBe(true);
      expect(route.path === "/" || !route.path.endsWith("/")).toBe(true);
      expect(route.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

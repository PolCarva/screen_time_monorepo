import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  JsonLd,
  article,
  breadcrumbs,
  faqPage,
  graph,
  mobileApplication,
  organization,
  serializeJsonLd,
  website,
} from "./structured-data";

describe("structured data", () => {
  it("serializes to valid JSON that cannot close its script tag", () => {
    const data = graph(
      faqPage([{ question: "¿</script>?", answer: "<b>No</b>" }]),
    );
    const json = serializeJsonLd(data);
    expect(json).not.toContain("<");
    expect(JSON.parse(json)).toEqual(data);
    const html = renderToStaticMarkup(<JsonLd data={data} />);
    expect(html.startsWith('<script type="application/ld+json">')).toBe(true);
    expect(html.match(/<\/script>/g)).toHaveLength(1);
  });

  it("describes the app without ratings or reviews", () => {
    const app = mobileApplication("Una pausa antes de entrar.");
    const json = JSON.stringify(graph(organization(), website(), app));
    expect(json).not.toMatch(/aggregateRating|"review"/i);
    expect(app).toMatchObject({
      "@type": "MobileApplication",
      offers: { price: "0" },
      operatingSystem: "Android 10+, iOS 16.4+",
    });
    // Neither store is public yet, so no install link is promised.
    expect(app).not.toHaveProperty("installUrl");
  });

  it("builds articles and breadcrumbs with absolute URLs", () => {
    const node = article({
      path: "/investigacion",
      headline: "Qué dice la investigación",
      description: "Estudios.",
      datePublished: "2026-09-24",
      citations: [{ name: "Estudio", url: "https://doi.org/x" }],
    });
    expect(node).toMatchObject({
      "@type": "Article",
      dateModified: "2026-09-24",
      mainEntityOfPage: expect.stringMatching(/^https?:\/\/.+\/investigacion$/),
      citation: [{ "@type": "ScholarlyArticle", url: "https://doi.org/x" }],
    });
    const trail = breadcrumbs([
      { name: "Inicio", path: "/" },
      { name: "Guías", path: "/guias" },
    ]);
    expect(trail).toMatchObject({
      itemListElement: [
        { position: 1, item: expect.stringMatching(/\/$/) },
        { position: 2, item: expect.stringMatching(/\/guias$/) },
      ],
    });
  });
});

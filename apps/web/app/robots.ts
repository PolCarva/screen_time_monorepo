import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

// Every crawler is welcome, AI search bots included (docs/landing-seo-plan.md, D22).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

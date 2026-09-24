import type { MetadataRoute } from "next";

import { PUBLIC_ROUTES } from "@/lib/routes";
import { absoluteUrl } from "@/lib/structured-data";

// Google ignores changefreq and priority; lastModified is what it reads.
export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: route.lastModified,
  }));
}

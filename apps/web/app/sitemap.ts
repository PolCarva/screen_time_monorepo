import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://still.app";
  return [
    { url: siteUrl, changeFrequency: "monthly", priority: 1 },
    { url: `${siteUrl}/impact`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/privacy`, changeFrequency: "yearly", priority: 0.4 },
  ];
}

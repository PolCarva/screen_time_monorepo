import type { Metadata } from "next";

import { SITE_NAME } from "@/lib/site";

/** Meta reads `es_LA` for Latin American Spanish; `es_419` is not a Facebook locale. */
export const OG_LOCALE = "es_LA";

/**
 * A page that defines its own `openGraph` stops inheriting the root share
 * image, and an explicit image also wins over a segment's `opengraph-image`
 * file, so every page names the image it uses: its own route when it has
 * one, the home page's otherwise.
 */
function shareImage(path: string | undefined, alt: string) {
  return { url: path ?? "/opengraph-image", width: 1200, height: 630, alt };
}

export type PageMetadataInput = {
  /** Path from the site root, e.g. "/guias/dejar-de-scrollear". */
  path: string;
  /** The whole `<title>`, brand included: it is used as is. */
  title: string;
  description: string;
  type?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
  noindex?: boolean;
  /** Path of the page's own `opengraph-image`, when it has one. */
  image?: string;
};

/**
 * One page's metadata. Next merges `openGraph` shallowly, so every page sends
 * the whole object; otherwise a subpage would share the home page's preview
 * (docs/landing-seo-plan.md, D19).
 */
export function pageMetadata(input: PageMetadataInput): Metadata {
  const type = input.type ?? "website";
  const image = shareImage(input.image, input.title);
  return {
    title: { absolute: input.title },
    description: input.description,
    alternates: { canonical: input.path },
    openGraph: {
      title: input.title,
      description: input.description,
      url: input.path,
      siteName: SITE_NAME,
      locale: OG_LOCALE,
      images: [image],
      ...(type === "article"
        ? {
            type: "article" as const,
            publishedTime: input.publishedTime,
            modifiedTime: input.modifiedTime ?? input.publishedTime,
          }
        : { type: "website" as const }),
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [image],
    },
    ...(input.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

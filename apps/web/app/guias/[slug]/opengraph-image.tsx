import { GUIDES, GUIDE_SLUGS, type GuideSlug } from "@/content/guides";
import { CONTENT_PAGES } from "@/lib/content-pages";
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og-image";

export const alt = "Guía de Still para usar menos el celular";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return GUIDE_SLUGS.map((slug) => ({ slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = CONTENT_PAGES[GUIDES[slug as GuideSlug].page];
  return renderOgImage({ eyebrow: page.eyebrow, title: page.h1 });
}

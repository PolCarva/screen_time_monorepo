import type { Metadata } from "next";

import { Article } from "@/components/content/article";
import { GUIDES, GUIDE_SLUGS, type GuideSlug } from "@/content/guides";
import { CONTENT_PAGES } from "@/lib/content-pages";
import { pageMetadata } from "@/lib/seo";

// Only the guides that exist; any other slug is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDE_SLUGS.map((slug) => ({ slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = CONTENT_PAGES[GUIDES[slug as GuideSlug].page];
  return pageMetadata({
    path: page.path,
    title: page.title,
    description: page.description,
    type: "article",
    publishedTime: page.published,
    modifiedTime: page.updated,
    image: `${page.path}/opengraph-image`,
  });
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = GUIDES[slug as GuideSlug];
  const page = CONTENT_PAGES[guide.page];
  return (
    <Article
      crumbs={[
        { name: "Inicio", path: "/" },
        { name: "Guías", path: "/guias" },
        { name: page.name, path: page.path },
      ]}
      description={page.description}
      eyebrow={page.eyebrow}
      lead={guide.lead}
      path={page.path}
      published={page.published}
      related={guide.related}
      title={page.h1}
      toc={guide.toc}
      updated={page.updated}
    >
      {guide.body}
    </Article>
  );
}

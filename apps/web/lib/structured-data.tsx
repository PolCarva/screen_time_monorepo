import {
  CONTACT_EMAIL,
  REQUIREMENTS,
  SITE_NAME,
  SITE_URL,
  liveStoreUrls,
} from "@/lib/site";

/**
 * schema.org nodes for the public pages (docs/landing-seo-plan.md, D9). No
 * ratings: Google only shows the app rich result with real ones, and invented
 * ratings break its review guidelines.
 */
export type JsonLdNode = Record<string, unknown>;

export function absoluteUrl(path: string): string {
  return path === "/" ? `${SITE_URL}/` : `${SITE_URL}${path}`;
}

const ORG_ID = `${SITE_URL}/#org`;
const LANGUAGE = "es-419";

export function organization(): JsonLdNode {
  const sameAs = liveStoreUrls();
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: SITE_NAME,
    url: absoluteUrl("/"),
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl("/icons/icon-512.png"),
      width: 512,
      height: 512,
    },
    email: CONTACT_EMAIL,
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };
}

export function website(): JsonLdNode {
  return {
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    alternateName: "Still: pausa antes de abrir apps",
    url: absoluteUrl("/"),
    inLanguage: LANGUAGE,
    publisher: { "@id": ORG_ID },
  };
}

export function mobileApplication(description: string): JsonLdNode {
  const stores = liveStoreUrls();
  return {
    "@type": "MobileApplication",
    "@id": `${SITE_URL}/#app`,
    name: SITE_NAME,
    alternateName: "Still: pausa antes de entrar",
    description,
    applicationCategory: "LifestyleApplication",
    operatingSystem: `${REQUIREMENTS.android.replace(" o posterior", "+")}, ${REQUIREMENTS.ios.replace(" o posterior", "+")}`,
    inLanguage: LANGUAGE,
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    publisher: { "@id": ORG_ID },
    ...(stores.length > 0 ? { installUrl: stores[0], sameAs: stores } : {}),
  };
}

export type FaqItem = { question: string; answer: string };

/** Same text as the visible FAQ. Google shows no rich result for it any more; Bing and LLMs read it. */
export function faqPage(items: FaqItem[]): JsonLdNode {
  return {
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

export type Citation = { name: string; url: string; author?: string; datePublished?: string; publisher?: string };

export function article(input: {
  path: string;
  headline: string;
  description: string;
  datePublished: string;
  dateModified?: string;
  citations?: Citation[];
}): JsonLdNode {
  return {
    "@type": "Article",
    "@id": `${absoluteUrl(input.path)}#article`,
    headline: input.headline,
    description: input.description,
    inLanguage: LANGUAGE,
    datePublished: input.datePublished,
    dateModified: input.dateModified ?? input.datePublished,
    author: { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
    mainEntityOfPage: absoluteUrl(input.path),
    image: absoluteUrl(`${input.path}/opengraph-image`),
    ...(input.citations && input.citations.length > 0
      ? {
          citation: input.citations.map((citation) => ({
            "@type": "ScholarlyArticle",
            name: citation.name,
            url: citation.url,
            ...(citation.author ? { author: citation.author } : {}),
            ...(citation.datePublished
              ? { datePublished: citation.datePublished }
              : {}),
            ...(citation.publisher
              ? { publisher: { "@type": "Organization", name: citation.publisher } }
              : {}),
          })),
        }
      : {}),
  };
}

export type Crumb = { name: string; path: string };

export function breadcrumbs(items: Crumb[]): JsonLdNode {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/** A hub page's list of links, in order. */
export function itemList(name: string, items: Crumb[]): JsonLdNode {
  return {
    "@type": "ItemList",
    name,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: absoluteUrl(item.path),
    })),
  };
}

export function graph(...nodes: JsonLdNode[]): JsonLdNode {
  return { "@context": "https://schema.org", "@graph": nodes };
}

/** JSON for a `<script>` block: `<` escaped so no text can close the tag. */
export function serializeJsonLd(data: JsonLdNode): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function JsonLd({ data }: { data: JsonLdNode }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}

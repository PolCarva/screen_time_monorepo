import type { ReactNode } from "react";

import type { RelatedLink, TocItem } from "@/components/content/article";
import type { CONTENT_PAGES } from "@/lib/content-pages";

/** One guide under /guias: its copy key, answer-first lead and body. */
export type Guide = {
  page: keyof typeof CONTENT_PAGES;
  lead: ReactNode;
  toc: TocItem[];
  related: RelatedLink[];
  body: ReactNode;
};

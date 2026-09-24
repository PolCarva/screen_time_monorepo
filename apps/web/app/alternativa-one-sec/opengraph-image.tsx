import { CONTENT_PAGES } from "@/lib/content-pages";
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og-image";

const page = CONTENT_PAGES.oneSec;

export const alt = page.h1;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({ eyebrow: page.eyebrow, title: page.h1 });
}

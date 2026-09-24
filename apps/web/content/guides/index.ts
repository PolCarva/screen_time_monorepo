import { CONTENT_PAGES } from "@/lib/content-pages";

import { scrollingGuide } from "./dejar-de-scrollear";
import { screenTimeGuide } from "./reducir-tiempo-de-pantalla";
import type { Guide } from "./types";
import { lessPhoneGuide } from "./usar-menos-el-celular";
import { instagramGuide } from "./usar-menos-instagram";
import { tiktokGuide } from "./ver-menos-tiktok";

const ALL: Guide[] = [
  lessPhoneGuide,
  screenTimeGuide,
  scrollingGuide,
  instagramGuide,
  tiktokGuide,
];

/** Guides by the last segment of their path (/guias/<slug>). */
export const GUIDES = Object.fromEntries(
  ALL.map((guide) => [CONTENT_PAGES[guide.page].path.replace("/guias/", ""), guide]),
) as Record<string, Guide>;

export type GuideSlug = keyof typeof GUIDES;
export const GUIDE_SLUGS = Object.keys(GUIDES);

import type { Metadata } from "next";

import { DownloadCta } from "@/components/landing/download-cta";
import { Faq } from "@/components/landing/faq";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { ImpactFund } from "@/components/landing/impact-fund";
import { ProofBand } from "@/components/landing/proof-band";
import { ResearchSummary } from "@/components/landing/research-summary";
import { UsageGains } from "@/components/landing/usage-gains";
import { WhySecond } from "@/components/landing/why-second";
import { WhyStill } from "@/components/landing/why-still";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getPublicImpact } from "@/lib/impact";
import { HOME_DESCRIPTION, HOME_FAQ } from "@/lib/landing-content";
import { pageMetadata } from "@/lib/seo";
import { STORES } from "@/lib/site";
import {
  JsonLd,
  faqPage,
  graph,
  mobileApplication,
  organization,
  website,
} from "@/lib/structured-data";

// Regenerated at most every five minutes; the live numbers come from
// Supabase (docs/landing-seo-plan.md, D7).
export const revalidate = 300;

export const metadata: Metadata = {
  ...pageMetadata({
    path: "/",
    image: "/opengraph-image",
    title: "Still: app gratis para usar menos el celular",
    description: HOME_DESCRIPTION,
  }),
  // The Smart App Banner only once the App Store listing is public (D3).
  ...(STORES.ios.status === "live" ? { itunes: { appId: STORES.ios.appId } } : {}),
};

export default async function HomePage() {
  const impact = await getPublicImpact();

  return (
    <>
      <JsonLd
        data={graph(
          organization(),
          website(),
          mobileApplication(HOME_DESCRIPTION),
          faqPage(
            HOME_FAQ.map((item) => ({ question: item.question, answer: item.answer })),
          ),
        )}
      />
      <SiteHeader />
      <main id="contenido">
        <Hero impact={impact} />
        <ProofBand />
        <WhySecond />
        <HowItWorks />
        <UsageGains />
        <ImpactFund impact={impact} />
        <WhyStill />
        <ResearchSummary />
        <Faq items={HOME_FAQ} />
        <DownloadCta impact={impact} />
      </main>
      <SiteFooter />
    </>
  );
}

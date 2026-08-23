import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Privacy Policy — Still",
  description: "How Still handles device, wellbeing, advertising, and impact data.",
};

const sections = [
  {
    title: "1. What stays on your device",
    body: "Your restricted-app selection, app names, bundle identifiers, package names, and detailed Screen Time or Usage Stats history remain on your device. Still does not send this information to its servers, analytics providers, or advertising partners.",
  },
  {
    title: "2. Data we process",
    body: "Still may process an anonymous account identifier, linked Apple or Google account details when you choose to link an account, registered devices and push tokens, platform and country, confirmation that you are 18 or older, token-ledger events, unlock sessions, votes, and daily aggregate wellbeing counts. We do not ask for your date of birth.",
  },
  {
    title: "3. Rewarded advertising",
    body: "Rewarded ads are optional. Still uses Google AdMob and the Google User Messaging Platform to request consent where required. The MVP requests non-personalized or limited ads. Completing an eligible rewarded ad grants one non-transferable Unlock Token. Still allocates a percentage of its advertising revenue to the Impact Fund; an individual ad does not itself donate money.",
  },
  {
    title: "4. Analytics and diagnostics",
    body: "Still may use PostHog for product analytics and Sentry for error diagnostics. Events may include platform, country, a generic category, and aggregate counts. They never include the name, package name, or bundle identifier of an app you installed or restricted, nor your detailed usage history.",
  },
  {
    title: "5. Retention",
    body: "Identifiable wellbeing aggregates are retained for up to 90 days and may then be kept only in anonymous aggregate form. Product analytics are retained for up to 13 months. Revenue, donation, and administrative audit records may be retained for seven years or for the period required by applicable law.",
  },
  {
    title: "6. Your choices and rights",
    body: "You can decline advertising consent, use Emergency Unlocks when an ad is unavailable, revoke platform permissions, export your account data, or request deletion from the Privacy section in Still. Deletion removes your profile, devices, aggregates, and push tokens. Financial ledger entries may be retained only in pseudonymized form where legally necessary.",
  },
  {
    title: "7. International processing and security",
    body: "Service providers may process data in countries other than your own. Still uses access controls, row-level security, encrypted transport, server-only financial mutations, and data minimization to protect the limited information it processes.",
  },
  {
    title: "8. Adults only and changes",
    body: "Still is intended for adults aged 18 and older. We may update this policy as the product or legal requirements change. Material changes will be communicated in the app or on this page before they take effect when required.",
  },
];

export default function PrivacyPage() {
  return (
    <main>
      <SiteHeader />
      <article className="legal-page shell">
        <header className="legal-hero">
          <p className="eyebrow">Privacy · Privacidad</p>
          <h1>Your attention is yours.</h1>
          <p>
            This policy explains how Still handles information across the mobile app,
            public Impact Fund, and administrative services.
          </p>
          <p className="legal-date">Effective August 23, 2026</p>
        </header>

        <section className="legal-summary" aria-label="Privacy summary">
          <strong>Plain-language promise</strong>
          <p>
            App selections and detailed usage stay local. We collect only the minimum
            aggregate and operational data needed to provide tokens, unlocks, voting,
            transparency, security, and privacy requests.
          </p>
        </section>

        <div className="legal-grid">
          {sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
            </section>
          ))}
        </div>

        <section className="legal-contact">
          <h2>Questions or requests</h2>
          <p>
            Use <strong>Settings → Privacy</strong> in the Still app for export and
            deletion requests. Until the beta opens, privacy inquiries can also be
            submitted through the project administrator.
          </p>
          <Link className="text-link" href="/">Return to Still →</Link>
        </section>
      </article>
    </main>
  );
}

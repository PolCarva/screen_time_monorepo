import type { Metadata, Viewport } from "next";
import { Recursive } from "next/font/google";
import "./globals.css";

import { RevealObserver } from "@/components/motion/reveal-observer";
import { OG_LOCALE } from "@/lib/seo";
import { SITE_NAME, SITE_URL } from "@/lib/site";

// One variable file: weight plus the MONO axis for the labels
// (docs/landing-seo-plan.md, D12). CASL stays out: its default, 0, is the
// look we use, and the axis doubled the file (143 → 73 KB).
const recursive = Recursive({
  subsets: ["latin"],
  axes: ["MONO"],
  display: "swap",
  variable: "--font-recursive",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: "Still: app gratis para usar menos el celular",
    template: "%s | Still",
  },
  description:
    "Un segundo de pausa antes de abrir Instagram, TikTok o YouTube. Sin bloqueos ni rachas. Gratis en iPhone y Android, y el 80 % de los anuncios se dona.",
  openGraph: {
    siteName: SITE_NAME,
    locale: OG_LOCALE,
    type: "website",
  },
  robots: { index: true, follow: true },
  verification: {
    google: "w6xt1NOVtBK3KqLnn-CvVopw5VzsBZENggBzfC8WeFI",
  },
};

export const viewport: Viewport = {
  themeColor: "#F1EFE8",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-419" className={recursive.variable}>
      <body>
        {children}
        <RevealObserver />
      </body>
    </html>
  );
}

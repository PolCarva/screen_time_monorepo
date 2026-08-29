import type { Metadata } from "next";
import localFont from "next/font/local";

import "./globals.css";

const brand = localFont({
  display: "swap",
  src: [
    { path: "../node_modules/@expo-google-fonts/familjen-grotesk/400Regular/FamiljenGrotesk_400Regular.ttf", weight: "400" },
    { path: "../node_modules/@expo-google-fonts/familjen-grotesk/500Medium/FamiljenGrotesk_500Medium.ttf", weight: "500" },
    { path: "../node_modules/@expo-google-fonts/familjen-grotesk/600SemiBold/FamiljenGrotesk_600SemiBold.ttf", weight: "600" },
    { path: "../node_modules/@expo-google-fonts/familjen-grotesk/700Bold/FamiljenGrotesk_700Bold.ttf", weight: "700" },
  ],
  variable: "--font-brand",
});

const mono = localFont({
  display: "swap",
  src: [
    { path: "../node_modules/@expo-google-fonts/ibm-plex-mono/400Regular/IBMPlexMono_400Regular.ttf", weight: "400" },
    { path: "../node_modules/@expo-google-fonts/ibm-plex-mono/500Medium/IBMPlexMono_500Medium.ttf", weight: "500" },
    { path: "../node_modules/@expo-google-fonts/ibm-plex-mono/600SemiBold/IBMPlexMono_600SemiBold.ttf", weight: "600" },
  ],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://still.app"),
  title: {
    default: "Still — una pausa que cuenta",
    template: "%s — Still",
  },
  description: "Una pausa privada antes de las apps que abres por reflejo. Salir es un toque; entrar sigue siendo una elección.",
  openGraph: {
    title: "Still — una pausa que cuenta",
    description: "El segundo antes de entrar también es tuyo.",
    locale: "es_419",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${brand.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const recursive = localFont({
  display: "swap",
  src: [
    {
      path: "../node_modules/@expo-google-fonts/recursive/400Regular/Recursive_400Regular.ttf",
      weight: "400",
    },
    {
      path: "../node_modules/@expo-google-fonts/recursive/500Medium/Recursive_500Medium.ttf",
      weight: "500",
    },
    {
      path: "../node_modules/@expo-google-fonts/recursive/600SemiBold/Recursive_600SemiBold.ttf",
      weight: "600",
    },
    {
      path: "../node_modules/@expo-google-fonts/recursive/700Bold/Recursive_700Bold.ttf",
      weight: "700",
    },
  ],
  variable: "--font-recursive",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://still.app"),
  title: {
    default: "Still — un segundo antes de entrar",
    template: "%s — Still",
  },
  description:
    "Still hace visible el momento antes de abrir una app por reflejo. Una pausa privada, una decisión clara y un fondo de impacto verificable.",
  openGraph: {
    title: "Still — un segundo antes de entrar",
    description: "La tecnología puede devolverte el momento de decidir.",
    locale: "es_419",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={recursive.variable}>
      <body>{children}</body>
    </html>
  );
}

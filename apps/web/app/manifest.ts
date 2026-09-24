import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Still: pausa antes de abrir apps",
    short_name: "Still",
    description:
      "Un segundo de pausa antes de las apps que abres por reflejo. Gratis en iPhone y Android.",
    lang: "es-419",
    start_url: "/",
    display: "standalone",
    background_color: "#F1EFE8",
    theme_color: "#F1EFE8",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}

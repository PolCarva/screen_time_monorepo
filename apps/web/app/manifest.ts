import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Still — un segundo antes de entrar",
    short_name: "Still",
    description: "Una intervención privada que hace visible la decisión antes de abrir una app por reflejo.",
    start_url: "/",
    display: "standalone",
    background_color: "#F1EFE8",
    theme_color: "#242826",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}

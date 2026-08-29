import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Still — una pausa que cuenta",
    short_name: "Still",
    description: "Una pausa privada antes de las apps que abres por reflejo.",
    start_url: "/",
    display: "standalone",
    background_color: "#F3F0E8",
    theme_color: "#FF5C35",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}

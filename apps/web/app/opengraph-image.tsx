import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og-image";

export const alt = "Still: un segundo antes de entrar. App gratis para usar menos el celular.";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({
    eyebrow: "App gratis para usar menos el celular",
    title: "Un segundo antes de entrar.",
  });
}

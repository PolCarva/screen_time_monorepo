import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og-image";

export const alt = "Impacto de Still: el fondo que dona el 80 % de los anuncios.";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({
    eyebrow: "Impacto · fondo semanal",
    title: "Una app que dona el 80 % de sus anuncios.",
  });
}

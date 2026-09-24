import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

/**
 * The share image every page uses: its title over the brand field. No live
 * numbers: the image is frozen at build time (docs/landing-seo-plan.md, D20).
 */
export async function renderOgImage({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  const font = await readFile(
    join(process.cwd(), "assets/fonts/Recursive_600SemiBold.ttf"),
  );
  const bar = (width: number, color: string) => (
    <div style={{ width, height: 18, borderRadius: 4, background: color }} />
  );
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#F1EFE8",
          color: "#242826",
          fontFamily: "Recursive",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              <div style={{ display: "flex", gap: 12, paddingLeft: 4 }}>
                {bar(44, "#242826")}
                {bar(44, "#242826")}
              </div>
              <div style={{ display: "flex", gap: 27 }}>
                {bar(44, "#697F8C")}
                {bar(44, "#D39A83")}
              </div>
              <div style={{ display: "flex", gap: 12, paddingLeft: 4 }}>
                {bar(44, "#242826")}
                {bar(44, "#242826")}
              </div>
            </div>
            <div style={{ fontSize: 44, letterSpacing: -2 }}>Still</div>
          </div>
          <div style={{ fontSize: 22, color: "#4E5451", letterSpacing: 3 }}>
            {eyebrow.toUpperCase()}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: title.length > 48 ? 72 : 88,
            lineHeight: 0.98,
            letterSpacing: -4,
            maxWidth: 1000,
          }}
        >
          {title}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 180, height: 20, borderRadius: 6, background: "#D9DEDC" }} />
          <div style={{ width: 120, height: 20, borderRadius: 6, background: "#697F8C" }} />
          <div style={{ width: 260, height: 20, borderRadius: 6, background: "#D39A83" }} />
          <div style={{ fontSize: 24, color: "#4E5451", whiteSpace: "nowrap" }}>
            Gratis en iPhone y Android
          </div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [{ name: "Recursive", data: font, weight: 600, style: "normal" }],
    },
  );
}

import fs from "node:fs";
import path from "node:path";
import sharp from "../node_modules/.pnpm/sharp@0.35.3_@types+node@24.13.3/node_modules/sharp/dist/index.mjs";

const root = path.resolve(import.meta.dirname, "..");
const outputDir = path.join(root, "brand", "v3", "explorations");
fs.mkdirSync(outputDir, { recursive: true });

const W = 1800;
const H = 1125;

const esc = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

function text(x, y, value, size, fill, options = {}) {
  const {
    family = "Avenir Next, Avenir, Helvetica, sans-serif",
    weight = 500,
    anchor = "start",
    letter = 0,
    opacity = 1,
    italic = false,
  } = options;
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="${family}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" letter-spacing="${letter}" opacity="${opacity}"${italic ? ' font-style="italic"' : ""}>${esc(value)}</text>`;
}

function multiline(x, y, lines, size, fill, options = {}) {
  const leading = options.leading ?? Math.round(size * 1.35);
  return lines.map((line, index) => text(x, y + index * leading, line, size, fill, options)).join("");
}

function rect(x, y, w, h, fill, options = {}) {
  const { radius = 0, stroke = "none", strokeWidth = 1, opacity = 1, filter = "" } = options;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}"${filter ? ` filter="url(#${filter})"` : ""}/>`;
}

function line(x1, y1, x2, y2, stroke, width = 1, opacity = 1, dash = "") {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}" opacity="${opacity}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
}

function circle(cx, cy, r, fill, options = {}) {
  const { stroke = "none", strokeWidth = 1, opacity = 1 } = options;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}"/>`;
}

function phone(x, y, w, h, bg, stroke, radius = 40) {
  return [
    rect(x, y, w, h, bg, { radius, stroke, strokeWidth: 1.5 }),
    rect(x + w / 2 - 34, y + 15, 68, 7, stroke, { radius: 4, opacity: 0.65 }),
  ].join("");
}

function label(x, y, value, fill) {
  return text(x, y, value.toUpperCase(), 13, fill, { weight: 650, letter: 2.2 });
}

function paletteRow(x, y, colors, textColor) {
  return colors.map((item, index) => {
    const px = x + index * 108;
    return [
      circle(px + 22, y + 22, 22, item.color, { stroke: textColor, strokeWidth: 0.6 }),
      text(px, y + 62, item.name, 12, textColor, { weight: 550 }),
      text(px, y + 79, item.color.toUpperCase(), 10, textColor, { family: "Menlo, monospace", opacity: 0.65 }),
    ].join("");
  }).join("");
}

function base(bg, title, number, subtitle, ink) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `<defs>
      <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="18" stdDeviation="22" flood-opacity="0.12"/></filter>
      <filter id="microTexture" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="2" seed="8" result="noise"/><feComposite in="noise" in2="SourceGraphic" operator="in" result="cut"/><feBlend in="SourceGraphic" in2="cut" mode="multiply"/></filter>
      <linearGradient id="lightBand" x1="0" x2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/><stop offset=".5" stop-color="#FFFFFF" stop-opacity=".82"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
    </defs>`,
    rect(0, 0, W, H, bg),
    label(70, 69, `Exploration ${number} / Product · Brand · Motion`, ink),
    text(70, 132, title, 62, ink, { weight: 520, letter: -2.4 }),
    text(72, 173, subtitle, 18, ink, { weight: 480, opacity: 0.72, letter: 0.3 }),
    line(70, 204, 1730, 204, ink, 1, 0.18),
  ].join("");
}

function quietInstrument() {
  const c = { bg: "#ECEBE5", ink: "#202522", blue: "#6E8793", brass: "#B8A574", pale: "#D9D8D1", white: "#F5F4EF" };
  let s = base(c.bg, "Quiet Instrument", "01", "Attention as calibration — exact, matte, non-judgmental.", c.ink);

  s += label(70, 253, "System premise", c.ink);
  s += multiline(70, 292, ["A precise instrument that reports", "behavior without turning life into", "a score or a moral verdict."], 24, c.ink, { weight: 460, leading: 34 });
  s += line(70, 407, 392, 407, c.ink, 1, 0.18);
  s += text(70, 448, "ONEST / PLEX MONO", 15, c.ink, { weight: 650, letter: 1.5 });
  s += text(70, 505, "42", 88, c.ink, { family: "Menlo, monospace", weight: 500, letter: -5 });
  s += text(205, 505, "min returned", 22, c.ink, { weight: 500 });
  s += text(72, 540, "CALIBRATION, NOT GAMIFICATION", 11, c.blue, { family: "Menlo, monospace", weight: 600, letter: 1.3 });
  s += label(70, 605, "Palette", c.ink);
  s += paletteRow(70, 627, [
    { name: "chalk", color: c.bg }, { name: "graphite", color: c.ink }, { name: "dust blue", color: c.blue }, { name: "brass", color: c.brass },
  ], c.ink);

  const px = 500, py = 248, pw = 360, ph = 765;
  s += phone(px, py, pw, ph, c.white, c.ink, 27);
  s += text(px + 30, py + 60, "TODAY / 29 AUG", 11, c.ink, { family: "Menlo, monospace", weight: 650, letter: 1.2 });
  s += text(px + 30, py + 130, "42", 78, c.ink, { family: "Menlo, monospace", weight: 500, letter: -4 });
  s += text(px + 165, py + 129, "minutes", 16, c.ink, { family: "Menlo, monospace" });
  s += text(px + 165, py + 153, "returned today", 15, c.ink, { opacity: 0.62 });
  for (let i = 0; i < 24; i += 1) {
    const xx = px + 30 + i * 12;
    const active = i < 14;
    s += line(xx, py + 207, xx, py + (active ? 237 : 225), active ? c.blue : c.pale, active ? 3 : 1, active ? 0.9 : 1);
  }
  s += text(px + 30, py + 267, "PROTECTED", 10, c.ink, { family: "Menlo, monospace", weight: 650, letter: 1.1 });
  s += text(px + 30, py + 303, "6 apps", 22, c.ink, { weight: 600 });
  s += text(px + 182, py + 303, "14 choices", 22, c.ink, { weight: 600 });
  s += line(px + 30, py + 330, px + pw - 30, py + 330, c.ink, 1, 0.16);
  s += text(px + 30, py + 369, "IMPACT / CONFIRMED", 10, c.ink, { family: "Menlo, monospace", weight: 650, letter: 1.1 });
  s += text(px + 30, py + 412, "$1.84", 33, c.ink, { family: "Menlo, monospace", weight: 540 });
  s += text(px + 150, py + 410, "allocated this week", 14, c.ink, { opacity: 0.62 });
  s += line(px + 30, py + 450, px + pw - 30, py + 450, c.ink, 1, 0.16);
  s += text(px + 30, py + 493, "NEXT CALIBRATION", 10, c.ink, { family: "Menlo, monospace", weight: 650, letter: 1.1 });
  s += text(px + 30, py + 530, "Review 2 new apps", 19, c.ink, { weight: 600 });
  s += rect(px + 30, py + 563, 300, 49, c.ink);
  s += text(px + 180, py + 595, "REVIEW SELECTION", 11, c.white, { family: "Menlo, monospace", weight: 650, letter: 0.9, anchor: "middle" });
  s += line(px + 30, py + 680, px + pw - 30, py + 680, c.ink, 1, 0.18);
  s += text(px + 30, py + 716, "TODAY", 10, c.ink, { family: "Menlo, monospace", weight: 700 });
  s += text(px + 160, py + 716, "PASSES", 10, c.ink, { family: "Menlo, monospace", opacity: 0.45 });
  s += text(px + 270, py + 716, "IMPACT", 10, c.ink, { family: "Menlo, monospace", opacity: 0.45 });

  const ix = 930, iy = 248, iw = 360, ih = 765;
  s += phone(ix, iy, iw, ih, c.ink, c.ink, 27);
  s += text(ix + 30, iy + 61, "PAUSE / INSTAGRAM", 11, c.white, { family: "Menlo, monospace", weight: 650, letter: 1.2 });
  s += text(ix + 30, iy + 142, "00:01", 68, c.white, { family: "Menlo, monospace", weight: 450, letter: -3 });
  s += line(ix + 30, iy + 186, ix + 330, iy + 186, c.white, 1, 0.25);
  s += line(ix + 30, iy + 216, ix + 305, iy + 216, c.brass, 4, 0.95);
  for (let i = 0; i < 11; i += 1) {
    const xx = ix + 30 + i * 30;
    s += line(xx, iy + 205, xx, iy + (i === 9 ? 234 : 222), i === 9 ? c.brass : c.white, i === 9 ? 3 : 1, i === 9 ? 1 : 0.4);
  }
  s += multiline(ix + 30, iy + 305, ["Instagram opened", "7 times today."], 29, c.white, { weight: 550, leading: 38 });
  s += text(ix + 30, iy + 403, "Continue with intention?", 17, c.white, { opacity: 0.66 });
  s += rect(ix + 30, iy + 455, 300, 53, c.white);
  s += text(ix + 180, iy + 489, "GO BACK", 12, c.ink, { family: "Menlo, monospace", weight: 700, letter: 1.1, anchor: "middle" });
  s += rect(ix + 30, iy + 525, 300, 53, "none", { stroke: c.white, strokeWidth: 1 });
  s += text(ix + 180, iy + 559, "USE 1 PASS · 10 MIN", 12, c.white, { family: "Menlo, monospace", weight: 650, letter: 0.7, anchor: "middle" });
  s += text(ix + 30, iy + 637, "CONTINUE WITHOUT PASS", 10, c.white, { family: "Menlo, monospace", opacity: 0.5, letter: 0.6 });
  s += text(ix + 30, iy + 708, "Motion: index settles. One haptic.", 11, c.white, { opacity: 0.54 });

  s += label(1360, 253, "Icon trials", c.ink);
  for (let k = 0; k < 4; k += 1) {
    const x = 1360 + (k % 2) * 180;
    const y = 285 + Math.floor(k / 2) * 176;
    s += rect(x, y, 138, 138, k === 3 ? c.ink : c.white, { radius: 24, stroke: c.ink, strokeWidth: 0.8 });
    const mark = k === 3 ? c.white : c.ink;
    const gap = [24, 34, 18, 29][k];
    s += line(x + 37, y + 39, x + 37, y + 99, mark, 7);
    s += line(x + 37, y + 39, x + 62, y + 39, mark, 7);
    s += line(x + 101, y + 39, x + 101, y + 99, mark, 7);
    s += line(x + 76, y + 99, x + 101, y + 99, mark, 7);
    s += line(x + 69 - gap / 2, y + 69, x + 69 + gap / 2, y + 69, k === 1 ? c.brass : c.blue, 5);
    s += text(x + 69, y + 160, `0${k + 1}`, 10, c.ink, { family: "Menlo, monospace", anchor: "middle", opacity: 0.55 });
  }
  s += label(1360, 660, "Decision", c.ink);
  s += multiline(1360, 699, ["Strong native clarity.", "Too cold; repeats the", "editorial system's rigor."], 19, c.ink, { weight: 520, leading: 29 });
  s += rect(1360, 815, 340, 74, c.brass, { opacity: 0.34 });
  s += text(1382, 847, "DO NOT SELECT", 12, c.ink, { family: "Menlo, monospace", weight: 700, letter: 1.3 });
  s += text(1382, 872, "Useful, but not new enough.", 14, c.ink, { weight: 560 });
  s += line(70, 1060, 1730, 1060, c.ink, 1, 0.18);
  s += text(70, 1092, "Progress = calibrated bands  ·  Depth = none  ·  Photography = industrial close-ups", 13, c.ink, { opacity: 0.62, letter: 0.3 });
  s += "</svg>";
  return s;
}

function fieldMark(x, y, size, colors, variant = 0, dark = false) {
  const ink = dark ? colors.bg : colors.ink;
  const blue = colors.blue;
  const peach = colors.peach;
  const u = size / 5;
  const positions = [
    [[0, 0], [2.25, 0], [0, 2.25], [2.7, 2.05]],
    [[0, .15], [2.4, 0], [.2, 2.35], [2.6, 2.3]],
    [[.1, 0], [2.25, .3], [0, 2.35], [2.85, 1.95]],
    [[0, .3], [2.5, 0], [.35, 2.4], [2.65, 2.1]],
  ][variant];
  return positions.map(([dx, dy], index) => rect(x + dx * u, y + dy * u, 1.75 * u, 1.75 * u, index === 3 ? peach : index === 1 && variant === 2 ? blue : ink, { radius: u * 0.18 })).join("");
}

function moduleField(x, y, cols, rows, cellW, cellH, gap, colors, phase = "progress") {
  let s = "";
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const index = row * cols + col;
      const active = phase === "progress" ? index < Math.round(cols * rows * 0.64) : true;
      const shift = phase === "split" ? (col < cols / 2 ? -18 - row * 1.8 : 18 + row * 1.8) : ((index * 7) % 5) - 2;
      const fill = active ? (index % 9 === 4 ? colors.peach : colors.blue) : colors.fog;
      const opacity = active ? (0.56 + (index % 3) * 0.12) : 0.54;
      s += rect(x + col * (cellW + gap) + shift, y + row * (cellH + gap), cellW, cellH, fill, { radius: Math.min(5, cellH / 3), opacity });
    }
  }
  return s;
}

function softField() {
  const c = { bg: "#F1EFE8", ink: "#242826", blue: "#697F8C", peach: "#D39A83", fog: "#D9DEDC", white: "#F8F6EF", dark: "#242826" };
  let s = base(c.bg, "Soft Field", "02", "Attention as a responsive field — digital, warm, ownable.", c.ink);

  s += label(70, 253, "System premise", c.ink);
  s += multiline(70, 292, ["Automatic use creates density.", "A conscious choice gives the field", "room to return to order."], 24, c.ink, { weight: 470, leading: 34 });
  s += line(70, 407, 392, 407, c.ink, 1, 0.18);
  s += text(70, 448, "RECURSIVE / ONE VARIABLE FAMILY", 14, c.ink, { weight: 680, letter: 1.2 });
  s += text(70, 508, "42 min returned", 46, c.ink, { weight: 550, letter: -1.8 });
  s += text(72, 540, "LINEAR UI  ·  MONO DATA  ·  8% CASUAL", 11, c.blue, { family: "Menlo, monospace", weight: 650, letter: 1.15 });
  s += label(70, 605, "Palette", c.ink);
  s += paletteRow(70, 627, [
    { name: "chalk", color: c.bg }, { name: "graphite", color: c.ink }, { name: "mineral", color: c.blue }, { name: "peach", color: c.peach },
  ], c.ink);
  s += label(70, 750, "Field grammar", c.ink);
  s += moduleField(70, 778, 8, 4, 27, 14, 9, c, "progress");
  s += multiline(70, 883, ["Only for measured behavior:", "progress, interruption, impact.", "Never a decorative pattern."], 15, c.ink, { weight: 540, leading: 24 });

  const px = 500, py = 248, pw = 360, ph = 765;
  s += phone(px, py, pw, ph, c.white, c.ink, 34);
  s += text(px + 30, py + 61, "29 AUG", 11, c.ink, { family: "Menlo, monospace", weight: 650, letter: 1 });
  s += text(px + 30, py + 133, "42", 86, c.ink, { family: "Menlo, monospace", weight: 520, letter: -5 });
  s += text(px + 164, py + 112, "minutes", 17, c.ink, { weight: 650 });
  s += text(px + 164, py + 138, "returned today", 16, c.ink, { opacity: 0.57 });
  s += moduleField(px + 32, py + 191, 7, 5, 32, 11, 10, c, "progress");
  s += text(px + 30, py + 304, "MON", 9, c.ink, { family: "Menlo, monospace", opacity: 0.45 });
  s += text(px + 277, py + 304, "TODAY", 9, c.ink, { family: "Menlo, monospace", weight: 700 });
  s += line(px + 30, py + 337, px + 330, py + 337, c.ink, 1, 0.16);
  s += text(px + 30, py + 377, "6", 27, c.ink, { family: "Menlo, monospace", weight: 580 });
  s += text(px + 67, py + 374, "apps protected", 15, c.ink, { weight: 560 });
  s += text(px + 30, py + 425, "14", 27, c.ink, { family: "Menlo, monospace", weight: 580 });
  s += text(px + 78, py + 422, "automatic opens avoided", 15, c.ink, { weight: 560 });
  s += line(px + 30, py + 455, px + 330, py + 455, c.ink, 1, 0.16);
  s += text(px + 30, py + 497, "IMPACT / VERIFIED", 10, c.blue, { family: "Menlo, monospace", weight: 680, letter: 0.8 });
  s += text(px + 30, py + 541, "$1.84", 36, c.ink, { family: "Menlo, monospace", weight: 550 });
  s += text(px + 155, py + 537, "allocated", 14, c.ink, { opacity: 0.56 });
  s += text(px + 155, py + 559, "this week", 14, c.ink, { opacity: 0.56 });
  s += line(px + 30, py + 583, px + 330, py + 583, c.ink, 1, 0.16);
  s += text(px + 30, py + 622, "NEXT", 10, c.blue, { family: "Menlo, monospace", weight: 680, letter: 0.9 });
  s += text(px + 30, py + 657, "Review 2 new apps", 18, c.ink, { weight: 620 });
  s += text(px + 330, py + 657, "→", 24, c.ink, { anchor: "end" });
  s += line(px + 30, py + 687, px + 330, py + 687, c.ink, 1, 0.16);
  s += text(px + 30, py + 721, "Today", 12, c.ink, { weight: 700 });
  s += text(px + 127, py + 721, "Passes", 12, c.ink, { opacity: 0.42 });
  s += text(px + 222, py + 721, "Impact", 12, c.ink, { opacity: 0.42 });
  s += circle(px + 317, py + 717, 3.5, c.peach);

  const ix = 930, iy = 248, iw = 360, ih = 765;
  s += phone(ix, iy, iw, ih, c.dark, c.dark, 34);
  s += text(ix + 30, iy + 61, "INSTAGRAM", 11, c.bg, { family: "Menlo, monospace", weight: 650, letter: 1 });
  s += text(ix + 330, iy + 61, "00:01", 11, c.bg, { family: "Menlo, monospace", weight: 650, anchor: "end" });
  s += moduleField(ix + 70, iy + 114, 7, 6, 23, 11, 8, { ...c, blue: "#A6B6BD", peach: "#DDA28A", fog: "#505653" }, "split");
  s += line(ix + 180, iy + 105, ix + 180, iy + 240, c.bg, 1, 0.15);
  s += multiline(ix + 30, iy + 309, ["Instagram opened", "7 times today."], 30, c.bg, { weight: 560, leading: 39 });
  s += text(ix + 30, iy + 410, "What do you want from the next 10 minutes?", 14, c.bg, { opacity: 0.6 });
  s += rect(ix + 30, iy + 455, 300, 54, c.bg, { radius: 4 });
  s += text(ix + 180, iy + 489, "Go back", 15, c.ink, { weight: 690, anchor: "middle" });
  s += line(ix + 30, iy + 544, ix + 330, iy + 544, c.bg, 1, 0.36);
  s += text(ix + 30, iy + 578, "Use 1 pass · 10 min", 15, c.bg, { weight: 620 });
  s += text(ix + 330, iy + 578, "→", 19, c.bg, { anchor: "end" });
  s += line(ix + 30, iy + 607, ix + 330, iy + 607, c.bg, 1, 0.18);
  s += text(ix + 30, iy + 641, "Continue without a pass", 13, c.bg, { opacity: 0.46 });
  s += text(ix + 30, iy + 708, "Field opens once. One haptic. No bounce.", 11, c.bg, { opacity: 0.5 });

  s += label(1360, 253, "Icon trials", c.ink);
  for (let k = 0; k < 4; k += 1) {
    const x = 1360 + (k % 2) * 180;
    const y = 285 + Math.floor(k / 2) * 176;
    const dark = k === 3;
    s += rect(x, y, 138, 138, dark ? c.ink : c.white, { radius: k === 3 ? 30 : 24, stroke: c.ink, strokeWidth: 0.6 });
    s += fieldMark(x + 40, y + 40, 58, c, k, dark);
    s += text(x + 69, y + 160, `0${k + 1}`, 10, c.ink, { family: "Menlo, monospace", anchor: "middle", opacity: 0.55 });
  }
  s += label(1360, 660, "Decision", c.ink);
  s += multiline(1360, 699, ["Ownable product behavior.", "Warm without wellness cues.", "Scales from Shield to campaign."], 19, c.ink, { weight: 550, leading: 29 });
  s += rect(1360, 815, 340, 74, c.blue, { radius: 4 });
  s += text(1382, 847, "SELECT / BUILD", 12, c.white, { family: "Menlo, monospace", weight: 700, letter: 1.3 });
  s += text(1382, 872, "Direction 02 · system candidate", 14, c.white, { weight: 570 });
  s += label(1360, 943, "3D rule", c.ink);
  s += multiline(1360, 978, ["A field can gain depth only", "when height equals real time."], 14, c.ink, { weight: 540, leading: 23 });
  s += line(70, 1060, 1730, 1060, c.ink, 1, 0.18);
  s += text(70, 1092, "Progress = modular field  ·  Depth = measured only  ·  Photography = observed life, phone absent", 13, c.ink, { opacity: 0.62, letter: 0.3 });
  s += "</svg>";
  return s;
}

function luminousThreshold() {
  const c = { bg: "#ECE9E1", ink: "#252526", blue: "#83929A", peach: "#C98F7E", yellow: "#D6CB95", white: "#F7F4EC" };
  let s = base(c.bg, "Luminous Threshold", "03", "Attention as a shift in exposure — spatial, quiet, photographic.", c.ink);
  s += rect(0, 205, W, 920, "url(#lightBand)", { opacity: 0.65 });

  s += label(70, 253, "System premise", c.ink);
  s += multiline(70, 292, ["A pause changes exposure.", "The moment between reflection", "and choice becomes visible."], 24, c.ink, { weight: 450, leading: 34 });
  s += line(70, 407, 392, 407, c.ink, 1, 0.18);
  s += text(70, 448, "GEOLOGICA / CONDENSED CAMPAIGN", 14, c.ink, { weight: 680, letter: 1.2 });
  s += text(70, 508, "42 minutes", 47, c.ink, { weight: 520, letter: -1.7 });
  s += text(72, 540, "EXPOSURE BECOMES INFORMATION", 11, c.blue, { family: "Menlo, monospace", weight: 650, letter: 1.1 });
  s += label(70, 605, "Palette", c.ink);
  s += paletteRow(70, 627, [
    { name: "warm white", color: c.bg }, { name: "charcoal", color: c.ink }, { name: "fog blue", color: c.blue }, { name: "pale light", color: c.yellow },
  ], c.ink);
  s += label(70, 750, "Exposure strips", c.ink);
  for (let i = 0; i < 8; i += 1) {
    s += rect(70 + i * 38, 779, 28, 96 - ((i * 13) % 45), i === 5 ? c.peach : c.blue, { opacity: 0.18 + i * 0.06 });
  }
  s += multiline(70, 905, ["Works best when light and", "photography are available."], 15, c.ink, { weight: 540, leading: 24 });

  const px = 500, py = 248, pw = 360, ph = 765;
  s += phone(px, py, pw, ph, c.white, c.ink, 46);
  s += rect(px + 1, py + 77, pw - 2, 290, c.blue, { opacity: 0.14 });
  s += rect(px + 120, py + 77, 115, 290, "url(#lightBand)", { opacity: 0.95 });
  s += text(px + 30, py + 61, "Today", 12, c.ink, { weight: 650 });
  s += text(px + 30, py + 161, "42", 91, c.ink, { weight: 470, letter: -5 });
  s += text(px + 164, py + 138, "minutes", 17, c.ink, { weight: 600 });
  s += text(px + 164, py + 163, "returned", 16, c.ink, { opacity: 0.55 });
  s += text(px + 30, py + 332, "7:00", 10, c.ink, { family: "Menlo, monospace", opacity: 0.5 });
  s += text(px + 330, py + 332, "NOW", 10, c.ink, { family: "Menlo, monospace", anchor: "end" });
  s += line(px + 30, py + 393, px + 330, py + 393, c.ink, 1, 0.15);
  s += text(px + 30, py + 434, "6 apps protected", 17, c.ink, { weight: 600 });
  s += text(px + 330, py + 434, "14 choices", 15, c.ink, { anchor: "end", opacity: 0.58 });
  s += line(px + 30, py + 465, px + 330, py + 465, c.ink, 1, 0.15);
  s += text(px + 30, py + 506, "Verified impact", 12, c.ink, { opacity: 0.54 });
  s += text(px + 30, py + 551, "$1.84", 38, c.ink, { weight: 540 });
  s += rect(px + 266, py + 500, 64, 64, c.yellow, { opacity: 0.45 });
  s += line(px + 30, py + 596, px + 330, py + 596, c.ink, 1, 0.15);
  s += text(px + 30, py + 640, "Review 2 new apps", 18, c.ink, { weight: 620 });
  s += text(px + 330, py + 640, "→", 22, c.ink, { anchor: "end" });
  s += line(px + 30, py + 687, px + 330, py + 687, c.ink, 1, 0.15);
  s += text(px + 30, py + 721, "Today", 12, c.ink, { weight: 700 });
  s += text(px + 145, py + 721, "Passes", 12, c.ink, { opacity: 0.4 });
  s += text(px + 264, py + 721, "Impact", 12, c.ink, { opacity: 0.4 });

  const ix = 930, iy = 248, iw = 360, ih = 765;
  s += phone(ix, iy, iw, ih, c.ink, c.ink, 46);
  s += rect(ix + 104, iy + 1, 150, ih - 2, "url(#lightBand)", { opacity: 0.28 });
  s += text(ix + 30, iy + 61, "Instagram", 12, c.white, { weight: 650 });
  s += text(ix + 330, iy + 61, "00:01", 11, c.white, { family: "Menlo, monospace", anchor: "end" });
  for (let i = 0; i < 7; i += 1) {
    s += rect(ix + 30 + i * 44, iy + 112, 31, 128 - (i % 3) * 24, i === 3 ? c.yellow : c.blue, { opacity: 0.18 + i * 0.055 });
  }
  s += multiline(ix + 30, iy + 309, ["Before you enter,", "choose the next 10 minutes."], 29, c.white, { weight: 520, leading: 39 });
  s += text(ix + 30, iy + 411, "Opened 7 times today", 14, c.white, { opacity: 0.56 });
  s += rect(ix + 30, iy + 455, 300, 55, c.white);
  s += text(ix + 180, iy + 490, "Go back", 15, c.ink, { weight: 680, anchor: "middle" });
  s += text(ix + 30, iy + 562, "Use 1 pass · 10 min", 15, c.white, { weight: 620 });
  s += text(ix + 330, iy + 562, "→", 20, c.white, { anchor: "end" });
  s += line(ix + 30, iy + 590, ix + 330, iy + 590, c.white, 1, 0.22);
  s += text(ix + 30, iy + 631, "Continue without a pass", 13, c.white, { opacity: 0.44 });
  s += text(ix + 30, iy + 708, "Exposure shifts once. No blur loop.", 11, c.white, { opacity: 0.48 });

  s += label(1360, 253, "Icon trials", c.ink);
  for (let k = 0; k < 4; k += 1) {
    const x = 1360 + (k % 2) * 180;
    const y = 285 + Math.floor(k / 2) * 176;
    const dark = k === 3;
    s += rect(x, y, 138, 138, dark ? c.ink : c.white, { radius: 32, stroke: c.ink, strokeWidth: 0.7 });
    const mark = dark ? c.white : c.ink;
    const offset = [5, 11, -4, 8][k];
    s += rect(x + 38, y + 34, 34, 70, mark, { opacity: 0.88 });
    s += rect(x + 70 + offset, y + 34, 34, 70, k === 1 ? c.peach : c.blue, { opacity: 0.7 });
    s += line(x + 69 + offset / 2, y + 30, x + 69 + offset / 2, y + 108, c.yellow, 4, 0.85);
    s += text(x + 69, y + 160, `0${k + 1}`, 10, c.ink, { family: "Menlo, monospace", anchor: "middle", opacity: 0.55 });
  }
  s += label(1360, 660, "Decision", c.ink);
  s += multiline(1360, 699, ["Elegant in campaign.", "Too dependent on photography", "and fragile in native Shields."], 19, c.ink, { weight: 540, leading: 29 });
  s += rect(1360, 815, 340, 74, c.yellow, { opacity: 0.5 });
  s += text(1382, 847, "DO NOT SELECT", 12, c.ink, { family: "Menlo, monospace", weight: 700, letter: 1.3 });
  s += text(1382, 872, "High mood; low system resilience.", 14, c.ink, { weight: 560 });
  s += line(70, 1060, 1730, 1060, c.ink, 1, 0.18);
  s += text(70, 1092, "Progress = exposure strips  ·  Depth = light planes  ·  Photography = spatial and available-light", 13, c.ink, { opacity: 0.62, letter: 0.3 });
  s += "</svg>";
  return s;
}

const boards = [
  ["01-quiet-instrument", quietInstrument()],
  ["02-soft-field", softField()],
  ["03-luminous-threshold", luminousThreshold()],
];

for (const [name, svg] of boards) {
  const svgPath = path.join(outputDir, `${name}.svg`);
  const pngPath = path.join(outputDir, `${name}.png`);
  fs.writeFileSync(svgPath, svg);
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(pngPath);
  console.log(path.relative(root, pngPath));
}

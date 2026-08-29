import fs from "node:fs";
import path from "node:path";
import sharp from "../node_modules/.pnpm/sharp@0.35.3_@types+node@24.13.3/node_modules/sharp/dist/index.mjs";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "brand", "v3", "identity");
fs.mkdirSync(out, { recursive: true });

const C = {
  chalk: "#F1EFE8",
  raised: "#F8F6EF",
  graphite: "#242826",
  mineral: "#697F8C",
  peach: "#D39A83",
  fog: "#D9DEDC",
};

const rect = (x, y, w, h, fill, radius = 0, opacity = 1) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" opacity="${opacity}"/>`;

const text = (x, y, value, size, fill, anchor = "start", weight = 600, letter = 0) =>
  `<text x="${x}" y="${y}" fill="${fill}" font-family="Avenir Next, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" letter-spacing="${letter}">${value}</text>`;

const label = (x, y, value) => text(x, y, value.toUpperCase(), 13, C.graphite, "start", 650, 2);

function mark(kind, x, y, size, dark = false) {
  const ink = dark ? C.chalk : C.graphite;
  const blue = dark ? "#A7B5BA" : C.mineral;
  const peach = C.peach;
  const u = size / 12;
  let s = "";

  if (kind === 1) {
    const m = 4.1 * u;
    s += rect(x, y, m, m, ink, .45 * u);
    s += rect(x + 5.2 * u, y, m, m, ink, .45 * u);
    s += rect(x, y + 5.2 * u, m, m, ink, .45 * u);
    s += rect(x + 6.2 * u, y + 5.9 * u, m, m, peach, .45 * u);
  }
  if (kind === 2) {
    for (let row = 0; row < 3; row += 1) {
      s += rect(x, y + row * 3.2 * u, 4.25 * u, 1.75 * u, row === 1 ? blue : ink, .42 * u);
      s += rect(x + (row === 1 ? 7.45 : 6.15) * u, y + row * 3.2 * u, 4.25 * u, 1.75 * u, row === 1 ? peach : ink, .42 * u);
    }
  }
  if (kind === 3) {
    for (let row = 0; row < 4; row += 1) {
      const d = row === 2 ? 1.2 : 0;
      s += rect(x - d * u, y + row * 2.35 * u, 3.7 * u, 1.25 * u, row === 2 ? blue : ink, .3 * u);
      s += rect(x + (6.1 + d) * u, y + row * 2.35 * u, 3.7 * u, 1.25 * u, row === 2 ? peach : ink, .3 * u);
    }
  }
  if (kind === 4) {
    s += rect(x, y, 3.2 * u, 8.8 * u, ink, .35 * u);
    s += rect(x + 4.4 * u, y, 3.2 * u, 4 * u, blue, .35 * u);
    s += rect(x + 5.5 * u, y + 5.1 * u, 3.2 * u, 4 * u, peach, .35 * u);
  }
  if (kind === 5) {
    const m = 2.6 * u;
    [[0,0],[3.5,0],[7,0],[0,3.5],[7,3.5],[0,7],[3.5,7],[8.2,7.5]].forEach(([dx,dy], i) => {
      s += rect(x + dx*u, y + dy*u, m, m, i === 7 ? peach : i === 4 ? blue : ink, .32*u);
    });
  }
  if (kind === 6) {
    for (let row = 0; row < 3; row += 1) {
      const left = row === 1 ? -1.1 : 0;
      const right = row === 1 ? 1.1 : 0;
      s += rect(x + left*u, y + row*3.15*u, 4.4*u, 1.85*u, row === 1 ? blue : ink, .38*u);
      s += rect(x + (5.6+right)*u, y + row*3.15*u, 4.4*u, 1.85*u, row === 1 ? peach : ink, .38*u);
    }
  }
  if (kind === 7) {
    for (let i = 0; i < 5; i += 1) {
      const leftW = (2.7 + (i % 2) * .8) * u;
      const rightX = (6.2 + (i === 2 ? 1.1 : 0)) * u;
      s += rect(x, y + i*1.9*u, leftW, 1.05*u, i === 2 ? blue : ink, .26*u);
      s += rect(x + rightX, y + i*1.9*u, (3.7 - (i%2)*.7)*u, 1.05*u, i === 2 ? peach : ink, .26*u);
    }
  }
  if (kind === 8) {
    const pieces = [
      [0,0,3.4,2.1],[4.6,0,4.9,2.1],[0,3.2,4.6,2.1],[6.2,3.2,3.3,2.1],[0,6.4,3.4,2.1],[5.2,6.8,4.3,2.1],
    ];
    pieces.forEach(([dx,dy,w,h], i) => s += rect(x+dx*u,y+dy*u,w*u,h*u,i===3?peach:i===2?blue:ink,.4*u));
  }
  if (kind === 9) {
    const m = 3.15*u;
    [[0,0],[4.25,0],[0,4.25],[5.4,4.9]].forEach(([dx,dy],i) => {
      s += rect(x+dx*u,y+dy*u,m,m,i===3?peach:ink,i===3?1.1*u:.35*u);
    });
  }
  if (kind === 10) {
    for (let row = 0; row < 4; row += 1) {
      const leftX = row === 1 ? -.8 : 0;
      const rightX = row === 2 ? 7.1 : 6;
      s += rect(x+leftX*u,y+row*2.35*u,3.4*u,1.25*u,row===1?blue:ink,.28*u);
      s += rect(x+rightX*u,y+row*2.35*u,3.4*u,1.25*u,row===2?peach:ink,.28*u);
    }
  }
  if (kind === 11) {
    s += rect(x,y,3.3*u,8.8*u,ink,.4*u);
    s += rect(x+4.6*u,y,5.2*u,2.8*u,ink,.4*u);
    s += rect(x+4.6*u,y+3.9*u,3.9*u,2.8*u,blue,.4*u);
    s += rect(x+6*u,y+7.8*u,3.8*u,2.8*u,peach,.4*u);
  }
  if (kind === 12) {
    const pieces = [[0,0],[3.2,0],[6.4,0],[0,3.2],[6.4,3.2],[0,6.4],[3.2,6.4],[7.5,6.9]];
    pieces.forEach(([dx,dy],i) => s += rect(x+dx*u,y+dy*u,2.2*u,2.2*u,i===7?peach:i===4?blue:ink,.28*u));
  }
  return s;
}

function studySvg() {
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1125" viewBox="0 0 1800 1125">`;
  s += rect(0,0,1800,1125,C.chalk);
  s += label(70,68,"Identity / icon study");
  s += text(70,132,"The pause is negative space.",58,C.graphite,"start",520,-2.3);
  s += text(72,174,"Twelve constructions tested as a mark, an app icon and a 32 px glyph.",18,C.graphite,"start",470,.2);
  s += rect(70,204,1660,1,C.graphite,0,.16);

  const selected = 6;
  for (let k=1;k<=12;k+=1) {
    const col=(k-1)%6;
    const row=Math.floor((k-1)/6);
    const x=70+col*275;
    const y=250+row*310;
    s += rect(x,y,210,210,k===selected?C.graphite:C.raised,28,1);
    s += mark(k,x+53,y+52,112,k===selected);
    s += text(x,y+242,`0${k}`.slice(-2),11,C.graphite,"start",700,1.2);
    s += text(x+34,y+241,k===selected?"SELECT / FIELD APERTURE":"TRIAL",11,k===selected?C.mineral:C.graphite,"start",650,.6);
    s += rect(x+166,y+224,32,32,k===selected?C.graphite:C.raised,6,1);
    s += mark(k,x+172,y+230,20,k===selected);
  }

  s += rect(70,882,1660,1,C.graphite,0,.16);
  s += label(70,927,"Selection criteria");
  s += text(70,970,"32 px legibility",17,C.graphite,"start",560);
  s += text(345,970,"not a literal pause icon",17,C.graphite,"start",560);
  s += text(690,970,"not an app-grid tile",17,C.graphite,"start",560);
  s += text(1010,970,"behavior before decoration",17,C.graphite,"start",560);
  s += text(1395,970,"one-color fallback",17,C.graphite,"start",560);
  s += text(70,1048,"Selected 06: six measured modules open around the center; the offset pair records the moment of choice.",24,C.graphite,"start",540,-.3);
  s += `</svg>`;
  return s;
}

function finalMarkSvg({ dark = false, size = 512, padding = 0 } = {}) {
  const bg = dark ? C.graphite : C.chalk;
  const markSize = size - padding*2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${padding ? rect(0,0,size,size,bg) : ""}${mark(6,padding,padding,markSize,dark)}</svg>`;
}

function appIconSvg(dark = false) {
  const bg = dark ? C.graphite : C.chalk;
  const size = 580;
  const unit = size / 12;
  // Mark 06 spans -1.1…11.1u horizontally and 0…8.15u vertically.
  // Position those actual bounds—not the nominal 12u square—on the icon center.
  const x = 512 - 5 * unit;
  const y = 512 - 4.075 * unit;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${rect(0,0,1024,1024,bg)}${mark(6,x,y,size,dark)}</svg>`;
}

function adaptiveForegroundSvg() {
  const size = 470;
  const unit = size / 12;
  const x = 512 - 5 * unit;
  const y = 512 - 4.075 * unit;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${mark(6,x,y,size,false)}</svg>`;
}

function lockupSvg(dark = false) {
  const bg = dark ? C.graphite : C.chalk;
  const ink = dark ? C.chalk : C.graphite;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="840" height="220" viewBox="0 0 840 220">${rect(0,0,840,220,bg)}${mark(6,58,62,102,dark)}${text(200,149,"Still",112,ink,"start",650,-5.5)}</svg>`;
}

const files = new Map([
  ["icon-study", studySvg()],
  ["field-aperture-mark", finalMarkSvg({ size: 512, padding: 48 })],
  ["field-aperture-mark-dark", finalMarkSvg({ dark: true, size: 512, padding: 48 })],
  ["app-icon", appIconSvg(false)],
  ["app-icon-dark", appIconSvg(true)],
  ["adaptive-foreground", adaptiveForegroundSvg()],
  ["still-lockup", lockupSvg(false)],
  ["still-lockup-dark", lockupSvg(true)],
]);

for (const [name, svg] of files) {
  fs.writeFileSync(path.join(out, `${name}.svg`), svg);
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(path.join(out, `${name}.png`));
  console.log(path.relative(root,path.join(out,`${name}.png`)));
}

for (const size of [32, 64, 128, 512, 1024]) {
  await sharp(Buffer.from(appIconSvg(false))).resize(size,size).png({compressionLevel:9}).toFile(path.join(out,`app-icon-${size}.png`));
}

await sharp(Buffer.from(adaptiveForegroundSvg())).resize(512,512).png({compressionLevel:9}).toFile(path.join(out,"splash-mark-512.png"));

for (const [density, size] of Object.entries({ mdpi: 128, hdpi: 192, xhdpi: 256, xxhdpi: 384, xxxhdpi: 512 })) {
  await sharp(Buffer.from(adaptiveForegroundSvg())).resize(size, size).png({compressionLevel:9}).toFile(path.join(out,`splash-mark-${density}.png`));
}

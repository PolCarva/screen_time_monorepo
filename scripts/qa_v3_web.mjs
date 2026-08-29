import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "/Users/pablocarvalho/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "brand", "v3", "qa");
const base = "http://localhost:3000";

async function inspect(browser, name, viewport) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(base, { waitUntil: "networkidle" });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(out, `web-home-${name}.png`), fullPage: true });
  const metrics = await page.evaluate(() => ({
    title: document.title,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    h1: document.querySelector("h1")?.textContent?.trim(),
    factCount: document.querySelectorAll(".hero-v3__facts > div").length,
    fieldModules: document.querySelectorAll(".field i").length,
    images: Array.from(document.images).map((img) => ({ src: img.currentSrc, complete: img.complete, width: img.naturalWidth })),
    cta: document.querySelector("#beta-status")?.textContent?.trim().slice(0, 80),
  }));
  if (metrics.scrollWidth !== metrics.clientWidth) throw new Error(`horizontal overflow ${JSON.stringify(metrics)}`);
  if (metrics.factCount !== 4 || metrics.fieldModules < 60) throw new Error(`missing product evidence ${JSON.stringify(metrics)}`);
  if (!metrics.images.every((image) => image.complete && image.width > 0)) throw new Error(`image failed ${JSON.stringify(metrics.images)}`);
  if (!metrics.h1?.toLowerCase().includes("segundo") || !metrics.cta) throw new Error(`narrative missing ${JSON.stringify(metrics)}`);
  return { page, metrics, errors };
}

const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--disable-gpu", "--no-sandbox"],
});

try {
  const desktop = await inspect(browser, "desktop", { width: 1440, height: 1000 });
  const impactLink = desktop.page.getByRole("link", { name: "Impacto", exact: true }).first();
  if (await impactLink.getAttribute("href") !== "/impact") throw new Error("impact link target failed");
  await desktop.page.goto(`${base}/impact`, { waitUntil: "networkidle" });
  await desktop.page.screenshot({ path: path.join(out, "web-impact-desktop.png"), fullPage: true });
  const impactCount = await desktop.page.locator(".impact-ledger").count();
  if (!desktop.page.url().includes("/impact") || impactCount !== 1) throw new Error(`impact route failed: ${desktop.page.url()} / ${impactCount}`);

  const mobile = await inspect(browser, "mobile", { width: 390, height: 844 });
  const errors = [...desktop.errors, ...mobile.errors];
  console.log(JSON.stringify({ desktop: desktop.metrics, mobile: mobile.metrics, errors, screenshots: ["web-home-desktop.png", "web-home-mobile.png", "web-impact-desktop.png"] }, null, 2));
  if (errors.length) throw new Error(errors.join("\n"));
} finally {
  await browser.close();
}

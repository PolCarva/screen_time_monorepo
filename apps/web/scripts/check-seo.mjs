/**
 * Checks every page in the sitemap of a running site (docs/landing-seo-plan.md,
 * F5): one <h1>, title ≤ 60 and description ≤ 155 characters, both unique,
 * canonical, Open Graph image and valid JSON-LD.
 *
 *   pnpm --filter web seo:check [http://localhost:3000]
 */
const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/+$/, "");
const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
  (match) => new URL(match[1]).pathname,
);

const decode = (value) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
const meta = (html, pattern) => {
  const match = html.match(pattern);
  return match ? decode(match[1]) : null;
};

const problems = [];
const titles = new Map();
const descriptions = new Map();
for (const path of paths) {
  const html = await (await fetch(`${base}${path}`)).text();
  const title = meta(html, /<title>([^<]*)<\/title>/);
  const description = meta(html, /<meta name="description" content="([^"]*)"/);
  const h1 = (html.match(/<h1[\s>]/g) ?? []).length;
  const canonical = meta(html, /<link rel="canonical" href="([^"]*)"/);
  const image = meta(html, /<meta property="og:image" content="([^"]*)"/);
  const say = (text) => problems.push(`${path}: ${text}`);
  if (!title) say("no <title>");
  else if (title.length > 60) say(`title has ${title.length} characters`);
  if (!description) say("no meta description");
  else if (description.length > 155) say(`description has ${description.length} characters`);
  if (h1 !== 1) say(`${h1} <h1> elements`);
  if (!canonical) say("no canonical");
  if (!image) say("no og:image");
  for (const block of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) {
    try {
      JSON.parse(block[1]);
    } catch {
      say("invalid JSON-LD");
    }
  }
  if (title) titles.set(title, [...(titles.get(title) ?? []), path]);
  if (description) descriptions.set(description, [...(descriptions.get(description) ?? []), path]);
  console.log(`${path.padEnd(38)} title ${String(title?.length ?? 0).padStart(2)} · description ${String(description?.length ?? 0).padStart(3)} · h1 ${h1}`);
}
for (const [value, where] of [...titles, ...descriptions])
  if (where.length > 1) problems.push(`repeated in ${where.join(", ")}: ${value}`);

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s):\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`\n${paths.length} pages OK.`);

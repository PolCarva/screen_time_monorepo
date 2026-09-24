/**
 * Tells Bing, Yandex and the other IndexNow engines about every URL in the
 * sitemap (docs/landing-seo-plan.md, D22). Run after a deploy that adds or
 * changes pages: pnpm --filter web indexnow
 */
const KEY = "c635beb930eaccf9dd750313bc0b05dc";
const site = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
if (!site.startsWith("https://")) {
  console.error("NEXT_PUBLIC_APP_URL must be the public https origin.");
  process.exit(1);
}

const sitemap = await fetch(`${site}/sitemap.xml`).then((response) => {
  if (!response.ok) throw new Error(`sitemap: HTTP ${response.status}`);
  return response.text();
});
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
if (urlList.length === 0) throw new Error("The sitemap has no URLs.");

const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host: new URL(site).host,
    key: KEY,
    keyLocation: `${site}/${KEY}.txt`,
    urlList,
  }),
});
console.log(`IndexNow: ${response.status} for ${urlList.length} URLs`);
if (!response.ok && response.status !== 202) process.exit(1);

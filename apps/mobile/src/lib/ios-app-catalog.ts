/**
 * Apps Still can return to directly on iOS. Apple never exposes another app's
 * bundle identifier, so the catalog is matched by the display name the
 * Shortcuts automation hands to the App Intent.
 *
 * Every scheme listed here must also appear in `LSApplicationQueriesSchemes`
 * (ios/Still/Info.plist) so `canOpenURL` can tell which apps are installed.
 * iOS caps that list at 50 entries.
 */
export type CatalogApp = {
  readonly id: string;
  readonly name: string;
  /** Other display names the same app is known by, e.g. "Twitter" for X. */
  readonly aliases: readonly string[];
  /** Scheme without the trailing `://`. */
  readonly scheme: string;
};

export const IOS_APP_CATALOG: readonly CatalogApp[] = [
  { id: "instagram", name: "Instagram", aliases: [], scheme: "instagram" },
  { id: "tiktok", name: "TikTok", aliases: [], scheme: "tiktok" },
  { id: "youtube", name: "YouTube", aliases: [], scheme: "youtube" },
  { id: "x", name: "X", aliases: ["Twitter"], scheme: "twitter" },
  { id: "facebook", name: "Facebook", aliases: [], scheme: "fb" },
  { id: "threads", name: "Threads", aliases: [], scheme: "barcelona" },
  { id: "snapchat", name: "Snapchat", aliases: [], scheme: "snapchat" },
  { id: "reddit", name: "Reddit", aliases: [], scheme: "reddit" },
  { id: "whatsapp", name: "WhatsApp", aliases: [], scheme: "whatsapp" },
  { id: "telegram", name: "Telegram", aliases: [], scheme: "tg" },
  { id: "messenger", name: "Messenger", aliases: [], scheme: "fb-messenger" },
  { id: "discord", name: "Discord", aliases: [], scheme: "discord" },
  { id: "netflix", name: "Netflix", aliases: [], scheme: "nflx" },
  { id: "twitch", name: "Twitch", aliases: [], scheme: "twitch" },
  { id: "disney-plus", name: "Disney+", aliases: [], scheme: "disneyplus" },
  { id: "prime-video", name: "Prime Video", aliases: [], scheme: "aiv" },
  { id: "spotify", name: "Spotify", aliases: [], scheme: "spotify" },
  { id: "pinterest", name: "Pinterest", aliases: [], scheme: "pinterest" },
  { id: "linkedin", name: "LinkedIn", aliases: [], scheme: "linkedin" },
  { id: "tumblr", name: "Tumblr", aliases: [], scheme: "tumblr" },
  { id: "bluesky", name: "Bluesky", aliases: [], scheme: "bluesky" },
  { id: "bereal", name: "BeReal", aliases: ["BeReal."], scheme: "bereal" },
  { id: "tinder", name: "Tinder", aliases: [], scheme: "tinder" },
  { id: "bumble", name: "Bumble", aliases: [], scheme: "bumble" },
  {
    id: "amazon",
    name: "Amazon",
    aliases: ["Amazon Shopping"],
    scheme: "com.amazon.mobile.shopping",
  },
  { id: "temu", name: "Temu", aliases: [], scheme: "temu" },
  { id: "aliexpress", name: "AliExpress", aliases: [], scheme: "aliexpress" },
  {
    id: "mercado-libre",
    name: "Mercado Libre",
    aliases: ["Mercado Livre"],
    scheme: "meli",
  },
  { id: "chrome", name: "Chrome", aliases: ["Google Chrome"], scheme: "googlechrome" },
  { id: "gmail", name: "Gmail", aliases: [], scheme: "googlegmail" },
  { id: "roblox", name: "Roblox", aliases: [], scheme: "roblox" },
  { id: "clash-royale", name: "Clash Royale", aliases: [], scheme: "clashroyale" },
];

/**
 * Collapses a display name to the key both JavaScript and Swift compare.
 * Swift mirrors this in `ShortcutTargetStore.normalize`: fold case and
 * diacritics, then keep ASCII letters and digits only. Names with no ASCII
 * content fall back to their trimmed lowercase form so they still match
 * themselves.
 */
export function normalizeAppName(name: string): string {
  const trimmed = name.trim();
  const folded = trimmed
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return folded || trimmed.toLowerCase();
}

export function catalogUrl(app: Pick<CatalogApp, "scheme">): string {
  return `${app.scheme}://`;
}

export function findCatalogApp(name: string): CatalogApp | undefined {
  const key = normalizeAppName(name);
  if (!key) return undefined;
  return IOS_APP_CATALOG.find(
    (app) =>
      normalizeAppName(app.name) === key ||
      app.aliases.some((alias) => normalizeAppName(alias) === key),
  );
}

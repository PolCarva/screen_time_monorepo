export function safeLocalRedirect(
  requested: string | null,
  fallback = "/admin",
): string {
  if (
    !requested?.startsWith("/") ||
    requested.startsWith("//") ||
    requested.includes("\\")
  )
    return fallback;
  try {
    const base = "https://still.invalid";
    const resolved = new URL(requested, base);
    if (resolved.origin !== base) return fallback;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}

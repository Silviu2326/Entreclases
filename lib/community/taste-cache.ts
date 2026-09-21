import { coverUrl, type Taste } from "./tastes";

const CACHE_NAME = "entreclase-taste-covers-v1";

// Covers are public catalogue art. Keep a browser-local copy so opening a
// profile does not download the same poster again. If a provider blocks CORS,
// the caller simply keeps using the original URL.
export async function cacheTasteCover(taste: Taste) {
  if (typeof window === "undefined" || !("caches" in window)) return;
  const url = coverUrl(taste);
  if (!url) return;
  try {
    const cache = await window.caches.open(CACHE_NAME);
    if (await cache.match(url)) return;
    const response = await fetch(url, { mode: "cors" });
    if (response.ok || response.type === "opaque") await cache.put(url, response.clone());
  } catch {
    // A catalogue image is an enhancement; the original URL remains usable.
  }
}

export async function getCachedTasteCover(taste: Taste): Promise<string | undefined> {
  if (typeof window === "undefined" || !("caches" in window)) return undefined;
  const url = coverUrl(taste);
  if (!url) return undefined;
  try {
    const response = await (await window.caches.open(CACHE_NAME)).match(url);
    if (!response) return undefined;
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch {
    return undefined;
  }
}

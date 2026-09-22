// The showcase: a shop window on the profile. Three finishes, five kinds of
// piece, and an audience per piece. PostgreSQL decides who sees what; this
// module only names the vocabulary and reads links.
export const showcaseFrames = ["madera", "cristal", "neon"] as const;
export type ShowcaseFrame = typeof showcaseFrames[number];
export const showcaseKinds = ["link", "note", "story", "media", "file"] as const;
export type ShowcaseKind = typeof showcaseKinds[number];
export const showcaseAudiences = ["everyone", "campus", "contacts", "chosen", "only_me"] as const;
export type ShowcaseAudience = typeof showcaseAudiences[number];
export type ShowcaseMediaKind = "image" | "video" | "pdf";
export const showcaseLimits = { title: 120, body: 1200, url: 500, viewers: 50, pieces: 24 } as const;

// Only the three shapes people actually paste. A match is a video id, so the
// piece can show its thumbnail and play inside the window, nocookie, on tap.
export function youtubeId(url: string): string | null {
  let parsed: URL;
  try { parsed = new URL(url); } catch { return null; }
  const host = parsed.hostname.replace(/^(www|m)\./, "");
  const id = host === "youtu.be" ? parsed.pathname.slice(1)
    : host === "youtube.com" || host === "youtube-nocookie.com"
      ? (parsed.pathname === "/watch" ? parsed.searchParams.get("v") : parsed.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/)?.[1]) ?? null
      : null;
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}
export const youtubeThumbnail = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const youtubeEmbed = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
export function linkHost(url: string) { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } }

// A stored piece lives under <owner>/<uuid>.<ext>; anything else is a demo asset.
export const showcasePathPattern = /^[a-f0-9-]{36}\/[a-f0-9-]{36}\.(jpg|png|webp|gif|mp4|webm|pdf)$/;
export const isStoredPiece = (value?: string | null) => !!value && !value.startsWith("/") && !value.startsWith("blob:") && !value.startsWith("data:");

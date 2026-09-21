import type { NextConfig } from "next";

// NEXT_PUBLIC values are embedded in browser bundles. Stop before compiling if
// a server credential or incomplete configuration was supplied by mistake.
const authUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const authKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
let publicKey = authKey.startsWith("sb_publishable_") && authKey.length > 25;
if (!publicKey && authKey) {
  try { publicKey = JSON.parse(Buffer.from(authKey.split(".")[1], "base64url").toString()).role === "anon"; }
  catch { publicKey = false; }
}
if ((authUrl || authKey) && (!/^https:\/\/[^/]+\/?$/.test(authUrl) || !publicKey)) {
  throw new Error("Supabase requires an HTTPS project URL and a public publishable/anon key. Never use a server secret in NEXT_PUBLIC variables.");
}

const nextConfig: NextConfig = {
  distDir: process.env.ENTRECLASE_DIST_DIR || ".next",
  output: "export",
  turbopack: { root: process.cwd() },
  allowedDevOrigins: ["127.0.0.1"],
  // Covers come from the public catalogues the picker searches. Only these hosts
  // are ever used: lib/community/tastes.ts rebuilds every URL from a fixed base.
  images: { unoptimized: true, remotePatterns: [
    // Profile photos and banners come back as signed links from the project's
    // own private storage bucket.
    ...(authUrl ? [{ protocol: "https" as const, hostname: new URL(authUrl).hostname }] : []),
    { protocol: "https", hostname: "image.tmdb.org" },
    { protocol: "https", hostname: "media.rawg.io" },
    { protocol: "https", hostname: "is1-ssl.mzstatic.com" },
    { protocol: "https", hostname: "images.igdb.com" },
    { protocol: "https", hostname: "coverartarchive.org" },
    { protocol: "https", hostname: "i.scdn.co" },
    { protocol: "https", hostname: "static.tvmaze.com" },
    { protocol: "https", hostname: "commons.wikimedia.org" },
    { protocol: "https", hostname: "m.media-amazon.com" },
  ] },
  poweredByHeader: false,
  trailingSlash: true,
  experimental: { optimizePackageImports: ["lucide-react"] },
};
export default nextConfig;

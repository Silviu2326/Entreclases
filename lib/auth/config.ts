const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

function isPublicKey(value: string) {
  if (value.startsWith("sb_publishable_")) return value.length > 25;
  try { return JSON.parse(atob(value.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role === "anon"; }
  catch { return false; }
}

export const supabaseConfigured = /^https:\/\/[^/]+\/?$/.test(url) && isPublicKey(key);
// A reachable project is not necessarily ready: its university policies,
// community schema and email redirects must be installed before opening Auth.
export const authConfigured = supabaseConfigured && process.env.NEXT_PUBLIC_SUPABASE_AUTH_ENABLED === "true";
export const authConfiguration = { url, key };

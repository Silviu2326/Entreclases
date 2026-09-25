import { getPublicClient } from "../auth/client";
import { supabaseConfigured } from "../auth/config";
import { normalizeEmail } from "../auth/validation";
import type { Locale } from "../i18n/routes";

// Auth may still be closed while the list collects addresses: a reachable
// project with the waitlist migration applied is all this needs.
export const waitlistConfigured = supabaseConfigured;
export type WaitlistSource = "landing" | "roadmap" | "blog";
export type WaitlistResult = "saved" | "unavailable" | "rate_limited" | "failed";

export async function joinWaitlist(email: string, locale: Locale, source: WaitlistSource): Promise<WaitlistResult> {
 if (!waitlistConfigured) return "unavailable";
 try {
   const client = getPublicClient();
  const { error } = await client.rpc("universe_join_waitlist", {
   p_email: normalizeEmail(email),
   p_locale: locale,
   p_source: source,
  });
  // A repeated address deliberately returns the same success response. The
  // database function also owns the global throttle so direct table writes are
  // no longer possible from an anonymous browser.
  if (!error || error.code === "23505") return "saved";
  if (error.code === "P0001" && /WAITLIST_RATE_LIMIT/.test(error.message ?? "")) return "rate_limited";
  return error.code === "42P01" || error.code === "PGRST202" || error.code === "PGRST205" ? "unavailable" : "failed";
 } catch { return "unavailable"; }
}

// Everyone may leave an address; only a verified university account gets in on
// the opening day. The form says this before asking, not after.
export function waitlistMailto(email: string, locale: Locale) {
 const subject = locale === "va" ? "Vull entrar a Entreclases" : "Quiero entrar en Entreclases";
 const body = (locale === "va" ? "Apunteu-me a la llista.\n\nCorreu: " : "Apuntadme a la lista.\n\nCorreo: ") + normalizeEmail(email);
 return `mailto:hola@entreclases.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

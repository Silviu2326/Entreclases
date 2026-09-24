import { getPublicClient } from "../auth/client";
import { supabaseConfigured } from "../auth/config";
import { normalizeEmail } from "../auth/validation";
import type { Locale } from "../i18n/routes";

// Auth may still be closed while the list collects addresses: a reachable
// project with the waitlist migration applied is all this needs.
export const waitlistConfigured = supabaseConfigured;
export type WaitlistSource = "landing" | "roadmap" | "blog";
export type WaitlistResult = "saved" | "unavailable" | "failed";

export async function joinWaitlist(email: string, locale: Locale, source: WaitlistSource): Promise<WaitlistResult> {
 if (!waitlistConfigured) return "unavailable";
 try {
  const client = getPublicClient(), row = { email: normalizeEmail(email), locale, source };
  let { error } = await client.from("universe_waitlist").insert(row);
  // Until migration 202609260028 admits the blog as an origin, the server
  // rejects it (23514). The address still matters more than its origin.
  if (error?.code === "23514" && source === "blog") ({ error } = await client.from("universe_waitlist").insert({ ...row, source: "landing" }));
  // A repeated address is already on the list; answering the same way for both
  // keeps the form from telling a stranger who signed up.
  if (!error || error.code === "23505") return "saved";
  // The table is missing or unreachable: say so instead of pretending it saved.
  return error.code === "42P01" || error.code === "PGRST205" ? "unavailable" : "failed";
 } catch { return "unavailable"; }
}

// Everyone may leave an address; only a verified university account gets in on
// the opening day. The form says this before asking, not after.
export function waitlistMailto(email: string, locale: Locale) {
 const subject = locale === "va" ? "Vull entrar a Entreclases" : "Quiero entrar en Entreclases";
 const body = (locale === "va" ? "Apunteu-me a la llista.\n\nCorreu: " : "Apuntadme a la lista.\n\nCorreo: ") + normalizeEmail(email);
 return `mailto:hola@entreclases.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

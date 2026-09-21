export const invitationTokenPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readInvitation(hash: string) {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const token = params.get("plus-one") ?? "";
  return { token: invitationTokenPattern.test(token) ? token : "", invalid: params.has("plus-one") && !invitationTokenPattern.test(token), demo: params.get("preview") === "1" };
}

export type InvitationStatus =
  | { state: "guest" | "locked" | "available" | "used" }
  | { state: "pending"; token: string; email: string; expires_at: string };

export function invitationError(error: unknown, locale: "es" | "va") {
  const e = error as { message?: string; code?: string };
  const t = (es: string, va: string) => locale === "va" ? va : es;
  if (/INVITE_ALREADY_USED/.test(e?.message ?? "")) return t("Tu invitación ya se ha utilizado.", "La teua invitació ja s’ha utilitzat.");
  if (/INVITE_NOT_ELIGIBLE/.test(e?.message ?? "")) return t("Necesitas una cuenta universitaria, completar tu perfil y participar para invitar.", "Necessites un compte universitari, completar el perfil i participar per a convidar.");
  if (/INVITE_PENDING/.test(e?.message ?? "")) return t("Ya tienes una invitación pendiente. Cancélala antes de crear otra.", "Ja tens una invitació pendent. Cancel·la-la abans de crear-ne una altra.");
  if (/INVITE_EMAIL_INVALID/.test(e?.message ?? "")) return t("Escribe el correo de la persona a la que quieres invitar, distinto del tuyo.", "Escriu el correu de la persona que vols convidar, diferent del teu.");
  if (e?.code === "PGRST202" || e?.code === "42883") return t("Tu +1 todavía no está activado. Puedes probarlo en la demo.", "El teu +1 encara no està activat. Pots provar-lo en la demo.");
  return t("No hemos podido actualizar tu invitación. Vuelve a intentarlo.", "No hem pogut actualitzar la invitació. Torna a intentar-ho.");
}

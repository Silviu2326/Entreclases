"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Link as LinkIcon, Ticket, UserRoundPlus } from "lucide-react";
import { getAuthClient } from "@/lib/auth/client";
import { invitationError, type InvitationStatus } from "@/lib/auth/invitations";
import { emailError, normalizeEmail } from "@/lib/auth/validation";
import { localPath } from "@/lib/i18n/routes";
import { useCommunity } from "./context";
import { Action, TextField } from "./controls";

export function PlusOne() {
  const { locale, demo, member, me, data } = useCommunity();
  const t = (es: string, va: string) => locale === "va" ? va : es;
  const [status, setStatus] = useState<InvitationStatus | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  const working = useRef(false);
  const storageKey = `entreclase.plus-one.demo.${member.id}`;
  const guest = member.account_kind === "guest";
  const complete = !!me.bio.trim() && me.interests.length > 0;
  const participated = data.posts.some(p => p.author_id === me.user_id) || data.comments.some(c => c.author_id === me.user_id) || data.planMembers.some(p => p.user_id === me.user_id);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        let next: InvitationStatus;
        if (demo) {
          next = guest ? { state: "guest" } : { state: complete && participated ? "available" : "locked" };
          try {
            const stored = JSON.parse(sessionStorage.getItem(storageKey) ?? "null") as InvitationStatus | null;
            if (!guest && stored?.state === "pending" && new Date(stored.expires_at).getTime() > Date.now()) next = stored;
          } catch { /* Demo storage is optional. */ }
        } else {
          const result = await getAuthClient().rpc("universe_plus_one_status");
          if (result.error) throw result.error;
          next = result.data as InvitationStatus;
        }
        if (active) { setOrigin(window.location.origin); setStatus(next); setError(""); }
      } catch (cause) { if (active) setError(invitationError(cause, locale)); }
    }
    void load();
    return () => { active = false; };
  }, [demo, guest, complete, participated, storageKey, locale]);

  const url = origin && status?.state === "pending"
    ? `${origin}${localPath(locale, "register")}#${new URLSearchParams({ "plus-one": status.token, ...(demo ? { preview: "1" } : {}) })}`
    : "";

  async function change(recipient?: string) {
    if (working.current) return;
    working.current = true; setPending(true); setError(""); setCopied(false);
    try {
      let next: InvitationStatus;
      if (demo) {
        if (guest || !complete || !participated) throw { message: "INVITE_NOT_ELIGIBLE" };
        next = recipient ? { state: "pending", token: crypto.randomUUID(), email: recipient, expires_at: new Date(Date.now() + 7 * 86400000).toISOString() } : { state: "available" };
        try { sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Optional demo persistence. */ }
      } else {
        const result = recipient ? await getAuthClient().rpc("universe_create_plus_one", { recipient }) : await getAuthClient().rpc("universe_cancel_plus_one");
        if (result.error) throw result.error;
        next = result.data as InvitationStatus;
      }
      setStatus(next);
    } catch (cause) { setError(invitationError(cause, locale)); }
    finally { working.current = false; setPending(false); }
  }

  return <section className="u-plus-one" aria-labelledby="plus-one-title">
    <div className="u-plus-one-story"><span className="u-plus-one-ticket" aria-hidden="true">+1<Ticket/></span><p className="u-eyebrow">{t("TU +1", "EL TEU +1")}</p><h2 id="plus-one-title">{guest ? t("Has venido de parte de alguien.", "Has vingut de part d’algú.") : t("Hay sitio para alguien más.", "Hi ha lloc per a algú més.")}</h2><p>{guest ? t("Tu cuenta tiene acceso por invitación. Puedes participar en planes, juegos, grupos y proyectos. Las invitaciones las crean las cuentas universitarias.", "El teu compte té accés per invitació. Pots participar en plans, jocs, grups i projectes. Les invitacions les creen els comptes universitaris.") : t("Esa persona que encajaría aquí, aunque no vaya a la uni. Puedes traerla tú.", "Eixa persona que encaixaria ací, encara que no vaja a la uni. Pots portar-la tu.")}</p></div>
    <div className="u-plus-one-action" aria-busy={pending}>
      {error && <p role="alert" className="u-form-notice">{error}</p>}
      {!status && !error && <p role="status">{t("Buscando tu invitación…", "Buscant la teua invitació…")}</p>}
      {status?.state === "locked" && <><strong>{t("Tu invitación empieza contigo.", "La teua invitació comença amb tu.")}</strong><ul className="u-plus-one-checklist"><li><Check aria-hidden="true"/>{t("Correo universitario confirmado", "Correu universitari confirmat")}</li><li data-done={complete}>{complete ? <Check aria-hidden="true"/> : <span aria-hidden="true">02</span>}{t("Una bio y al menos un interés en tu perfil", "Una bio i almenys un interés en el perfil")}</li><li data-done={participated}>{participated ? <Check aria-hidden="true"/> : <span aria-hidden="true">03</span>}{t("Publica, responde a un hilo o apúntate a un plan", "Publica, respon a un fil o apunta’t a un pla")}</li></ul></>}
      {status?.state === "available" && <form onSubmit={e => { e.preventDefault(); const recipient = normalizeEmail(String(new FormData(e.currentTarget).get("recipient") ?? "")); if (emailError(recipient) || recipient === member.email.toLowerCase()) { setError(t("Revisa el correo de tu +1. Debe ser distinto del tuyo.", "Revisa el correu del teu +1. Ha de ser diferent del teu.")); return; } void change(recipient); }}><TextField label={t("El correo de tu +1", "El correu del teu +1")} type="email" name="recipient" placeholder="colega@gmail.com" maxLength={254} required/><p className="u-small u-muted">{t("Invita a alguien de 18 años o más que haya aceptado recibirla. Solo podrá registrarse con este correo; el enlace dura 7 días.", "Convida algú de 18 anys o més que haja acceptat rebre-la. Només podrà registrar-se amb este correu; l’enllaç dura 7 dies.")}</p><p className="u-small"><a href={localPath(locale,"privacy")}>{t("Cómo se utiliza el correo de tu invitado", "Com s’utilitza el correu de la persona convidada")}</a></p><Action type="submit" disabled={pending}><UserRoundPlus/>{pending ? t("Preparando…", "Preparant…") : t("Crear mi invitación", "Crear la meua invitació")}</Action></form>}
      {status?.state === "pending" && <><p className="u-eyebrow">{t("RESERVADA PARA", "RESERVADA PER A")}</p><strong className="u-plus-one-email">{status.email}</strong><p className="u-small u-muted">{t("Caduca el ", "Caduca el ")}{new Date(status.expires_at).toLocaleDateString(locale === "va" ? "ca-ES" : "es-ES")}. {t("Copia el enlace y pásaselo. No enviamos ningún correo desde aquí.", "Copia l’enllaç i passa-li’l. No enviem cap correu des d’ací.")}</p><label className="sr-only" htmlFor="plus-one-link">{t("Enlace de invitación", "Enllaç d’invitació")}</label><input id="plus-one-link" className="u-input" readOnly value={url} onFocus={e => e.target.select()}/><div className="u-plus-one-buttons"><Action type="button" disabled={!url || pending} onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setError(t("Selecciona el enlace y cópialo manualmente.", "Selecciona l’enllaç i copia’l manualment.")); } }}>{copied ? <Check/> : <Copy/>}{copied ? t("Copiado", "Copiat") : t("Copiar invitación", "Copiar invitació")}</Action><button className="u-text-link" disabled={pending} type="button" onClick={() => void change()}>{t("Cancelar invitación", "Cancel·lar invitació")}</button></div><span role="status" className="sr-only">{copied ? t("Invitación copiada", "Invitació copiada") : ""}</span></>}
      {status?.state === "used" && <><Check className="u-plus-one-used" aria-hidden="true"/><strong>{t("Tu +1 ya tiene su sitio.", "El teu +1 ja té el seu lloc.")}</strong><p>{t("Tu invitación ya se ha utilizado. Su cuenta es independiente y no puede invitar a más personas.", "La teua invitació ja s’ha utilitzat. El seu compte és independent i no pot convidar més persones.")}</p></>}
      {status?.state === "guest" && <p className="u-plus-one-guest"><LinkIcon aria-hidden="true"/>{t("Acceso por invitación · Correo confirmado", "Accés per invitació · Correu confirmat")}</p>}
      {!guest && <p className="u-plus-one-rule">{demo ? t("Demo: el enlace permite probar el registro, pero no crea cuentas reales.", "Demo: l’enllaç permet provar el registre, però no crea comptes reals.") : t("Una persona. Una invitación. Tu +1 no podrá invitar a nadie más.", "Una persona. Una invitació. El teu +1 no podrà convidar ningú més.")}</p>}
    </div>
  </section>;
}

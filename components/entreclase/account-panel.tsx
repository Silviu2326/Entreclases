"use client";

import { createTranslator, localHref, type Locale } from "@/lib/i18n";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, LogOut, Mail, School } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAuthClient, getUniversityMember, type UniversityMember } from "@/lib/auth/client";
import { authErrorMessage } from "@/lib/auth/validation";
import { AuthError, OpeningNotice } from "./auth-controls";

export function AccountPanel({ locale = "es" }: { locale?: Locale }) {
  const tr = createTranslator(locale);
  const router = useRouter();
  const [member, setMember] = useState<UniversityMember | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    let active = true;
    async function load() {
      try { const profile = await getUniversityMember(); if (active) setMember(profile); }
      catch (cause) { if (active) setError(authErrorMessage(cause)); }
    }
    void load();
    let unsubscribe: (() => void) | undefined;
    try {
      const { data } = getAuthClient().auth.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT" && active) { setMember(null); router.replace(localHref(locale, "/login/")); }
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch { /* Unconfigured deployments show the opening notice. */ }
    return () => { active = false; unsubscribe?.(); };
  }, [router, locale]);
  async function logout() {
    setPending(true); setError("");
    try { const { error: logoutError } = await getAuthClient().auth.signOut({ scope: "local" }); if (logoutError) throw logoutError; setMember(null); router.replace(localHref(locale, "/login/")); }
    catch (cause) { setError(authErrorMessage(cause)); }
    finally { setPending(false); }
  }
  return <><p className="eyebrow">{tr("Tu cuenta de Entreclases")}</p><h1>{member ? <>{tr("Ya tienes sitio,")}<br />{member.name || tr("colega")}.</> : <>{tr("Tu sitio")}<br />{tr("empieza aquí.")}</>}</h1>{member ? <><p className="auth-intro">{tr("Correo confirmado. Lo próximo empieza con un hola.")}</p><div className="account-details"><p><BadgeCheck aria-hidden="true" /><strong>{member.account_kind==="guest"?(locale==="va"?"Accés per invitació · Correu verificat":"Acceso por invitación · Correo verificado"):tr("Correo universitario verificado")}</strong></p><p><Mail aria-hidden="true" /><span>{member.email}</span></p><p><School aria-hidden="true" /><span>{member.university}</span></p></div><Button asChild className="entreclase-button auth-submit"><Link href={localHref(locale,"/app/")}>{tr("Entrar a mi campus")}</Link></Button><Button className="entreclase-button auth-submit" onClick={logout} disabled={pending}><LogOut aria-hidden="true" />{pending ? tr("Cerrando…") : tr("Cerrar sesión")}</Button></> : <><OpeningNotice locale={locale} />{!error ? <p role="status" className="auth-intro">{tr("Comprobando tu cuenta…")}</p> : <p className="auth-intro">{tr("Inicia sesión con tu correo para ver tu cuenta.")}</p>}<Button asChild className="entreclase-button auth-submit"><Link href={localHref(locale, "/login/")}>{tr("Iniciar sesión")}</Link></Button></>}<AuthError message={error} locale={locale} /><p className="auth-switch"><Link href={localHref(locale, "/")}>{tr("Volver a Entreclases")}</Link></p></>;
}

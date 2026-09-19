"use client";

import { createTranslator, localHref, type Locale } from "@/lib/i18n";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AuthError, AuthField, OpeningNotice, PasswordField, SubmitButton } from "./auth-controls";
import { getAuthClient, getUniversityMember } from "@/lib/auth/client";
import { authErrorMessage, emailError, normalizeEmail, parseEmailAction, passwordError, type EmailAction } from "@/lib/auth/validation";

export function EmailVerification({ recovery = false, locale = "es" }: { recovery?: boolean; locale?: Locale }) {
  const tr=createTranslator(locale);
  const router = useRouter();
  const [action, setAction] = useState<EmailAction | null>(null);
  const [ready, setReady] = useState(false);
  const [verified, setVerified] = useState(false);
  const [complete, setComplete] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [issues, setIssues] = useState<Record<string, string>>({});
  const working = useRef(false);
  const retryAt = useRef(0);
  const captured = useRef(false);

  useEffect(() => {
    if (captured.current) return;
    captured.current = true;
    const parsed = parseEmailAction(window.location.search, window.location.hash, recovery ? "recovery" : "email");
    // Keep the pending fragment available when switching language; it never
    // enters an HTTP request. Remove it immediately before consumption.
    queueMicrotask(() => { setAction(parsed); setReady(true); });
  }, [recovery]);

  async function confirm() {
    if (!action || working.current) return;
    working.current = true; setPending(true); setError("");
    try {
      window.history.replaceState(null, "", window.location.pathname);
      window.dispatchEvent(new PopStateEvent("popstate"));
      const client = getAuthClient();
      const result = "code" in action ? await client.auth.exchangeCodeForSession(action.code) : await client.auth.verifyOtp({ token_hash: action.tokenHash, type: action.type });
      if (result.error) throw result.error;
      if (!result.data.session) throw { code: "otp_expired" };
      if (recovery) setVerified(true);
      else {
        try { await getUniversityMember(); }
        catch (cause) { await client.auth.signOut({ scope: "local" }); throw cause; }
        router.replace(localHref(locale, "/app/"));
      }
    } catch (cause) { setError(authErrorMessage(cause)); }
    finally { working.current = false; setPending(false); }
  }

  async function newPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!verified || working.current) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const password = String(values.get("password") ?? "");
    const nextIssues = { password: passwordError(password), confirmation: password !== values.get("confirmation") ? "Las dos contraseñas no coinciden." : "" };
    setIssues(nextIssues); setError("");
    if (nextIssues.password || nextIssues.confirmation) { (form.elements.namedItem(nextIssues.password ? "password" : "confirmation") as HTMLInputElement)?.focus(); return; }
    working.current = true; setPending(true);
    try {
      const client = getAuthClient();
      const { error: updateError } = await client.auth.updateUser({ password });
      if (updateError) throw updateError;
      const { error: logoutError } = await client.auth.signOut({ scope: "global" });
      setComplete(true); setVerified(false);
      if (logoutError) setError("Tu contraseña está guardada, pero no hemos podido cerrar las otras sesiones. Revisa tu conexión.");
    } catch (cause) { setError(authErrorMessage(cause)); }
    finally { working.current = false; setPending(false); }
  }

  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (working.current) return;
    const form = event.currentTarget;
    const email = normalizeEmail(String(new FormData(form).get("email") ?? ""));
    const validation = emailError(email, true);
    setIssues({ email: validation }); setNotice(""); setError("");
    if (validation) { (form.elements.namedItem("email") as HTMLInputElement)?.focus(); return; }
    if (Date.now() < retryAt.current) { setError("Espera un minuto antes de pedir otro enlace."); return; }
    working.current = true; setPending(true);
    try {
      const { error: resendError } = await getAuthClient().auth.resend({ type: "signup", email, options: { emailRedirectTo: `${window.location.origin}${localHref(locale, "/verificar/")}` } });
      if (resendError) throw resendError;
      retryAt.current = Date.now() + 60_000;
      setNotice("Si hay una cuenta pendiente de confirmar, recibirás otro enlace. Mira también en spam.");
    } catch (cause) { setError(authErrorMessage(cause)); }
    finally { working.current = false; setPending(false); }
  }

  return <>
    <p className="eyebrow">{recovery ? tr("Recuperar tu cuenta") : tr("Paso 02 · Tu correo")}</p>
    <h1>{complete ? <>{tr("Ya está.")}<br />{tr("Vuelve a tu gente.")}</> : recovery ? <>{tr("Una contraseña nueva.")}<br />{tr("Tú, el de siempre.")}</> : <>{tr("Ese correo es tuyo.")}<br />{tr("Confírmalo.")}</>}</h1>
    <p className="auth-intro">{complete ? tr("La contraseña se ha actualizado. Ya puedes iniciar sesión con la nueva.") : verified ? tr("Elige una frase que recuerdes. Mejor si no es el nombre de tu perro.") : action ? tr("Pulsa el botón para continuar con el enlace que has recibido.") : recovery ? tr("Abre el enlace del correo de recuperación. Si ha caducado, puedes pedir otro.") : tr("Abre el enlace que has recibido en el correo de la uni. ¿No aparece? Puedes pedir otro aquí.")}</p>
    <OpeningNotice locale={locale} />
    {!ready ? <p className="auth-subtle" role="status">{tr("Comprobando el enlace…")}</p> : complete ? <Button asChild className="entreclase-button auth-submit"><Link href={localHref(locale, "/login/")}>{tr("Volver a entrar")}</Link></Button> : verified ? <form method="post" onSubmit={newPassword} className="auth-form" noValidate><PasswordField label={tr("Nueva contraseña")} autoComplete="new-password" required error={issues.password} hint={tr("Al menos 12 caracteres. Puedes usar espacios.")} locale={locale} /><PasswordField id="confirmation" label={tr("Repítela una vez")} autoComplete="new-password" required error={issues.confirmation} locale={locale} /><SubmitButton pending={pending} locale={locale}>{tr("Guardar mi contraseña")}</SubmitButton></form> : action ? <Button className="entreclase-button auth-submit" onClick={confirm} disabled={pending}>{pending ? tr("Comprobando…") : recovery ? tr("Elegir otra contraseña") : tr("Confirmar mi correo")}</Button> : recovery ? <Button asChild className="entreclase-button auth-submit"><Link href={localHref(locale, "/recuperar-contrasena/")}>{tr("Pedir otro enlace")}</Link></Button> : <form method="post" onSubmit={resend} className="auth-form" noValidate><AuthField id="verification-email" name="email" label={tr("Correo universitario")} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} required error={issues.email} placeholder={tr("tu.nombre@tu-universidad.es")} locale={locale} /><SubmitButton pending={pending} locale={locale}>{tr("Pedir otro enlace")}</SubmitButton></form>}
    <AuthError message={error} locale={locale} />
    {notice ? <p className="auth-success" role="status">{tr(notice)}</p> : null}
    {action && error ? <p className="auth-switch"><Link href={recovery ? localHref(locale, "/recuperar-contrasena/") : localHref(locale, "/verificar/")} onClick={() => setAction(null)}>{tr("Pedir un enlace nuevo")}</Link></p> : null}
    <p className="auth-switch"><Link href={localHref(locale, "/login/")}>{tr("Volver al inicio de sesión")}</Link></p>
  </>;
}

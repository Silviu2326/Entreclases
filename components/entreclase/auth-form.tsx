"use client";

import { createTranslator, localHref, type Locale } from "@/lib/i18n";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { unicoinCopy } from "@/lib/i18n/unicoins";
import { Check, MailCheck, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthError, AuthField, OpeningNotice, PasswordField, SubmitButton } from "./auth-controls";
import { getAuthClient, getUniversityMember } from "@/lib/auth/client";
import { authErrorMessage, emailError, normalizeEmail, passwordError } from "@/lib/auth/validation";

export function AuthForm({ mode, locale = "es" }: { locale?: Locale; mode: "register" | "login" | "recovery" }) {
  const tr=createTranslator(locale);
  const router = useRouter();
  const registering = mode === "register";
  const recovering = mode === "recovery";
  const [email, setEmail] = useState("");
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const working = useRef(false);
  const cooling = remaining > 0;

  useEffect(() => {
    if (!registering) return;
    try {
      const draft = sessionStorage.getItem("entreclase.signup.email");
      if (draft) {
        // The optional draft is a browser-only value; read it after hydration.
        queueMicrotask(() => setEmail(draft));
        sessionStorage.removeItem("entreclase.signup.email");
      }
    } catch { /* Storage is optional; the form remains usable without it. */ }
  }, [registering]);

  useEffect(() => {
    if (!cooling) return;
    const timer = window.setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooling]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working.current) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const normalized = normalizeEmail(email);
    const password = String(values.get("password") ?? "");
    const name = String(values.get("name") ?? "").trim();
    const nextIssues: Record<string, string> = { email: emailError(normalized, registering) };
    if (registering && (name.length < 2 || name.length > 60)) nextIssues.name = "Dinos cómo te llamas. Entre 2 y 60 caracteres.";
    if (!recovering) nextIssues.password = registering ? passwordError(password) : password ? "" : "Escribe tu contraseña.";
    setIssues(nextIssues); setError("");
    const firstIssue = Object.keys(nextIssues).find((key) => nextIssues[key]);
    if (firstIssue) { (form.elements.namedItem(firstIssue) as HTMLInputElement | null)?.focus(); return; }
    working.current = true; setPending(true);
    try {
      const client = getAuthClient();
      if (registering) {
        const { data, error: signupError } = await client.auth.signUp({ email: normalized, password, options: { data: { full_name: name, locale }, emailRedirectTo: `${window.location.origin}${localHref(locale, "/verificar/")}` } });
        if (signupError) throw signupError;
        // Keep verification mandatory even if the provider was misconfigured.
        if (data.session) { await client.auth.signOut({ scope: "local" }); throw { code: "signup_disabled" }; }
        setEmail(normalized); setSent(true); setRemaining(60);
      } else if (recovering) {
        const { error: resetError } = await client.auth.resetPasswordForEmail(normalized, { redirectTo: `${window.location.origin}${localHref(locale, "/nueva-contrasena/")}` });
        if (resetError) throw resetError;
        setEmail(normalized); setSent(true); setRemaining(60);
      } else {
        const { error: loginError } = await client.auth.signInWithPassword({ email: normalized, password });
        if (loginError) throw loginError;
        try { await getUniversityMember(); }
        catch (membershipError) { await client.auth.signOut({ scope: "local" }); throw membershipError; }
        router.replace(localHref(locale, "/app/"));
      }
    } catch (cause) { setError(authErrorMessage(cause)); }
    finally { working.current = false; setPending(false); }
  }

  async function resend() {
    if (working.current || cooling) return;
    working.current = true; setPending(true); setError("");
    try {
      const client = getAuthClient();
      const result = recovering
        ? await client.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}${localHref(locale, "/nueva-contrasena/")}` })
        : await client.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${window.location.origin}${localHref(locale, "/verificar/")}` } });
      if (result.error) throw result.error;
      setRemaining(60);
    } catch (cause) { setError(authErrorMessage(cause)); }
    finally { working.current = false; setPending(false); }
  }

  return (
    <>
      {registering ? <ol className="auth-steps" aria-label={tr("Pasos del registro")}><li className={sent ? "complete" : "current"} aria-current={!sent ? "step" : undefined}><span>{sent ? <Check aria-hidden="true" /> : "01"}</span>{tr("Tu cuenta")}</li><li className={sent ? "current" : ""} aria-current={sent ? "step" : undefined}><span>02</span>{tr("Tu correo")}</li></ol> : <p className="eyebrow">{recovering ? tr("Recuperar el acceso") : tr("Ya eres de los nuestros")}</p>}
      {sent ? <div className="auth-sent" role="status"><MailCheck className="auth-status-icon" aria-hidden="true" /><h1>{recovering ? tr("Olvidarla era fácil. Volver también.") : tr("Te falta un clic. El del correo.")}</h1><p>{recovering ? tr("Si hay una cuenta con esta dirección, recibirás un enlace para elegir otra contraseña.") : tr("Si esta dirección puede registrarse, recibirás un enlace para confirmar que el correo es tuyo. Si ya tenías cuenta, puedes entrar.")}</p><p className="auth-email-value">{email}</p><p className="auth-subtle">{tr("Mira también en spam. A veces lo bueno acaba donde no toca.")}</p><AuthError message={error} locale={locale} /><Button variant="outline" className="auth-secondary" disabled={pending || cooling} onClick={resend}>{cooling ? `${tr("Volver a pedirlo en")} ${remaining} s` : pending ? tr("Un momento…") : tr("Pedir otro enlace")}</Button><Button variant="link" className="auth-text-button" onClick={() => { setSent(false); setError(""); }}>{tr("Cambiar el correo")}</Button><p className="auth-switch"><Link href={localHref(locale, "/login/")}>{tr("Volver al inicio de sesión")}</Link></p></div> : <>
        <h1>{registering ? <>{tr("Tu gente está")}<br />{tr("a un hola.")}</> : recovering ? <>{tr("Se te olvidó.")}<br />{tr("Pasa hasta en junio.")}</> : <>{tr("Había sitio.")}<br />{tr("Sigue siendo tuyo.")}</>}</h1>
        <p className="auth-intro">{registering ? tr("Empezamos en las universidades de Valencia. Pon tu nombre y el correo de tu uni. El primer hola lo pones tú.") : recovering ? tr("Dinos con qué correo entraste. Te ayudamos a volver.") : tr("Entra. Lo de mirar vidas ajenas ya lo has hecho bastante.")}</p>
        {registering && <div className="auth-unicoins"><Coins aria-hidden="true"/><p><strong>{unicoinCopy(locale)("start")}</strong><span>{unicoinCopy(locale)("welcomeHelp")}</span><Link href={localHref(locale,"/#unicoins")}>ClasiCoins · {unicoinCopy(locale)("how")}</Link></p></div>}
        <OpeningNotice locale={locale} />
        <form method="post" className="auth-form" onSubmit={submit} noValidate aria-busy={pending}>
          {registering ? <AuthField id="name" name="name" label={tr("¿Cómo te llamas?")} autoComplete="name" maxLength={60} placeholder={tr("Tu nombre")} required error={issues.name} locale={locale} /> : null}
          <AuthField id="email" name="email" label={tr("Correo universitario")} type="email" inputMode="email" autoComplete={registering || recovering ? "email" : "username"} autoCapitalize="none" spellCheck={false} maxLength={254} placeholder={tr("tu.nombre@tu-universidad.es")} required value={email} onChange={(event) => { setEmail(event.target.value); setIssues((value) => ({ ...value, email: "" })); }} error={issues.email} hint={registering ? tr("El personal no vale. Tu campus empieza con el de la uni.") : undefined} locale={locale} />
          {!recovering ? <PasswordField autoComplete={registering ? "new-password" : "current-password"} placeholder={registering ? tr("Una buena frase funciona") : tr("Tu contraseña")} required error={issues.password} hint={registering ? tr("Al menos 12 caracteres. Puedes usar espacios.") : undefined} locale={locale} /> : null}
          {!registering && !recovering ? <Link className="auth-forgot" href={localHref(locale, "/recuperar-contrasena/")}>{tr("Se me ha olvidado la contraseña")}</Link> : null}
          <AuthError message={error} locale={locale} />
          <SubmitButton pending={pending} locale={locale}>{registering ? tr("Encontrar mi gente") : recovering ? tr("Recuperar mi acceso") : tr("Entrar en Entreclase")}</SubmitButton>
        </form>
        <p className="auth-switch">{registering ? <>{tr("¿Ya tienes cuenta?")}{" "}<Link href={localHref(locale, "/login/")}>{tr("Entra por aquí.")}</Link></> : recovering ? <Link href={localHref(locale, "/login/")}>{tr("Ya me acuerdo. Volver a entrar.")}</Link> : <>{tr("¿Acabas de llegar?")}{" "}<Link href={localHref(locale, "/registro/")}>{tr("Hazte un sitio.")}</Link></>}</p>
        {!registering && !recovering ? <p className="auth-resend-link"><Link href={localHref(locale, "/verificar/")}>{tr("¿No te llegó el correo de verificación?")}</Link></p> : null}
      </>}
    </>
  );
}

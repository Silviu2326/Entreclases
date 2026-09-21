
import { createTranslator, localHref, type Locale } from "@/lib/i18n";
import { LaunchBar } from "./language-switcher";
import type { RouteName } from "@/lib/i18n";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, LockKeyhole } from "lucide-react";
import type { ReactNode } from "react";

export function AuthShell({ children, mode = "register", locale = "es", route = "register" }: { children: ReactNode; mode?: "register" | "login" | "recovery"; locale?: Locale; route?: RouteName }) {
  const tr=createTranslator(locale);
  return (
    <div className="auth-page">
      <LaunchBar locale={locale} route={route} />
      <a className="skip-link" href="#acceso-entreclase">{tr("Saltar al formulario")}</a>
      <header className="auth-header">
        <Link className="wordmark" href={localHref(locale, "/")} aria-label={tr("Entreclase, inicio")}>entreclase</Link>
        <Link className="auth-home-link" href={localHref(locale, "/")}><ArrowLeft aria-hidden="true" /><span>{tr("Volver a Entreclase")}</span></Link>
      </header>
      <main className="auth-layout" id="acceso-entreclase">
        <aside className="auth-story" aria-label={tr("La gente de tu universidad")}>
          <div className="auth-story-copy">
            <p className="eyebrow">{tr("Tu universidad. Tu gente. Valencia.")}</p>
            {mode === "register" ? <h2>{tr("Fuera hay")}<br />{tr("un mundo.")}<br /><mark>{tr("Empieza por")}<br />{tr("tu campus.")}</mark></h2> : mode === "login" ? <h2>{tr("La mesa")}<br />{tr("de al lado.")}<br /><mark>{tr("Ya te")}<br />{tr("guarda sitio.")}</mark></h2> : <h2>{tr("Se te olvidó")}<br />{tr("la contraseña.")}<br /><mark>{tr("No la gente.")}</mark></h2>}
            <p>{mode === "register" ? tr("El primer día no conocías a nadie. Igual quien te falta está en tu clase. O en una terraza de Benimaclet.") : mode === "login" ? tr("Los apuntes de Tarongers. El café en Benimaclet. Ese «luego te cuento» que acaba paseando por el Turia.") : tr("Bastantes cosas tienes que recordar para el parcial. Esta la arreglamos aquí.")}</p>
          </div>
          <figure className="auth-photo"><Image src="/images/campus-walk.webp" width={1440} height={960} sizes="(max-width: 850px) 1px, 48vw" alt={tr("Un grupo de estudiantes camina junto por el campus.")} /><figcaption>{tr("Al final había sitio.")}<ArrowUpRight aria-hidden="true" /></figcaption></figure>
        </aside>
        <div className="auth-workspace"><div className="auth-form-wrap">{children}<noscript><style>{".auth-form { display: none; }"}</style><p className="auth-opening">{tr("Activa JavaScript para registrarte o iniciar sesión en Entreclase.")}</p></noscript></div><p className="auth-footnote"><LockKeyhole aria-hidden="true" />{tr("Correo universitario o invitación personal. Siempre con correo verificado.")}</p></div>
      </main>
      <footer className="auth-footer"><span>{tr("Entreclase. La red de tu universidad.")}</span><span>{tr("Nos vemos fuera.")}</span></footer>
    </div>
  );
}

import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Coins, FileText, Sparkles, UsersRound } from "lucide-react";
import { createTranslator, localPath, type Locale } from "@/lib/i18n";
import { LAUNCH_AT, launchDate } from "@/lib/launch/config";
import { EARLY_COINS, WELCOME_COINS } from "@/lib/community/unicoins";
import { LaunchBar } from "./language-switcher";
import { LandingMotion } from "./landing-motion";
import { WaitlistForm } from "./waitlist-form";
import { LegalLinks } from "./legal-links";

// The page the site wears until it opens, and its only job is the address:
// what it is, when, what you get for being early, four things you will find
// inside, and the form. One story, told once. The finished landing lives on in
// landing-page.tsx and comes back at the opening.
export function PrelaunchPage({ locale = "es" }: { locale?: Locale }) {
 const tr = createTranslator(locale);
 const va = locale === "va", t = (es: string, translated: string) => (va ? translated : es);
 const inside = [
  { icon: CalendarDays, head: t("Planes para esta tarde", "Plans per a esta vesprada"), line: t("Alguien pone sitio y hora. Tú dices que vas.", "Algú posa lloc i hora. Tu dius que hi vas.") },
  { icon: UsersRound, head: t("Gente de tu campus", "Gent del teu campus"), line: t("Los que ya te cruzas, con nombre y un motivo para hablar.", "Els que ja et creues, amb nom i un motiu per a parlar.") },
  { icon: FileText, head: t("Los apuntes que te faltan", "Els apunts que et falten"), line: t("De quien pisa tus mismas aulas, no de un PDF perdido.", "De qui trepitja les teues mateixes aules, no d’un PDF perdut.") },
  { icon: Sparkles, head: t("Siete maneras de romper el hielo", "Set maneres de trencar el gel"), line: t("Esta te la enseño dentro.", "Esta te l’ensenye dins.") },
 ];
 return (
  <LandingMotion>
   <LaunchBar locale={locale} />
   <header className="site-header">
    <nav className="header-inner" aria-label={tr("Navegación principal")}>
     <a className="wordmark" href="#inicio" aria-label={tr("Entreclases, inicio")}>entreclases</a>
     <div className="header-links">
      <Link className="nav-link" href={localPath(locale, "blog")}>Blog</Link>
      <Link className="nav-link" href={localPath(locale, "roadmap")}>{t("Las tres fechas", "Les tres dates")}</Link>
      <a className="entreclase-button nav-button prelaunch-nav-button" href="#entrar">{t("Apuntarme", "Apuntar-me")}</a>
     </div>
    </nav>
   </header>

   <main id="contenido">
    <section id="inicio" className="prelaunch-hero" aria-labelledby="hero-title">
     <div className="prelaunch-hero-inner">
      <div className="prelaunch-copy">
       <p className="eyebrow" data-reveal="rise">{t("VALENCIA · ABRE EL", "VALÈNCIA · OBRI EL")}{" "}<time dateTime={LAUNCH_AT}>{launchDate(locale, false)}</time></p>
       <h1 id="hero-title" className="hero-title">
        <span data-reveal="line" data-reveal-delay="0">{tr("Conoces a media uni.")}</span>{" "}
        <span data-reveal="line" data-reveal-delay="70">{tr("A casi nadie.")}</span>{" "}
        <span data-reveal="line" data-reveal-delay="140"><mark>{tr("Eso se puede arreglar.")}</mark></span>
       </h1>
       <p className="prelaunch-lead" data-reveal="rise" data-reveal-delay="160">
        {t("Entreclases es la comunidad de las universidades de Valencia. Se entra con el correo de tu uni, o con la invitación de alguien de dentro.", "Entreclases és la comunitat de les universitats de València. S’entra amb el correu de la teua uni, o amb la invitació d’algú de dins.")}
       </p>
       <div data-reveal="rise" data-reveal-delay="200"><WaitlistForm locale={locale} source="landing" /></div>
      </div>
      <div className="prelaunch-visual">
       <div className="hero-photo-frame">
        <Image src="/images/campus.webp" alt={tr("Cuatro estudiantes charlan y se ríen en una terraza de su campus.")} width={1448} height={1086} sizes="(max-width: 860px) 100vw, 44vw" priority className="hero-photo" data-reveal="photo" />
       </div>
       <div className="photo-annotation" aria-hidden="true" data-reveal="rise" data-reveal-delay="220">
        <span>{t("La mesa de al lado.", "La taula del costat.")}</span>
        <svg viewBox="0 0 72 68" fill="none"><path pathLength="1" d="M51 5c9 22-6 42-35 48m0 0 9-16m-9 16 21 3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
       </div>
      </div>
     </div>
    </section>

    <section className="prelaunch-story" aria-label={t("Un viernes cualquiera", "Un divendres qualsevol")}>
     <div className="prelaunch-story-inner" data-reveal="rise">
      <p className="prelaunch-story-time"><span>{t("Viernes.", "Divendres.")}</span> 14:07.</p>
      <p>{t("A dos mesas montan una tarde en la Malvarrosa.", "A dues taules munten una vesprada a la Malva-rosa.")}<br />{t("Te enteras el domingo. Por una story.", "T’assabentes diumenge. Per una story.")}</p>
      <p className="prelaunch-story-punch">{t("Muy sociales, sí.", "Molt socials, sí.")}</p>
     </div>
    </section>

    <section className="prelaunch-inside" aria-labelledby="inside-title">
     <div className="section-inner">
      <h2 id="inside-title" data-reveal="rise">{t("Lo que hay dentro", "El que hi ha dins")}</h2>
      <ul className="prelaunch-inside-grid">
       {inside.map(({ icon: Icon, head, line }, index) => (
        <li key={head} data-reveal="rise" data-reveal-delay={index * 60}>
         <Icon strokeWidth={1.6} aria-hidden="true" />
         <h3>{head}</h3>
         <p>{line}</p>
        </li>
       ))}
      </ul>
     </div>
    </section>

    <section className="prelaunch-coins" aria-labelledby="coins-title">
     <div className="section-inner prelaunch-coins-inner" data-reveal="rise">
      <p className="eyebrow"><Coins aria-hidden="true" />{t("POR APUNTARTE ANTES", "PER APUNTAR-TE ABANS")}</p>
      <h2 id="coins-title">{t("Empiezas con", "Comences amb")}{" "}<em>{EARLY_COINS + WELCOME_COINS} ClasiCoins</em>{t(" en vez de ", " en lloc de ")}{WELCOME_COINS}.</h2>
      <p>{t("La moneda oficial de dentro. No se compran, no se venden y no valen un euro.", "La moneda oficial de dins. No es compren, no es venen i no valen un euro.")}{" "}<strong>{t("Para qué sirven lo descubrirás cuando entres.", "Per a què servixen ho descobriràs quan entres.")}</strong></p>
      <p className="prelaunch-coins-rule">{t("Solo para quien esté en la lista antes de que abramos.", "Només per a qui estiga en la llista abans que obrim.")}</p>
     </div>
    </section>

    <section id="entrar" className="signup-section prelaunch-signup" aria-labelledby="signup-title" tabIndex={-1}>
     <div className="section-inner signup-inner">
      <div className="signup-main" data-reveal="rise">
       <h2 id="signup-title">{t("Déjame tu correo", "Deixa’m el teu correu")}<br />{t("y te aviso el día 28.", "i t’avise el dia 28.")}</h2>
       <div className="signup-content">
        <p>{t("Hasta entonces te cuento esto por partes, algunas mañanas. Si te cansas, te das de baja en un clic.", "Fins llavors t’ho conte a trossos, alguns matins. Si te’n canses, et dones de baixa en un clic.")}</p>
        <WaitlistForm locale={locale} source="landing" />
       </div>
      </div>
      <footer className="site-footer">
       <a className="wordmark" href="#inicio" aria-label={tr("Entreclases, volver al inicio")}>entreclases</a>
       <nav className="footer-links" aria-label={tr("Enlaces del pie de página")}>
        <Link href={localPath(locale, "blog")}>{t("Blog: vida universitaria en Valencia", "Blog: vida universitària a València")}</Link>
        <Link href={localPath(locale, "roadmap")}>{t("Las tres fechas", "Les tres dates")}</Link>
        <Link href={localPath(locale, "login")}>{t("Ya tengo cuenta", "Ja tinc compte")}</Link>
       </nav>
       <LegalLinks locale={locale} /><p>{tr("Nos vemos fuera.")}</p>
      </footer>
     </div>
    </section>
   </main>
  </LandingMotion>
 );
}

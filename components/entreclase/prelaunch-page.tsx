import Image from "next/image";
import Link from "next/link";
import { Coins, LockKeyhole, Mail } from "lucide-react";
import { createTranslator, localPath, type Locale } from "@/lib/i18n";
import { LAUNCH_AT, launchDate } from "@/lib/launch/config";
import { EARLY_COINS, WELCOME_COINS } from "@/lib/community/unicoins";
import { LaunchBar } from "./language-switcher";
import { LandingMotion } from "./landing-motion";
import { WaitlistForm } from "./waitlist-form";
import { LegalLinks } from "./legal-links";

// The page the site wears until it opens. It asks for one thing and shows as
// little as it can get away with: what Entreclases does is the reason to be on
// the list, so it is not given away for free here. The finished landing lives
// on in landing-page.tsx and comes back at the opening.
export function PrelaunchPage({ locale = "es" }: { locale?: Locale }) {
 const tr = createTranslator(locale);
 const va = locale === "va", t = (es: string, translated: string) => (va ? translated : es);
 return (
  <LandingMotion>
   <LaunchBar locale={locale} />
   <header className="site-header">
    <nav className="header-inner" aria-label={tr("Navegación principal")}>
     <a className="wordmark" href="#inicio" aria-label={tr("Entreclases, inicio")}>entreclases</a>
     <div className="header-links">
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
        {t("Estamos montando algo para los que estudiamos en Valencia. Todavía no voy a contar qué es.", "Estem muntant una cosa per als qui estudiem a València. Encara no contaré què és.")}
       </p>
       <p className="prelaunch-lead" data-reveal="rise" data-reveal-delay="200">
        {t("Deja tu correo y te lo cuento antes que a nadie.", "Deixa el teu correu i t’ho conte abans que a ningú.")}
       </p>
       <div data-reveal="rise" data-reveal-delay="240"><WaitlistForm locale={locale} source="landing" /></div>
       <p className="access-note"><LockKeyhole aria-hidden="true" />{" "}{t("Se entra con el correo de tu universidad. O con la invitación de alguien de dentro.", "S’entra amb el correu de la teua universitat. O amb la invitació d’algú de dins.")}</p>
      </div>
      <div className="prelaunch-visual">
       <div className="hero-photo-frame">
        <Image src="/images/campus.webp" alt={tr("Cuatro estudiantes charlan y se ríen en una terraza de su campus.")} width={1448} height={1086} sizes="(max-width: 860px) 100vw, 46vw" priority className="hero-photo" data-reveal="photo" />
       </div>
       <div className="photo-annotation" aria-hidden="true" data-reveal="rise" data-reveal-delay="220">
        <span>{t("La mesa de al lado.", "La taula del costat.")}</span>
        <svg viewBox="0 0 72 68" fill="none"><path pathLength="1" d="M51 5c9 22-6 42-35 48m0 0 9-16m-9 16 21 3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
       </div>
      </div>
     </div>
    </section>

    <section className="prelaunch-coins" aria-labelledby="coins-title">
     <div className="section-inner prelaunch-coins-inner" data-reveal="rise">
      <p className="eyebrow"><Coins aria-hidden="true" />{t("LA MONEDA DE ENTRECLASES", "LA MONEDA D’ENTRECLASES")}</p>
      <h2 id="coins-title">{t("Apúntate ahora y empiezas con", "Apunta’t ara i comences amb")}{" "}<em>{EARLY_COINS + WELCOME_COINS} ClasiCoins</em>{t(" en vez de ", " en lloc de ")}{WELCOME_COINS}.</h2>
      <p>{t("Las ClasiCoins son la moneda oficial de dentro. No se compran, no se venden y no valen un euro.", "Les ClasiCoins són la moneda oficial de dins. No es compren, no es venen i no valen un euro.")}</p>
      <p className="prelaunch-coins-tease"><strong>{t("Para qué sirven lo descubrirás cuando entres.", "Per a què servixen ho descobriràs quan entres.")}</strong>{" "}{t("Solo te digo que el primer día vas a querer tenerlas.", "Només et dic que el primer dia les voldràs tindre.")}</p>
      <p className="prelaunch-coins-rule">{t("El saldo extra es para quien esté en la lista antes de que abramos. Después ya no.", "El saldo extra és per a qui estiga en la llista abans que obrim. Després ja no.")}</p>
     </div>
    </section>

    <section className="story-section" aria-labelledby="story-title">
     <div className="section-inner story-inner">
      <h2 id="story-title" className="story-time" data-reveal="rise"><span>{tr("Viernes.")}</span><span>14:07.</span></h2>
      <div className="story-copy" data-reveal="rise" data-reveal-delay="100">
       <p>{tr("Sales de clase en Tarongers y abres Instagram.")}<br />{tr("Un desconocido en Bali. Otra boda.")}<br />{tr("Otro millonario de 22 años.")}</p>
       <p>{tr("Mientras, a dos mesas, organizan")}<br className="desktop-break" />{" "}{tr("una tarde en la Malvarrosa.")}</p>
       <p>{tr("Te enteras al día siguiente.")}<br />{tr("Por una story.")}</p>
       <p className="story-punchline">{tr("Muy sociales, sí.")}</p>
      </div>
     </div>
    </section>

    <section className="prelaunch-tease" aria-labelledby="tease-title">
     <div className="section-inner" data-reveal="rise">
      <h2 id="tease-title">{t("Qué te puedo contar hoy", "Què et puc contar hui")}</h2>
      <ul className="prelaunch-tease-list">
       <li>{t("Empieza en las universidades de Valencia, públicas y privadas.", "Comença a les universitats de València, públiques i privades.")}</li>
       <li>{t("No es para todo el mundo: hace falta el correo de tu uni o que alguien de dentro te traiga.", "No és per a tothom: cal el correu de la teua uni o que algú de dins et porte.")}</li>
       <li>{t("Está pensado para que acabes quedando con gente, no para que mires pantallas.", "Està pensat perquè acabes quedant amb gent, no perquè mires pantalles.")}</li>
       <li>{t("Hay tres fechas. La primera es la apertura. De la tercera todavía no puedo hablar.", "Hi ha tres dates. La primera és l’obertura. De la tercera encara no puc parlar.")}</li>
      </ul>
      <p className="prelaunch-tease-note">{t("El resto lo verás por dentro. No hay capturas, no hay demo y no voy a enseñar la aplicación antes de tiempo.", "La resta ho veuràs per dins. No hi ha captures, no hi ha demo i no mostraré l’aplicació abans d’hora.")}</p>
      <p><Link className="prelaunch-dates-link" href={localPath(locale, "roadmap")}>{t("Ver las tres fechas", "Vore les tres dates")}</Link></p>
     </div>
    </section>

    <section id="entrar" className="signup-section prelaunch-signup" aria-labelledby="signup-title" tabIndex={-1}>
     <div className="section-inner signup-inner">
      <div className="signup-main" data-reveal="rise">
       <h2 id="signup-title"><Mail aria-hidden="true" className="prelaunch-signup-icon" />{t("Un correo. Nada más.", "Un correu. Res més.")}</h2>
       <div className="signup-content">
        <p>{t("Te escribo el día que abrimos y algunas mañanas hasta entonces, contándote esto por partes. Si te cansas, te das de baja en un clic.", "T’escric el dia que obrim i alguns matins fins llavors, contant-te això a trossos. Si te’n canses, et dones de baixa en un clic.")}</p>
        <WaitlistForm locale={locale} source="landing" />
       </div>
      </div>
      <footer className="site-footer">
       <a className="wordmark" href="#inicio" aria-label={tr("Entreclases, volver al inicio")}>entreclases</a>
       <nav className="footer-links" aria-label={tr("Enlaces del pie de página")}>
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

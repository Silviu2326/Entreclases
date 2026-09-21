import { createTranslator, localHref, type Locale } from "@/lib/i18n";
import { LaunchBar } from "./language-switcher";
import { LandingMotion } from "./landing-motion";
import { UnicoinsSection } from "./unicoins-section";
import { ValenciaLaunch } from "./valencia-launch";
import Image from "next/image";
import { ArrowUpRight, ArrowDownRight, LockKeyhole, Coins, CalendarDays, UsersRound, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CampusPreview } from "@/components/entreclase/campus-preview";
import { SignupForm } from "@/components/entreclase/signup-form";
import { CampusLife } from "@/components/entreclase/campus-life";
import { UniversityAccess, LandingFaq, StoryEnding } from "@/components/entreclase/landing-sections";
import { MobileNavigation } from "@/components/entreclase/mobile-navigation";
import { authConfigured } from "@/lib/auth/config";

const features = [
  { icon: CalendarDays, title: "Un plan para esta tarde.", text: "Del café en Benimaclet al paseo por el Turia." },
  { icon: UsersRound, title: "Un grupo para lo tuyo.", text: "Encuentra a quienes comparten tus intereses." },
  { icon: FileText, title: "Ese apunte que te falta.", text: "Pregunta a quien pisa tus mismas aulas." },
];

export function LandingPage({ locale = "es" }: { locale?: Locale }) {
  const tr = createTranslator(locale);
  return (
    <LandingMotion>
      <LaunchBar locale={locale} />
      <a className="skip-link" href="#contenido">{tr("Saltar al contenido")}</a>
      <header className="site-header">
        <nav className="header-inner" aria-label={tr("Navegación principal")}>
          <a className="wordmark" href="#inicio" aria-label={tr("Entreclase, inicio")}>entreclase</a>
          <div className="header-links">
            <a className="nav-link" href="#historia">{tr("La historia")}</a>
            <a className="nav-link" href="#campus">{tr("Tu campus")}</a>
            <a className="nav-link" href="#unicoins">ClasiCoins</a>
            <a className="nav-link" href="#dudas">{tr("Dudas")}</a>
            <Button asChild className="entreclase-button nav-button">
              <a href={localHref(locale, "/login/")}>{tr("Entrar")}{" "}<ArrowUpRight data-icon="inline-end" /></a>
            </Button>
            <MobileNavigation locale={locale} />
          </div>
        </nav>
      </header>
      <main id="contenido">
        <section id="inicio" className="hero" aria-labelledby="hero-title">
          <div className="hero-inner">
            <div className="hero-copy">
              <p className="eyebrow" data-reveal="rise">{tr("PRIMERA PARADA · VALENCIA")}</p>
              <h1 id="hero-title" className="hero-title">
                <span data-reveal="line" data-reveal-delay="0">{tr("Conoces a media uni.")}</span>{" "}
                <span data-reveal="line" data-reveal-delay="70">{tr("A casi nadie.")}</span>{" "}
                <span data-reveal="line" data-reveal-delay="140"><mark>{tr("Eso se puede arreglar.")}</mark></span>
              </h1>
              <p className="hero-description" data-reveal="rise" data-reveal-delay="160">{tr("Entreclase convierte los pasillos, los apuntes y ese «¿te vienes?» en gente real con la que quedar.")}</p>
              <p className="hero-brand" data-reveal="rise" data-reveal-delay="200">{tr("Planes pequeños. Historias que sí te pasan.")}</p>
              <Button asChild className="entreclase-button hero-button">
                <a href={localHref(locale, "/registro/")}>{tr("Hacerme un sitio")}{" "}<ArrowUpRight data-icon="inline-end" /></a>
              </Button>
              <a href="#unicoins" className="hero-coins-hook"><Coins aria-hidden="true"/>{tr("20 ClasiCoins de bienvenida. Las siguientes te las ganas participando.")}</a>
              <p className="access-note"><LockKeyhole aria-hidden="true" />{" "}{tr("Acceso con correo universitario o invitación personal.")}</p>
              <a className="hero-demo-link" href={localHref(locale, "/demo/")}>{tr("Dar una vuelta por dentro")}<ArrowUpRight aria-hidden="true" /></a>
              <div className="hero-proof" data-reveal="rise" data-reveal-delay="280"><span className="hero-proof-dot" aria-hidden="true"/><span>{tr("Ahora mismo")}</span><strong>{tr("alguien está diciendo «vente»")}</strong></div>
            </div>
            <div className="hero-visual">
              <div className="hero-photo-frame">
                <Image src="/images/campus.webp" alt={tr("Cuatro estudiantes charlan y se ríen en una terraza de su campus.")} width={1448} height={1086} sizes="(max-width: 700px) 100vw, 54vw" priority className="hero-photo" data-reveal="photo" />
              </div>
              <div className="photo-annotation" aria-hidden="true" data-reveal="rise" data-reveal-delay="200">
                <span>{tr("La mesa de al lado.")}</span>
                <svg viewBox="0 0 72 68" fill="none"><path pathLength="1" d="M51 5c9 22-6 42-35 48m0 0 9-16m-9 16 21 3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <div className="event-card" data-reveal="card" data-reveal-delay="160">
                <p className="eyebrow">{tr("Hay hueco en la mesa")}</p>
                <h2>{tr("¿Te vienes a por un café?")}</h2>
                <p className="event-time">{tr("Benimaclet · 4 personas")}</p>
                <div className="event-bottom">
                  <div className="avatar-stack" aria-hidden="true">
                    <span className="photo-avatar avatar-one" /><span className="photo-avatar avatar-two" /><span className="photo-avatar avatar-three" />
                  </div>
                  <Button asChild className="entreclase-button event-button">
                    <a href="#entrar" aria-label={tr("Entrar en Entreclase para encontrar planes")}>{tr("Ver el plan")}</a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
        <ValenciaLaunch locale={locale} />
        <section id="historia" className="story-section" aria-labelledby="story-title">
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
        <section className="manifesto-section" aria-labelledby="manifesto-title">
          <div className="section-inner manifesto-inner">
            <p className="eyebrow">{tr("LAS REDES SOCIALES")}</p>
            <h2 data-reveal="rise" id="manifesto-title"><span>{tr("Tu feed está lleno.")}</span><span>{tr("Tu tarde, no.")}</span></h2>
            <p>{tr("No queremos secuestrarte la tarde.")}<br />{tr("Queremos darte una razón para salir de ella.")}</p>
            <ArrowDownRight className="manifesto-arrow" data-reveal="rise" data-reveal-delay="180" aria-hidden="true" strokeWidth={1.4} />
          </div>
        </section>
        <section id="campus" className="campus-section" aria-labelledby="campus-title">
          <div className="section-inner">
            <h2 id="campus-title" className="section-title" data-reveal="rise">{tr("La gente que buscas")}<br />{tr("ya está en tu campus.")}</h2>
            <div className="campus-grid">
              <CampusPreview locale={locale} />
              <ul className="feature-list">
                {features.map(({ icon: Icon, title, text }, index) => (
                  <li key={title} className="feature" data-reveal="rise" data-reveal-delay={index * 70}>
                    <Icon strokeWidth={1.65} className="feature-icon" aria-hidden="true" />
                    <div><h3>{tr(title)}</h3><p>{tr(text)}</p></div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
        <CampusLife locale={locale} />
        <UnicoinsSection locale={locale} />
        <UniversityAccess locale={locale} />
        <LandingFaq locale={locale} />
        <StoryEnding locale={locale} />
        <section id="entrar" className="signup-section" aria-labelledby="signup-title" tabIndex={-1}>
          <div className="section-inner signup-inner">
            <div className="signup-main" data-reveal="rise">
              <h2 id="signup-title">{tr("Aquí tu correo")}<br />{tr("sí sirve para algo.")}</h2>
              <div className="signup-content">
                {!authConfigured ? <p className="signup-availability">{tr("Estamos preparando la apertura.")}</p> : null}
                <p>{tr("Entra con correo universitario o una invitación")}<br className="desktop-break" />{" "}{tr("personal. Confirma tu correo y empieza por decir hola.")}</p>
                <SignupForm locale={locale} />
              </div>
            </div>
            <footer className="site-footer">
              <a className="wordmark" href="#inicio" aria-label={tr("Entreclase, volver al inicio")}>entreclase</a>
              <nav className="footer-links" aria-label={tr("Enlaces del pie de página")}><a href="#vida">{tr("La vida dentro")}</a><a href="#dudas">{tr("Dudas")}</a></nav>
              <p>{tr("Nos vemos fuera.")}</p>
            </footer>
          </div>
        </section>
      </main>
    </LandingMotion>
  );
}

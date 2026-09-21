import Link from "next/link";
import { createTranslator, localPath, type Locale } from "@/lib/i18n";
import { LaunchBar } from "./language-switcher";
import { LandingMotion } from "./landing-motion";
import { UnicoinsSection } from "./unicoins-section";
import { ValenciaLaunch } from "./valencia-launch";
import Image from "next/image";
import { LockKeyhole, CalendarDays, UsersRound, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CampusPreview } from "@/components/entreclase/campus-preview";
import { SignupForm } from "@/components/entreclase/signup-form";
import { CampusLife } from "@/components/entreclase/campus-life";
import { UniversityAccess, LandingFaq, StoryEnding } from "@/components/entreclase/landing-sections";
import { MobileNavigation } from "@/components/entreclase/mobile-navigation";
import { LegalLinks } from "./legal-links";
import { LaunchCampaign, LaunchAction } from "./launch-campaign";

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
          <a className="wordmark" href="#inicio" aria-label={tr("Entreclases, inicio")}>entreclases</a>
          <div className="header-links">
            <a className="nav-link" href="#historia">{tr("La historia")}</a>
            <a className="nav-link" href="#campus">{tr("Tu campus")}</a>
            <a className="nav-link" href="#unicoins">ClasiCoins</a>
            <a className="nav-link" href="#dudas">{tr("Dudas")}</a>
            <Link className="nav-link" href={localPath(locale, "roadmap")}>{locale === "va" ? "Full de ruta" : "Roadmap"}</Link>
            <Button asChild className="entreclase-button nav-button">
              <LaunchAction locale={locale} compact target="#entrar"/>
            </Button>
            <MobileNavigation locale={locale} />
          </div>
        </nav>
      </header>
      <main id="contenido">
        <LaunchCampaign locale={locale}/>
        <section id="inicio" className="hero" aria-labelledby="hero-title">
          <div className="hero-inner">
            <div className="hero-copy">
              <p className="eyebrow" data-reveal="rise">{tr("PRIMERA PARADA · VALENCIA")}</p>
              <h1 id="hero-title" className="hero-title">
                <span data-reveal="line" data-reveal-delay="0">{tr("Conoces a media uni.")}</span>{" "}
                <span data-reveal="line" data-reveal-delay="70">{tr("A casi nadie.")}</span>{" "}
                <span data-reveal="line" data-reveal-delay="140"><mark>{tr("Eso se puede arreglar.")}</mark></span>
              </h1>
              <p className="hero-description" data-reveal="rise" data-reveal-delay="160">{tr("Entreclases convierte los pasillos, los apuntes y ese «¿te vienes?» en gente real con la que quedar.")}</p>
              <p className="hero-brand" data-reveal="rise" data-reveal-delay="200">{tr("Planes pequeños. Historias que sí te pasan.")}</p>
              <Button asChild className="entreclase-button hero-button">
                <LaunchAction locale={locale} target="#entrar"/>
              </Button>
              <p className="access-note"><LockKeyhole aria-hidden="true" />{" "}{tr("Acceso con correo universitario o invitación personal.")}</p>
              <p className="access-note">{locale === "va" ? "Un compte universitari. Una invitació per a algú de fora." : "Una cuenta universitaria. Una invitación para alguien de fuera."}</p>
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
                    <a href="#entrar" aria-label={locale === "va" ? "Deixar el meu correu" : "Dejar mi correo"}>{locale === "va" ? "Vull entrar" : "Quiero entrar"}</a>
                  </Button>
                </div>
              </div>
            </div>
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
                <p>{locale === "va" ? "Deixa el teu correu, universitari o no, i t’avisem el dia que obrim. El 28 de setembre s’entra amb correu d’una universitat de València o amb una invitació personal." : "Deja tu correo, universitario o no, y te avisamos el día que abrimos. El 28 de septiembre se entra con correo de una universidad de Valencia o con una invitación personal."}</p>
                <SignupForm locale={locale} />
              </div>
            </div>
            <footer className="site-footer">
              <a className="wordmark" href="#inicio" aria-label={tr("Entreclases, volver al inicio")}>entreclases</a>
              <nav className="footer-links" aria-label={tr("Enlaces del pie de página")}><a href="#vida">{tr("La vida dentro")}</a><a href="#dudas">{tr("Dudas")}</a><Link href={localPath(locale, "roadmap")}>{locale === "va" ? "Full de ruta" : "Roadmap"}</Link></nav>
              <LegalLinks locale={locale} /><p>{tr("Nos vemos fuera.")}</p>
            </footer>
          </div>
        </section>
      </main>
    </LandingMotion>
  );
}

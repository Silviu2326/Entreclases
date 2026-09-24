import Link from "next/link";
import { localPath, type Locale } from "@/lib/i18n/routes";
import { LegalLinks } from "./legal-links";
import { WaitlistForm } from "./waitlist-form";

// The frame every blog page shares: the way back, the other language, and at
// the end the same single ask as the rest of the site.
export function BlogHeader({ locale, alternate }: { locale: Locale; alternate: string }) {
 const va = locale === "va";
 return <header className="blog-header">
  <Link href={localPath(locale, "home")}>← Entreclases</Link>
  <nav aria-label="Blog">
   <Link href={localPath(locale, "blog")}>Blog</Link>
   <Link href={alternate} hrefLang={va ? "es" : "ca"} lang={va ? "es" : "ca-ES-valencia"}>{va ? "Castellano" : "Valencià"}</Link>
  </nav>
 </header>;
}
export function BlogSignup({ locale }: { locale: Locale }) {
 const va = locale === "va";
 return <section className="blog-signup" aria-labelledby="blog-signup-title">
  <p className="eyebrow">{va ? "VALÈNCIA · 28 DE SETEMBRE" : "VALENCIA · 28 DE SEPTIEMBRE"}</p>
  <h2 id="blog-signup-title">{va ? "Tot açò s’organitza a Entreclases." : "Todo esto se organiza en Entreclases."}</h2>
  <p>{va
   ? "La comunitat de les universitats de València: plans per a esta vesprada, gent del teu campus i els apunts que et falten. S’entra amb el correu de la uni o amb una invitació. Deixa el teu correu i t’avisem el dia que obrim."
   : "La comunidad de las universidades de Valencia: planes para esta tarde, gente de tu campus y los apuntes que te faltan. Se entra con el correo de la uni o con una invitación. Deja tu correo y te avisamos el día que abrimos."}</p>
  <WaitlistForm locale={locale} source="blog" />
  <p className="blog-signup-note"><Link href={localPath(locale, "roadmap")}>{va ? "Les tres dates de l’obertura" : "Las tres fechas de la apertura"}</Link></p>
 </section>;
}
export function BlogFooter({ locale }: { locale: Locale }) {
 return <footer className="blog-footer"><LegalLinks locale={locale} /></footer>;
}

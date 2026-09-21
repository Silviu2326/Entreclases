"use client";

import Link from "next/link";
import { CalendarPlus, Check, Flag, LockKeyhole } from "lucide-react";
import { localPath, type Locale } from "@/lib/i18n/routes";
import { LAUNCH_AT, countdown } from "@/lib/launch/config";
import { useLaunch } from "@/lib/launch/use-launch";
import { milestoneDate, milestoneState, milestones, nextMilestone } from "@/lib/launch/roadmap";
import { WaitlistForm } from "./waitlist-form";
import { LegalLinks } from "./legal-links";

export function RoadmapPage({ locale }: { locale: Locale }) {
 const va = locale === "va", t = (es: string, translated: string) => (va ? translated : es), index = va ? 1 : 0;
 const { now } = useLaunch();
 const upcoming = nextMilestone(now);
 const parts = countdown(now);
 const units: [number | null, string][] = [
  [parts?.days ?? null, t("Días", "Dies")], [parts?.hours ?? null, t("Horas", "Hores")],
  [parts?.minutes ?? null, t("Minutos", "Minuts")], [parts?.seconds ?? null, t("Segundos", "Segons")],
 ];
 return <main className="roadmap-page">
  <header className="roadmap-header">
   <Link href={localPath(locale, "home")}>← Entreclases</Link>
   <Link href={localPath(va ? "es" : "va", "roadmap")} hrefLang={va ? "es" : "ca"}>{va ? "Castellano" : "Valencià"}</Link>
  </header>

  <section className="roadmap-intro">
   <p className="eyebrow"><Flag aria-hidden="true" />{t("VALENCIA · TRES FECHAS", "VALÈNCIA · TRES DATES")}</p>
   <h1>{va ? "Full de ruta" : "Roadmap"}</h1>
   <p className="roadmap-lead">{t("Tres fechas, y lo que pasa en cada una. Sin «muy pronto» ni capturas de una app que todavía no puedes usar.", "Tres dates, i el que passa en cadascuna. Sense «molt prompte» ni captures d’una app que encara no pots usar.")}</p>
   <div className="roadmap-countdown" role="timer" aria-live="off" aria-label={t("Tiempo hasta la apertura prevista", "Temps fins a l’obertura prevista")}>
    {units.map(([value, unit]) => <div key={unit}><span className="roadmap-digit">{value === null ? "—" : String(value).padStart(2, "0")}</span><span className="roadmap-unit">{unit}</span></div>)}
   </div>
   <p className="roadmap-countdown-note"><time dateTime={LAUNCH_AT}>{milestoneDate(LAUNCH_AT, locale, true)}</time> · 00:00 · {t("hora peninsular", "hora peninsular")}</p>
  </section>

  <ol className="roadmap-list">
   {milestones.map((milestone) => {
    const state = milestoneState(now, milestone.timestamp);
    return <li key={milestone.id} className="roadmap-milestone" data-state={state}>
     <div className="roadmap-marker" aria-hidden="true"><span>{state === "done" ? <Check /> : milestone.step}</span></div>
     <div className="roadmap-body">
      <p className="roadmap-when">
       <time dateTime={milestone.at}>{milestoneDate(milestone.at, locale, true)}</time>
       {state === "done" && <span className="roadmap-badge">{t("Ya está aquí", "Ja està ací")}</span>}
       {state === "next" && upcoming?.id === milestone.id && <span className="roadmap-badge roadmap-badge-next">{t("Lo siguiente", "El següent")}</span>}
      </p>
      <h2>{milestone.heading[index]}</h2>
      <p className="roadmap-summary">{milestone.summary[index]}</p>
      <ul className="roadmap-detail">{milestone.detail.map((line) => <li key={line[0]}>{line[index]}</li>)}</ul>
     </div>
    </li>;
   })}
  </ol>

  <section id="apuntarme" className="roadmap-signup" tabIndex={-1}>
   <h2>{t("Deja tu correo y te avisamos.", "Deixa el teu correu i t’avisem.")}</h2>
   <p>{t("Es lo único que pedimos ahora. Un correo el día que abrimos, y otro cuando toque cada fecha de esta página.", "És l’únic que demanem ara. Un correu el dia que obrim, i un altre quan toque cada data d’esta pàgina.")}</p>
   <WaitlistForm locale={locale} source="roadmap" />
   <p className="roadmap-access"><LockKeyhole aria-hidden="true" />{" "}{t("El día de la apertura se entra con correo universitario de Valencia o con la invitación personal de alguien de dentro.", "El dia de l’obertura s’entra amb correu universitari de València o amb la invitació personal d’algú de dins.")}</p>
   <p className="roadmap-calendar"><a href="/entreclases-lanzamiento.ics" download><CalendarPlus aria-hidden="true" />{t("Guardar la fecha", "Guardar la data")}</a></p>
  </section>

  <section className="roadmap-honesty">
   <h2>{t("Qué es esta página y qué no", "Què és esta pàgina i què no")}</h2>
   <p>{t("Son las fechas a las que nos comprometemos en público, no una promesa contractual. Si alguna se mueve, se cuenta aquí y por correo antes que en ningún otro sitio.", "Són les dates a què ens comprometem en públic, no una promesa contractual. Si alguna es mou, es conta ací i per correu abans que en cap altre lloc.")}</p>
   <p>{t("No enseñamos la aplicación por dentro todavía. Preferimos que la primera vez que la veas sea la de verdad, con gente de tu campus.", "No mostrem l’aplicació per dins encara. Preferim que la primera vegada que la veges siga la de veritat, amb gent del teu campus.")}</p>
  </section>

  <footer className="roadmap-footer"><LegalLinks locale={locale} /></footer>
 </main>;
}

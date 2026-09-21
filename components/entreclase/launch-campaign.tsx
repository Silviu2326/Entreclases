"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarPlus, Copy, Check, Map } from "lucide-react";
import { localPath, type Locale } from "@/lib/i18n/routes";
import { LAUNCH_AT, countdown, launchDate } from "@/lib/launch/config";
import { useLaunch } from "@/lib/launch/use-launch";

// Before the opening there is nothing to visit: the only call to action is the
// address. On the landing that is the form below; elsewhere, the roadmap page.
export function LaunchAction({ locale, className = "", compact = false, target }: { locale: Locale; className?: string; compact?: boolean; target?: string }) {
 const { phase } = useLaunch();
 const open = phase === "open";
 const href = open ? localPath(locale, "register") : target ?? localPath(locale, "roadmap") + "#apuntarme";
 return <Link className={className} href={href}>
  {open ? (locale === "va" ? "Crear el meu compte" : "Crear mi cuenta") : compact ? (locale === "va" ? "Apuntar-me" : "Apuntarme") : (locale === "va" ? "Reservar el meu lloc" : "Reservar mi sitio")}<ArrowUpRight aria-hidden="true"/>
 </Link>;
}

export function LaunchCampaign({ locale, compact = false, target }: { locale: Locale; compact?: boolean; target?: string }) {
 const { now, phase } = useLaunch();
 const [copied, setCopied] = useState(false), [copyFailed, setCopyFailed] = useState(false);
 const va = locale === "va", t = (es: string, translated: string) => va ? translated : es;
 const parts = countdown(now);
 const labels = [t("Días", "Dies"), t("Horas", "Hores"), t("Minutos", "Minuts"), t("Segundos", "Segons")];
 const values = parts ? [parts.days, parts.hours, parts.minutes, parts.seconds] : [null, null, null, null];
 async function copy() {
  try { await navigator.clipboard.writeText(`https://www.entreclases.com${localPath(locale, "home")}`); setCopied(true); setCopyFailed(false); }
  catch { setCopied(false); setCopyFailed(true); }
 }
 return <section id={compact ? undefined : "lanzamiento"} className={`launch-campaign${compact ? " launch-campaign-compact" : ""}`} aria-label={t("Lanzamiento de Entreclases", "Llançament d’Entreclases")}>
  <div className="launch-campaign-inner">
   <div className="launch-campaign-copy"><p className="launch-campaign-kicker">{phase === "open" ? t("VALENCIA · YA ESTAMOS DENTRO", "VALÈNCIA · JA ESTEM DINS") : t("PRIMERA PARADA · VALENCIA", "PRIMERA PARADA · VALÈNCIA")}</p>
    <h2>{phase === "open" ? t("Ya hay sitio para ti.", "Ja hi ha lloc per a tu.") : phase === "pending" ? t("Estamos dando el último repaso.", "Estem fent l’últim repàs.") : t("El 28, nos vemos dentro.", "El 28, ens veiem dins.")}</h2>
    <p>{phase === "open" ? t("Crea tu cuenta con tu correo universitario o con tu invitación personal.", "Crea el compte amb el correu universitari o amb la invitació personal.") : phase === "pending" ? t("La fecha prevista ha llegado. Deja tu correo y te avisamos en cuanto se abra el registro.", "La data prevista ha arribat. Deixa el teu correu i t’avisem quan s’òbriga el registre.") : t("Planes, apuntes y gente de tu uni. Deja tu correo y eres de los primeros en entrar.", "Plans, apunts i gent de la teua uni. Deixa el teu correu i seràs dels primers a entrar.")}</p>
    {phase === "scheduled" && <p className="launch-campaign-date"><time dateTime={LAUNCH_AT}>{launchDate(locale, true)}</time> · 00:00 · {t("hora peninsular", "hora peninsular")}</p>}
   </div>
   <div className="launch-campaign-right">
    {phase === "scheduled" && <div className="launch-countdown" role="timer" aria-live="off" aria-label={t("Tiempo hasta la apertura prevista", "Temps fins a l’obertura prevista")}>{values.map((value, index) => <div key={labels[index]}><span className="launch-digit">{value === null ? "—" : String(value).padStart(2, "0")}</span><span className="launch-unit">{labels[index]}</span></div>)}</div>}
    <div className="launch-campaign-actions"><LaunchAction locale={locale} className="launch-primary" target={target} compact={compact}/>{phase !== "open" && <Link href={localPath(locale, "roadmap")}><Map aria-hidden="true"/>{t("Ver el roadmap", "Veure el full de ruta")}</Link>}{phase === "scheduled" && <a href="/entreclases-lanzamiento.ics" download><CalendarPlus aria-hidden="true"/>{t("Guardar la fecha", "Guardar la data")}</a>}{!compact && <button type="button" onClick={()=>void copy()}>{copied ? <Check aria-hidden="true"/> : <Copy aria-hidden="true"/>}{copied ? t("Enlace copiado", "Enllaç copiat") : t("Copiar enlace", "Copiar enllaç")}</button>}</div>
    {!compact && <p className="launch-copy-status" role="status">{copyFailed ? <>{t("Copia esta dirección:", "Copia esta adreça:")} <a href={`https://www.entreclases.com${localPath(locale, "home")}`}>www.entreclases.com{localPath(locale, "home")}</a></> : copied ? t("Pásaselo a esa persona con la que vendrías.", "Passa-li’l a eixa persona amb qui vindries.") : t("Una cuenta universitaria. Una invitación para alguien de fuera.", "Un compte universitari. Una invitació per a algú de fora.")}</p>}
   </div>
  </div>
  <noscript><p>{t("La apertura está prevista para el 28 de septiembre de 2026 a las 00:00 (hora peninsular). Deja tu correo en esta página y te avisamos.", "L’obertura està prevista per al 28 de setembre de 2026 a les 00:00 (hora peninsular). Deixa el teu correu en esta pàgina i t’avisem.")}</p></noscript>
 </section>;
}

export function LaunchFaqAnswer({ locale }: { locale: Locale }) {
 const { phase } = useLaunch();
 if (phase === "open") return <>{locale === "va" ? "Ja pots crear el compte, confirmar el correu universitari admés o usar una invitació personal i entrar." : "Ya puedes crear tu cuenta, confirmar tu correo universitario admitido o usar una invitación personal y entrar."}</>;
 if (phase === "pending") return <>{locale === "va" ? "Estem acabant de preparar l’obertura. El registre encara no està disponible: deixa el teu correu i t’avisem el mateix dia." : "Estamos terminando de preparar la apertura. El registro aún no está disponible: deja tu correo y te avisamos el mismo día."}</>;
 return <>{locale === "va" ? "L’obertura està prevista per al 28 de setembre a les 00:00, hora peninsular. Fins aleshores pots deixar el teu correu i guardar la data al calendari." : "La apertura está prevista para el 28 de septiembre a las 00:00, hora peninsular. Hasta entonces puedes dejar tu correo y guardar la fecha en el calendario."}</>;
}

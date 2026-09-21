"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarPlus, Copy, Check } from "lucide-react";
import { localPath, type Locale } from "@/lib/i18n/routes";
import { LAUNCH_AT, countdown, launchDate } from "@/lib/launch/config";
import { useLaunch } from "@/lib/launch/use-launch";

export function LaunchAction({ locale, className = "", compact = false }: { locale: Locale; className?: string; compact?: boolean }) {
 const { phase } = useLaunch();
 const open = phase === "open";
 return <Link className={className} href={localPath(locale, open ? "register" : "demo")}>
  {open ? (locale === "va" ? "Crear el meu compte" : "Crear mi cuenta") : compact ? (locale === "va" ? "Veure demo" : "Ver demo") : (locale === "va" ? "Entrar a la demo" : "Entrar a la demo")}<ArrowUpRight aria-hidden="true"/>
 </Link>;
}

export function LaunchCampaign({ locale, compact = false }: { locale: Locale; compact?: boolean }) {
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
    <p>{phase === "open" ? t("Crea tu cuenta con tu correo universitario o con tu invitación personal.", "Crea el compte amb el correu universitari o amb la invitació personal.") : phase === "pending" ? t("La fecha prevista ha llegado. El registro se abrirá cuando esté todo preparado; mientras, puedes recorrer la demo.", "La data prevista ha arribat. El registre s’obrirà quan estiga tot preparat; mentrestant, pots recórrer la demo.") : t("Planes, apuntes y gente de tu uni. Puedes ir echando un vistazo.", "Plans, apunts i gent de la teua uni. Pots anar fent una ullada.")}</p>
    {phase === "scheduled" && <p className="launch-campaign-date"><time dateTime={LAUNCH_AT}>{launchDate(locale, true)}</time> · 00:00 · {t("hora peninsular", "hora peninsular")}</p>}
   </div>
   <div className="launch-campaign-right">
    {phase === "scheduled" && <div className="launch-countdown" role="timer" aria-live="off" aria-label={t("Tiempo hasta la apertura prevista", "Temps fins a l’obertura prevista")}>{values.map((value, index) => <div key={labels[index]}><span className="launch-digit">{value === null ? "—" : String(value).padStart(2, "0")}</span><span className="launch-unit">{labels[index]}</span></div>)}</div>}
    <div className="launch-campaign-actions"><LaunchAction locale={locale} className="launch-primary"/>{phase === "scheduled" && <a href="/entreclases-lanzamiento.ics" download><CalendarPlus aria-hidden="true"/>{t("Guardar la fecha", "Guardar la data")}</a>}{!compact && <button type="button" onClick={()=>void copy()}>{copied ? <Check aria-hidden="true"/> : <Copy aria-hidden="true"/>}{copied ? t("Enlace copiado", "Enllaç copiat") : t("Copiar enlace", "Copiar enllaç")}</button>}</div>
    {!compact && <p className="launch-copy-status" role="status">{copyFailed ? <>{t("Copia esta dirección:", "Copia esta adreça:")} <a href={`https://www.entreclases.com${localPath(locale, "home")}`}>www.entreclases.com{localPath(locale, "home")}</a></> : copied ? t("Pásaselo a esa persona con la que vendrías.", "Passa-li’l a eixa persona amb qui vindries.") : t("Una cuenta universitaria. Una invitación para alguien de fuera.", "Un compte universitari. Una invitació per a algú de fora.")}</p>}
   </div>
  </div>
  <noscript><p>{t("La apertura está prevista para el 28 de septiembre de 2026 a las 00:00 (hora peninsular). Puedes probar la demo sin activar la cuenta atrás.", "L’obertura està prevista per al 28 de setembre de 2026 a les 00:00 (hora peninsular). Pots provar la demo sense activar el compte arrere.")}</p></noscript>
 </section>;
}

export function LaunchFaqAnswer({ locale }: { locale: Locale }) {
 const { phase } = useLaunch();
 if (phase === "open") return <>{locale === "va" ? "Ja pots crear el compte, confirmar el correu universitari admés o usar una invitació personal i entrar." : "Ya puedes crear tu cuenta, confirmar tu correo universitario admitido o usar una invitación personal y entrar."}</>;
 if (phase === "pending") return <>{locale === "va" ? "Estem acabant de preparar l’obertura. El registre encara no està disponible; pots recórrer la demo." : "Estamos terminando de preparar la apertura. El registro aún no está disponible; puedes recorrer la demo."}</>;
 return <>{locale === "va" ? "L’obertura està prevista per al 28 de setembre a les 00:00, hora peninsular. Fins aleshores pots provar la demo amb perfils d’exemple i guardar la data al calendari." : "La apertura está prevista para el 28 de septiembre a las 00:00, hora peninsular. Hasta entonces puedes probar la demo con perfiles de ejemplo y guardar la fecha en el calendario."}</>;
}

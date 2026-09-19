"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUpRight, BookOpen, CalendarDays, Check, Coffee, MapPin, Plus, Sparkles, Users } from "lucide-react";
import { formatDate, localName } from "@/lib/community/copy";
import { campuses, type Plan } from "@/lib/community/types";
import { Action, Avatar, ExternalLink } from "./controls";
import { matches, useCommunity } from "./context";
import { Attendance, CreatePlanModal, mapUrl } from "./plans";
import { GameHub, openExploreGame } from "./games";
import { ProjectCollection } from "./projects";
import { MagazineTeaser } from "./magazine";
import "./explore.css";

export function Explore() {
  const { locale, query } = useCommunity();
  const t = (es: string, va: string) => locale === "va" ? va : es;
  useEffect(() => {
    if (window.location.hash !== "#proyectos") return;
    const frame = window.requestAnimationFrame(() => document.getElementById("proyectos")?.scrollIntoView({ block: "start" }));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  return <div className="ex-page">
    {!query && <ExploreOpening />}
    {query && <p className="ex-search-status" role="status">{t("Buscando en juegos, planes, proyectos, grupos y apuntes:", "Buscant en jocs, plans, projectes, grups i apunts:")} <strong>{query}</strong></p>}
    <GameHub />
    <ExplorePlans />
    <ProjectCollection />
    {!query && <MagazineTeaser />}
    <ExploreGroups />
    {!query && <section className="ex-weekly" aria-labelledby="ex-weekly-title">
      <div className="ex-weekly-art" aria-hidden="true"><span>?</span><span>!</span><i>hola, ¿y tú?</i></div>
      <div><p className="ex-kicker">{t("UNA CITA CON LOS JUEVES", "UNA CITA AMB ELS DIJOUS")}</p><h2 id="ex-weekly-title">{t("Primero, lo que tienes que contar.", "Primer, el que tens per a contar.")}</h2><p>{t("Doce minutos de conversación escrita, sin fotos. Si los dos queréis, después os ponéis cara.", "Dotze minuts de conversa escrita, sense fotos. Si els dos voleu, després vos poseu cara.")}</p><div className="ex-weekly-meta"><span><CalendarDays />{t("Jueves · 19:30–21:00", "Dijous · 19:30–21:00")}</span><span>València · +18</span></div><button className="ex-link" onClick={() => openExploreGame("blind")}>{t("Así funciona la cita", "Així funciona la cita")}<ArrowUpRight /></button></div>
    </section>}
    <ExploreCampus />
  </div>;
}

function ExploreOpening() {
  const { locale } = useCommunity();
  const t = (es: string, va: string) => locale === "va" ? va : es;
  const [choice, setChoice] = useState<number | null>(null);
  const statements = [t("He dormido en la biblioteca.", "He dormit a la biblioteca."), t("He aprobado sin abrir los apuntes.", "He aprovat sense obrir els apunts."), t("Nunca he dicho «el lunes empiezo».", "Mai he dit «el dilluns comence».")];
  return <section className="ex-opening" aria-labelledby="ex-title">
    <div className="ex-opening-copy"><p className="ex-kicker">EXPLORAR · VALÈNCIA</p><h1 id="ex-title">{t("Venías a mirar.", "Venies a mirar.")}<br/><em>{t("A ver cómo acabas.", "A vore com acabes.")}</em></h1><p>{t("Una partida, un café, gente que también se apunta. Tu siguiente anécdota puede empezar aquí.", "Una partida, un café, gent que també s’apunta. La teua pròxima anècdota pot començar ací.")}</p><a className="ex-link" href="#ex-plans">{t("Ver qué hay fuera", "Vore què hi ha fora")}<ArrowDown /></a><span className="ex-handwritten" aria-hidden="true">{t("el horario no lo es todo", "l’horari no ho és tot")}</span></div>
    <div className="ex-first-game"><div className="ex-first-game-head"><span>{t("UNA RONDA PARA CALENTAR", "UNA RONDA PER A ESCALFAR")}</span><Sparkles aria-hidden="true"/></div><h2>{t("Aquí hay una trola.", "Ací hi ha una mentida.")}</h2><p>{t("Dos verdades. Una mentira. ¿Cuál no te crees?", "Dues veritats. Una mentida. Quina no et creus?")}</p><div className="ex-statements">{statements.map((statement, index) => <button key={statement} aria-pressed={choice === index} className={choice === index ? "chosen" : ""} onClick={() => setChoice(index)}><span>{String(index + 1).padStart(2, "0")}</span>{statement}{choice === index ? <Check /> : <ArrowUpRight />}</button>)}</div><div className="ex-practice-result" role="status">{choice === null ? t("Ronda de ejemplo · tu respuesta no se publica.", "Ronda d’exemple · la teua resposta no es publica.") : choice === 2 ? t("Pillada. Lo del lunes nos lo sabemos todos.", "Pillada. Això del dilluns ens ho sabem tots.") : t("Pues esta era verdad. La trola era lo del lunes.", "Doncs esta era veritat. La mentida era això del dilluns.")}</div><button className="ex-link" onClick={() => openExploreGame("truth")}>{t("Ahora, con gente del campus", "Ara, amb gent del campus")}<ArrowUpRight /></button></div>
  </section>;
}

function ExplorePlans() {
  const { c, locale, data, query } = useCommunity();
  const t = (es: string, va: string) => locale === "va" ? va : es;
  const [period, setPeriod] = useState("all"), [place, setPlace] = useState("");
  const [available, setAvailable] = useState(false), [creating, setCreating] = useState(false), [showAll, setShowAll] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const upcoming = data.plans.filter(plan => new Date(plan.starts_at).getTime() > now).sort((a,b) => a.starts_at.localeCompare(b.starts_at));
  const plans = upcoming.filter(plan => (!place || plan.place === place) && (period !== "week" || new Date(plan.starts_at).getTime() <= now + 7 * 86400000) && (!available || data.planMembers.filter(m => m.plan_id === plan.id).length < plan.capacity) && matches(query, plan.title, plan.description, plan.place));
  return <section className="ex-section" id="ex-plans" aria-labelledby="ex-plans-title">
    <header className="ex-section-head"><div><p className="ex-kicker">{t("EL PLAN ES SALIR", "EL PLA ÉS EIXIR")}</p><h2 id="ex-plans-title">{t("Ponle fecha al «a ver si quedamos».", "Posa data a l’«a vore si quedem».")}</h2></div><button className="ex-link" onClick={() => setCreating(true)}><Plus />{c("createPlan")}</button></header>
    <div className="ex-filters"><label>{t("Cuándo", "Quan")}<select aria-label={t("Cuándo", "Quan")} value={period} onChange={e => { setPeriod(e.target.value); setShowAll(false); }}><option value="all">{t("Próximos planes", "Pròxims plans")}</option><option value="week">{t("En los próximos 7 días", "En els pròxims 7 dies")}</option></select></label><label>{c("place")}<select aria-label={c("place")} value={place} onChange={e => { setPlace(e.target.value); setShowAll(false); }}><option value="">{t("Toda Valencia", "Tota València")}</option>{Array.from(new Set(upcoming.map(plan => plan.place))).map(value => <option key={value}>{value}</option>)}</select></label><label className="ex-check"><input type="checkbox" checked={available} onChange={e => setAvailable(e.target.checked)}/>{t("Con plazas libres", "Amb places lliures")}</label><span role="status">{plans.length} {t("planes", "plans")}</span></div>
    {plans.length ? <div className="ex-plan-grid">{plans.slice(0, showAll ? undefined : 6).map((plan,index) => <ExplorePlan key={plan.id} plan={plan} featured={index === 0}/>)}</div> : <div className="ex-empty"><Coffee /><h3>{t("Este hueco puede ser tu plan.", "Este buit pot ser el teu pla.")}</h3><p>{t("No hay planes con estos filtros. Prueba otro lugar o propón el primero.", "No hi ha plans amb estos filtres. Prova un altre lloc o proposa el primer.")}</p><button className="ex-link" onClick={() => setCreating(true)}>{c("createPlan")}<Plus /></button></div>}
    {plans.length > 6 && <button className="ex-link ex-more" onClick={() => setShowAll(value => !value)}>{showAll ? t("Ver menos", "Vore menys") : t("Ver todos los planes", "Vore tots els plans")}<ArrowDown /></button>}
    <CreatePlanModal open={creating} onOpenChange={setCreating}/>
  </section>;
}

function ExplorePlan({ plan, featured }: { plan: Plan; featured: boolean }) {
  const { c, locale, data } = useCommunity();
  const members = data.planMembers.filter(member => member.plan_id === plan.id);
  const date = new Date(plan.starts_at), dateLocale = locale === "va" ? "ca-ES" : "es-ES";
  return <article className={`ex-plan ${featured ? "ex-plan-featured" : ""}`}>
    {featured && <div className="ex-plan-art" aria-hidden="true"><Coffee /><span>{locale === "va" ? "ens veiem fora" : "nos vemos fuera"}</span><i/><i/></div>}
    <div className="ex-plan-main"><div className="ex-plan-date"><time dateTime={plan.starts_at}><strong>{new Intl.DateTimeFormat(dateLocale,{day:"2-digit",timeZone:"Europe/Madrid"}).format(date)}</strong><span>{new Intl.DateTimeFormat(dateLocale,{month:"short",timeZone:"Europe/Madrid"}).format(date)}</span></time><span>{formatDate(plan.starts_at,locale)}</span></div><h3>{plan.title}</h3><p className="ex-location"><MapPin />{localName(plan.place,locale)}</p><details className="ex-plan-detail"><summary>{c("planDetails")}<Plus /></summary><div><p>{plan.description}</p><strong>{c("meeting")}</strong><p>{plan.meeting_point}</p><ExternalLink href={mapUrl(plan)}>{c("location")}</ExternalLink></div></details><footer><div className="ex-members"><div className="u-avatar-stack">{members.slice(0,3).map(member => <Avatar key={member.user_id} size="small" person={data.profiles.find(profile => profile.user_id === member.user_id)}/>)}</div><span>{Math.max(0,plan.capacity-members.length)} {c("placesLeft")}</span></div><Attendance plan={plan}/></footer></div>
  </article>;
}

function ExploreGroups() {
  const { c, locale, data, me, query, busy, repo, run, go } = useCommunity();
  const t = (es: string, va: string) => locale === "va" ? va : es;
  const [campus, setCampus] = useState(""), [category, setCategory] = useState(""), [showAll, setShowAll] = useState(false);
  const groups = data.groups.filter(group => (!campus || group.campus === campus) && (!category || group.category === category) && matches(query,group.name,group.description,group.campus));
  return <section className="ex-section ex-groups" aria-labelledby="ex-groups-title"><header className="ex-section-head"><div><p className="ex-kicker">{t("LOS TUYOS ANDAN POR AQUÍ", "ELS TEUS CAMINEN PER ACÍ")}</p><h2 id="ex-groups-title">{t("Lo raro sería que solo te gustara a ti.", "Seria estrany que només t’agradara a tu.")}</h2></div><button className="ex-link" onClick={() => go("groups")}><Plus />{t("Ver y crear grupos", "Vore i crear grups")}</button></header><div className="ex-filters"><label>{c("yourCampus")}<select aria-label={c("yourCampus")} value={campus} onChange={e => setCampus(e.target.value)}><option value="">{c("allCampuses")}</option>{campuses.map(value => <option key={value}>{value}</option>)}</select></label><label>{c("category")}<select aria-label={c("category")} value={category} onChange={e => setCategory(e.target.value)}><option value="">{c("all")}</option>{(["study","leisure","projects"] as const).map(value => <option key={value} value={value}>{c(value)}</option>)}</select></label><span role="status">{groups.length} {t("grupos", "grups")}</span></div><div className="ex-group-grid">{groups.slice(0, showAll ? undefined : 6).map(group => {
    const members = data.groupMembers.filter(member => member.group_id === group.id);
    const joined = members.some(member => member.user_id === me.user_id), own = group.creator_id === me.user_id;
    const Icon = group.category === "study" ? BookOpen : group.category === "leisure" ? Coffee : Sparkles;
    return <article key={group.id} className={`ex-group ex-group-${group.category}`}><div className="ex-group-art" aria-hidden="true"><Icon /><i/><i/></div><span className="ex-kicker">{localName(group.campus,locale)}</span><h3>{group.name}</h3><p>{group.description}</p><div className="ex-members"><div className="u-avatar-stack">{members.slice(0,4).map(member => <Avatar key={member.user_id} size="small" person={data.profiles.find(profile => profile.user_id === member.user_id)}/>)}</div><span><Users />{members.length} {c("members")}</span></div><footer><Action secondary={joined} disabled={busy||own} onClick={() => void run(() => repo.joinGroup(group.id,!joined),"")}>{own ? c("member") : joined ? c("leaveGroup") : c("joinGroup")}</Action>{joined && <button className="ex-link" onClick={() => go("messages",{groupId:group.id})}>{t("Conversación", "Conversa")}<ArrowUpRight /></button>}</footer></article>;
  })}</div>{!groups.length && <p className="ex-empty">{t("No hay grupos con estos filtros. Prueba otro campus o crea el tuyo.", "No hi ha grups amb estos filtres. Prova un altre campus o crea el teu.")}</p>}{groups.length > 6 && <button className="ex-link ex-more" onClick={() => setShowAll(value => !value)}>{showAll ? t("Ver menos", "Vore menys") : t("Ver todos los grupos", "Vore tots els grups")}<ArrowDown /></button>}</section>;
}

function ExploreCampus() {
  const { c, locale, data, query, go } = useCommunity();
  const t = (es: string, va: string) => locale === "va" ? va : es;
  const notes = data.notes.filter(note => matches(query,note.title,note.subject,note.campus));
  return <section className="ex-campus ex-section" aria-labelledby="ex-campus-title"><div className="ex-campus-intro"><BookOpen /><p className="ex-kicker">{t("TAMBIÉN HAY QUE APROBAR", "TAMBÉ CAL APROVAR")}</p><h2 id="ex-campus-title">{t("Ese tema que se te atasca.", "Eixe tema que se’t resistix.")}</h2><p>{t("Igual alguien ya lo ha explicado mejor. Apuntes compartidos y grupos para estudiar juntos.", "Potser algú ja ho ha explicat millor. Apunts compartits i grups per a estudiar junts.")}</p><button className="ex-link" onClick={() => go("campus")}>{t("Abrir los apuntes", "Obrir els apunts")}<ArrowUpRight /></button></div><div className="ex-notes">{notes.slice(0,4).map((note,index) => <button key={note.id} onClick={() => go("campus")}><span className="ex-note-number">{String(index+1).padStart(2,"0")}</span><span><small>{note.subject} · {localName(note.campus,locale)}</small><strong>{note.title}</strong></span><ArrowUpRight /></button>)}{!notes.length && <div className="ex-empty"><p>{t("Todavía no hay apuntes para esta búsqueda. Puedes compartir los tuyos.", "Encara no hi ha apunts per a esta cerca. Pots compartir els teus.")}</p><button className="ex-link" onClick={() => go("campus")}>{c("campus")}<ArrowUpRight /></button></div>}</div></section>;
}

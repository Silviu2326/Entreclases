"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUpRight, BookOpen, Coffee, MapPin, Plus, Sparkles, Users } from "lucide-react";
import { formatDate, localName } from "@/lib/community/copy";
import { campuses, places, type Plan } from "@/lib/community/types";
import { Action, Avatar, ExternalLink } from "./controls";
import { matches, useCommunity } from "./context";
import { Attendance, CreatePlanModal, mapUrl, PlaceGame, planHereEmpty } from "./plans";
import { GameHub } from "./games";
import { ExploreOpening } from "./explore-opening";
import { ExploreWeekly } from "./explore-weekly";
import { languageIndex } from "@/lib/community/games/catalog";
import { kindLabels, placeKinds, spotOf, WEEK_MS, type PlaceKind, type PlanPeriod } from "@/lib/community/places";
import { openingOfDay } from "@/lib/community/games/openings";
import { playableGames } from "@/lib/community/games/gate";
import { useMeetGamesOpen } from "./meet-gate";
import { ProjectTeaser } from "./projects";
import { MagazineTeaser } from "./magazine";
import "./explore.css";

export function Explore() {
  const { locale, query } = useCommunity();
  const t = (es: string, va: string) => locale === "va" ? va : es;
  // El mismo juego que anuncia Inicio, todo el día: la tarjeta de allí promete este banner.
  const opening = openingOfDay(playableGames(useMeetGamesOpen() === true));
  // Inicio manda aquí con el id de la sección en el hash: el mapa a los planes, las cifras a su sección.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    const frame = window.requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  return <div className="ex-page">
    {!query && <ExploreOpening game={opening} />}
    {query && <p className="ex-search-status" role="status">{t("Buscando en juegos, planes, proyectos, grupos y apuntes:", "Buscant en jocs, plans, projectes, grups i apunts:")} <strong>{query}</strong></p>}
    <GameHub />
    <ExplorePlans />
    <ProjectTeaser />
    {!query && <MagazineTeaser />}
    <ExploreGroups />
    {!query && <ExploreWeekly />}
    <ExploreCampus />
  </div>;
}


function ExplorePlans() {
  const { c, locale, data, me, query, place: arriving, period: arrivingPeriod, kind: arrivingKind, go } = useCommunity();
  const t = (es: string, va: string) => locale === "va" ? va : es;
  // Mismos nombres que en Inicio: `period` y `kind` llegan de sus pestañas y de su filtro del mapa.
  const [period, setPeriod] = useState<PlanPeriod>(arrivingPeriod ?? "all"), [place, setPlace] = useState(arriving ?? ""), [kind, setKind] = useState<PlaceKind | "">(arrivingKind ?? "");
  const [available, setAvailable] = useState(false), [creating, setCreating] = useState(false), [showAll, setShowAll] = useState(false);
  // «El plan» de Inicio y del lateral llega con #plan-<id>: ese plan se abre y se ve aunque los filtros lo dejaran fuera, hasta que se toque un filtro.
  const [target] = useState(() => window.location.hash.startsWith("#plan-") ? window.location.hash.slice(6) : null), [pinned, setPinned] = useState(target);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  // Llegar desde el mapa de Inicio deja su lugar, su periodo y su tipo ya filtrados aquí. Se
  // ajusta durante el render, no en un efecto: así no hay un repintado con el filtro viejo.
  const [lastArrival, setLastArrival] = useState({ place: arriving, period: arrivingPeriod, kind: arrivingKind });
  if (arriving !== lastArrival.place || arrivingPeriod !== lastArrival.period || arrivingKind !== lastArrival.kind) {
    setLastArrival({ place: arriving, period: arrivingPeriod, kind: arrivingKind });
    if (arriving) setPlace(arriving);
    if (arrivingPeriod) setPeriod(arrivingPeriod);
    if (arrivingKind) setKind(arrivingKind);
    setShowAll(false);
  }
  // Tocar un filtro recorta la lista a seis y suelta el plan que se había traído desde fuera.
  const touched = () => { setShowAll(false); setPinned(null); };
  const chooseKind = (value: PlaceKind | "") => { setKind(value); if (value && place && spotOf(place)?.kind !== value) setPlace(""); touched(); };
  const mine = (plan: Plan) => data.planMembers.some(member => member.plan_id === plan.id && member.user_id === me.user_id);
  const upcoming = data.plans.filter(plan => new Date(plan.starts_at).getTime() > now).sort((a,b) => a.starts_at.localeCompare(b.starts_at));
  const plans = upcoming.filter(plan => plan.id === pinned || (!place || plan.place === place) && (!kind || spotOf(plan.place)?.kind === kind) && (period !== "week" || new Date(plan.starts_at).getTime() < now + WEEK_MS) && (period !== "mine" || mine(plan)) && (!available || data.planMembers.filter(m => m.plan_id === plan.id).length < plan.capacity) && matches(query, plan.title, plan.description, plan.place));
  // Si el plan que se busca cae más allá de los seis primeros, la lista se alarga hasta él.
  const shown = showAll ? plans.length : Math.max(6, plans.findIndex(plan => plan.id === pinned) + 1);
  return <section className="ex-section" id="ex-plans" aria-labelledby="ex-plans-title">
    <header className="ex-section-head"><div><p className="ex-kicker">{t("EL PLAN ES SALIR", "EL PLA ÉS EIXIR")}</p><h2 id="ex-plans-title">{t("Ponle fecha al «a ver si quedamos».", "Posa data a l’«a vore si quedem».")}</h2></div><button className="ex-link" onClick={() => setCreating(true)}><Plus />{c("createPlan")}</button></header>
    {/* Las mismas tres opciones de tiempo que las pestañas del mapa de Inicio, los mismos tipos
        que su filtro y los mismos once lugares: saltar de una pantalla a otra no cambia el vocabulario. */}
    <div className="ex-filters"><label>{c("planFilterWhen")}<select aria-label={c("planFilterWhen")} value={period} onChange={e => { setPeriod(e.target.value as PlanPeriod); touched(); }}><option value="all">{c("upcoming")}</option><option value="week">{c("thisWeek")}</option><option value="mine">{c("myPlans")}</option></select></label><label>{c("placeKind")}<select aria-label={c("placeKind")} value={kind} onChange={e => chooseKind(e.target.value as PlaceKind | "")}><option value="">{kindLabels.all[languageIndex(locale)]}</option>{placeKinds.map(value => <option key={value} value={value}>{kindLabels[value][languageIndex(locale)]}</option>)}</select></label><label>{c("place")}<select aria-label={c("place")} value={place} onChange={e => { setPlace(e.target.value); touched(); }}><option value="">{c("allPlaces")}</option>{places.filter(value => !kind || spotOf(value)?.kind === kind).map(value => <option key={value} value={value}>{localName(value, locale)}</option>)}</select></label><label className="ex-check"><input type="checkbox" checked={available} onChange={e => { setAvailable(e.target.checked); touched(); }}/>{c("withFreeSpots")}</label>{(place || kind) && <button type="button" className="ex-link ex-to-map" onClick={() => go("home", { place: place || undefined, period, kind: kind || undefined, anchor: "mapa" })}><MapPin />{c("seeOnMap")}</button>}{place && <PlaceGame place={place} className="ex-place-game" />}<span role="status">{plans.length} {plans.length === 1 ? c("planOne") : c("plansCount")}</span></div>
    {plans.length ? <div className="ex-plan-grid">{plans.slice(0, shown).map((plan,index) => <ExplorePlan key={plan.id} plan={plan} featured={index === 0} open={plan.id === target} onMap={() => go("home", { place: plan.place, period, kind: kind && spotOf(plan.place)?.kind === kind ? kind : undefined, anchor: "mapa" })}/>)}</div> : place ? <div className="ex-empty ex-empty-place"><MapPin /><h3>{planHereEmpty(c, place, locale)}</h3><button className="ex-link" onClick={() => setCreating(true)}>{c("planHere")}<Plus /></button></div> : <div className="ex-empty"><Coffee /><h3>{t("Este hueco puede ser tu plan.", "Este buit pot ser el teu pla.")}</h3><p>{t("No hay planes con estos filtros. Prueba otro lugar o propón el primero.", "No hi ha plans amb estos filtres. Prova un altre lloc o proposa el primer.")}</p><button className="ex-link" onClick={() => setCreating(true)}>{c("createPlan")}<Plus /></button></div>}
    {plans.length > shown || showAll && plans.length > 6 ? <button className="ex-link ex-more" onClick={() => setShowAll(value => !value)}>{showAll ? c("showLess") : c("seeAllPlans")}<ArrowDown /></button> : null}
    <CreatePlanModal open={creating} onOpenChange={setCreating} defaultPlace={place || undefined}/>
  </section>;
}

function ExplorePlan({ plan, featured, open, onMap }: { plan: Plan; featured: boolean; open: boolean; onMap: () => void }) {
  const { c, locale, data } = useCommunity();
  const members = data.planMembers.filter(member => member.plan_id === plan.id);
  const date = new Date(plan.starts_at), dateLocale = locale === "va" ? "ca-ES" : "es-ES";
  return <article className={`ex-plan ${featured ? "ex-plan-featured" : ""}`} id={`plan-${plan.id}`}>
    {featured && <div className="ex-plan-art" aria-hidden="true"><Coffee /><span>{locale === "va" ? "ens veiem fora" : "nos vemos fuera"}</span><i/><i/></div>}
    <div className="ex-plan-main"><div className="ex-plan-date"><time dateTime={plan.starts_at}><strong>{new Intl.DateTimeFormat(dateLocale,{day:"2-digit",timeZone:"Europe/Madrid"}).format(date)}</strong><span>{new Intl.DateTimeFormat(dateLocale,{month:"short",timeZone:"Europe/Madrid"}).format(date)}</span></time><span>{formatDate(plan.starts_at,locale)}</span></div><h3>{plan.title}</h3><p className="ex-location"><MapPin />{localName(plan.place,locale)}<button type="button" className="ex-plan-map" onClick={onMap}>{c("seeOnMap")}<ArrowUpRight /></button></p><details className="ex-plan-detail" open={open || undefined}><summary>{c("planDetails")}<Plus /></summary><div><p>{plan.description}</p><strong>{c("meeting")}</strong><p>{plan.meeting_point}</p><ExternalLink href={mapUrl(plan)}>{c("location")}</ExternalLink></div></details><footer><div className="ex-members"><div className="u-avatar-stack">{members.slice(0,3).map(member => <Avatar key={member.user_id} size="small" person={data.profiles.find(profile => profile.user_id === member.user_id)}/>)}</div><span>{Math.max(0,plan.capacity-members.length)} {c("placesLeft")}</span></div><Attendance plan={plan}/></footer></div>
  </article>;
}

function ExploreGroups() {
  const { c, locale, data, me, query, busy, repo, run, go } = useCommunity();
  const t = (es: string, va: string) => locale === "va" ? va : es;
  const [campus, setCampus] = useState(""), [category, setCategory] = useState(""), [showAll, setShowAll] = useState(false);
  const groups = data.groups.filter(group => (!campus || group.campus === campus) && (!category || group.category === category) && matches(query,group.name,group.description,group.campus));
  return <section className="ex-section ex-groups" id="ex-groups" aria-labelledby="ex-groups-title"><header className="ex-section-head"><div><p className="ex-kicker">{t("LOS TUYOS ANDAN POR AQUÍ", "ELS TEUS CAMINEN PER ACÍ")}</p><h2 id="ex-groups-title">{t("Lo raro sería que solo te gustara a ti.", "Seria estrany que només t’agradara a tu.")}</h2></div><button className="ex-link" onClick={() => go("groups")}><Plus />{t("Ver y crear grupos", "Vore i crear grups")}</button></header><div className="ex-filters"><label>{c("yourCampus")}<select aria-label={c("yourCampus")} value={campus} onChange={e => setCampus(e.target.value)}><option value="">{c("allCampuses")}</option>{campuses.map(value => <option key={value}>{value}</option>)}</select></label><label>{c("category")}<select aria-label={c("category")} value={category} onChange={e => setCategory(e.target.value)}><option value="">{c("all")}</option>{(["study","leisure","projects"] as const).map(value => <option key={value} value={value}>{c(value)}</option>)}</select></label><span role="status">{groups.length} {t("grupos", "grups")}</span></div><div className="ex-group-grid">{groups.slice(0, showAll ? undefined : 6).map(group => {
    const members = data.groupMembers.filter(member => member.group_id === group.id);
    const joined = members.some(member => member.user_id === me.user_id), own = group.creator_id === me.user_id;
    const Icon = group.category === "study" ? BookOpen : group.category === "leisure" ? Coffee : Sparkles;
    return <article key={group.id} className={`ex-group ex-group-${group.category}`}><div className="ex-group-art" aria-hidden="true"><Icon /><i/><i/></div><span className="ex-kicker">{localName(group.campus,locale)}</span><h3>{group.name}</h3><p>{group.description}</p><div className="ex-members"><div className="u-avatar-stack">{members.slice(0,4).map(member => <Avatar key={member.user_id} size="small" person={data.profiles.find(profile => profile.user_id === member.user_id)}/>)}</div><span><Users />{members.length} {c("members")}</span></div><footer><Action secondary={joined} disabled={busy||own} onClick={() => void run(() => repo.joinGroup(group.id,!joined),"")}>{own ? c("member") : joined ? c("leaveGroup") : c("joinGroup")}</Action>{joined && <button className="ex-link" onClick={() => go("messages",{groupId:group.id})}>{t("Conversación", "Conversa")}<ArrowUpRight /></button>}</footer></article>;
  })}</div>{!groups.length && <p className="ex-empty">{t("No hay grupos con estos filtros. Prueba otro campus o crea el tuyo.", "No hi ha grups amb estos filtres. Prova un altre campus o crea el teu.")}</p>}{groups.length > 6 && <button className="ex-link ex-more" onClick={() => setShowAll(value => !value)}>{showAll ? c("showLess") : t("Ver todos los grupos", "Vore tots els grups")}<ArrowDown /></button>}</section>;
}

function ExploreCampus() {
  const { c, locale, data, query, go } = useCommunity();
  const t = (es: string, va: string) => locale === "va" ? va : es;
  const notes = data.notes.filter(note => matches(query,note.title,note.subject,note.campus));
  return <section className="ex-campus ex-section" aria-labelledby="ex-campus-title"><div className="ex-campus-intro"><BookOpen /><p className="ex-kicker">{t("TAMBIÉN HAY QUE APROBAR", "TAMBÉ CAL APROVAR")}</p><h2 id="ex-campus-title">{t("Ese tema que se te atasca.", "Eixe tema que se’t resistix.")}</h2><p>{t("Igual alguien ya lo ha explicado mejor. Apuntes compartidos y grupos para estudiar juntos.", "Potser algú ja ho ha explicat millor. Apunts compartits i grups per a estudiar junts.")}</p><button className="ex-link" onClick={() => go("campus")}>{t("Abrir los apuntes", "Obrir els apunts")}<ArrowUpRight /></button></div><div className="ex-notes">{notes.slice(0,4).map((note,index) => <button key={note.id} onClick={() => go("campus")}><span className="ex-note-number">{String(index+1).padStart(2,"0")}</span><span><small>{note.subject} · {localName(note.campus,locale)}</small><strong>{note.title}</strong></span><ArrowUpRight /></button>)}{!notes.length && <div className="ex-empty"><p>{t("Todavía no hay apuntes para esta búsqueda. Puedes compartir los tuyos.", "Encara no hi ha apunts per a esta cerca. Pots compartir els teus.")}</p><button className="ex-link" onClick={() => go("campus")}>{c("campus")}<ArrowUpRight /></button></div>}</div></section>;
}

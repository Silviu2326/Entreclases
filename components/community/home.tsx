"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowUpRight, CalendarDays, MapPin, MessageCircle, Plus } from "lucide-react";
import { formatDate, localName } from "@/lib/community/copy";
import { places, type Plan } from "@/lib/community/types";
import { useCommunity } from "./context";
import { Action, Avatar } from "./controls";
import { Feed } from "./feed";
import { Attendance, CreatePlanModal } from "./plans";
import { WEEK_MS, spotOf, type PlaceKind } from "@/lib/community/places";
const ActivityMap = dynamic(() => import("./activity-map").then(m => m.ActivityMap), { ssr: false });

export function Home() {
 const { c, locale, data, me, query, go, place: arriving, kind: arrivingKind, period } = useCommunity();
 const [creating, setCreating] = useState(false);
 const [showMap, setShowMap] = useState(!!arriving);
 const [place, setPlace] = useState<string | null>(arriving ?? null);
 const [kind, setKind] = useState<PlaceKind | null>(arrivingKind ?? null);
 const [now, setNow] = useState(() => Date.now());
 useEffect(() => { const id=window.setInterval(()=>setNow(Date.now()),60000); return ()=>window.clearInterval(id); }, []);
 const upcoming=useMemo(()=>data.plans.filter(p=>Date.parse(p.starts_at)>now).sort((a,b)=>a.starts_at.localeCompare(b.starts_at)),[data.plans,now]);
 const counts=useMemo(()=>{const result:Record<string,number>={};for(const p of upcoming)result[p.place]=(result[p.place]??0)+1;return result;},[upcoming]);
 const weekPlans=upcoming.filter(p=>Date.parse(p.starts_at)<now+WEEK_MS);
 const listed=(period==="week"?weekPlans:period==="mine"?upcoming.filter(p=>data.planMembers.some(m=>m.plan_id===p.id&&m.user_id===me.user_id)):upcoming).filter(p=>(!place||p.place===place)&&(!kind||spotOf(p.place)?.kind===kind));
 const myGroups=data.groups.filter(g=>data.groupMembers.some(m=>m.group_id===g.id&&m.user_id===me.user_id)).slice(0,3);
 const [lastArrival,setLastArrival]=useState({place:arriving,kind:arrivingKind});
 if(arriving!==lastArrival.place||arrivingKind!==lastArrival.kind){setLastArrival({place:arriving,kind:arrivingKind});setPlace(arriving??null);setKind(arrivingKind??null);if(arriving)setShowMap(true);}
 useEffect(()=>{if(window.location.hash==="#mapa"){const id=requestAnimationFrame(()=>{setShowMap(true);document.getElementById("mapa")?.scrollIntoView();});return ()=>cancelAnimationFrame(id);}},[]);
 if(query) return <Feed compact />;
 return <div className="u-home">
  <section className="u-home-top">
   <div className="u-home-top-copy"><p className="u-eyebrow">{me.name.split(/\s+/)[0]} · {localName(me.campus,locale)}</p><h2>{locale==="va"?"Què fem hui?":"¿Qué hacemos hoy?"}</h2><p>{locale==="va"?"Un pla prop, una conversa pendent o una idea per començar.":"Un plan cerca, una conversación pendiente o una idea por empezar."}</p></div>
   <div className="u-home-pills"><Action onClick={()=>setCreating(true)}><Plus/>{c("createPlan")}</Action><button className="u-text-link" onClick={focusComposer}><MessageCircle/>{c("quickThread")}</button></div>
  </section>
  <section className="u-home-upcoming" aria-labelledby="home-plans-title"><div className="u-home-section-heading"><div><p className="u-eyebrow">{locale==="va"?"Prop de tu":"Cerca de ti"}</p><h2 id="home-plans-title">{locale==="va"?"Els pròxims plans":"Los próximos planes"}</h2></div><button className="u-text-link" onClick={()=>go("plans")}>{locale==="va"?"Tots els plans":"Todos los planes"}<ArrowUpRight/></button></div><div className="u-activity-list">{upcoming.slice(0,3).map(plan=><ActivityRow key={plan.id} plan={plan} onDetails={()=>go("explore",{anchor:`plan-${plan.id}`})}/>)}{!upcoming.length&&<p>{c("noPlansBody")}</p>}</div></section>
  {myGroups.length>0&&<section className="u-home-group-links" aria-label={c("groups")}><strong>{c("following")}</strong>{myGroups.map(g=><button key={g.id} className="u-text-link" onClick={()=>go("home",{groupId:g.id,anchor:"u-home-forum"})}>{g.name}<ArrowUpRight/></button>)}</section>}
  <section className="u-home-forum" id="u-home-forum" aria-label={c("forumSection")}><Feed compact home/><button className="u-text-link" onClick={()=>go("messages")}>{locale==="va"?"Veure totes les converses":"Ver todas las conversaciones"}<ArrowUpRight/></button></section>
  <section className="u-home-discovery"><div><p className="u-eyebrow">{c("projects")}</p><h2>{locale==="va"?"La teua idea busca equip.":"Tu idea busca equipo."}</h2><p>{locale==="va"?"Troba un projecte on aportar el que saps o proposa’n un.":"Encuentra un proyecto donde aportar lo que sabes o propón uno."}</p></div><Action secondary onClick={()=>go("projects")}>{c("projects")}<ArrowUpRight/></Action></section>
  <section id="mapa" className="u-home-map"><button className="u-text-link" aria-expanded={showMap} aria-controls="home-map-content" onClick={()=>setShowMap(v=>!v)}><MapPin/>{locale==="va"?"Explorar plans en el mapa":"Explorar planes en el mapa"}</button>{showMap&&<div id="home-map-content"><ActivityMap selected={place} onSelect={setPlace} counts={counts} kind={kind} onKindChange={setKind}/>{listed.slice(0,6).map(plan=><ActivityRow key={plan.id} plan={plan} onDetails={()=>go("explore",{anchor:`plan-${plan.id}`,place:place??undefined,kind:kind??undefined,period:period??undefined})}/>)}{!listed.length&&<p>{c("noActivityHere")}</p>}</div>}</section>
  <CreatePlanModal open={creating} onOpenChange={setCreating}/>
 </div>;
}
function focusComposer(){document.getElementById("u-home-forum")?.scrollIntoView({block:"start"});document.querySelector<HTMLTextAreaElement>("#u-home-forum textarea")?.focus({preventScroll:true});}
function ActivityRow({ plan, onDetails }: { plan: Plan; onDetails: () => void }) {
  const { c, locale, data } = useCommunity();
  const members = data.planMembers.filter(member => member.plan_id === plan.id);
  const free = Math.max(0, plan.capacity - members.length);
  const tone = Math.max(0, places.indexOf(plan.place));
  return <article className={`u-activity-row u-activity-tone-${tone % 5}`}>
    <div className="u-activity-when">
      <CalendarDays aria-hidden="true" />
      <time dateTime={plan.starts_at}>{formatDate(plan.starts_at, locale)}</time>
    </div>
    <h3>{plan.title}</h3>
    <p className="u-activity-where"><MapPin aria-hidden="true" />{localName(plan.place, locale)} · {plan.meeting_point}</p>
    <div className="u-activity-foot">
      <div className="u-activity-people">
        <div className="u-avatar-stack">{members.slice(0, 4).map(member => <Avatar key={member.user_id} size="small" person={data.profiles.find(profile => profile.user_id === member.user_id)} />)}</div>
        <span>{free} {c("placesLeft")}</span>
      </div>
      <div className="u-activity-cta">
        <Attendance plan={plan} />
        <button type="button" className="u-text-link" onClick={onDetails}>{c("planDetails")}<ArrowUpRight aria-hidden="true" /></button>
      </div>
    </div>
  </article>;
}

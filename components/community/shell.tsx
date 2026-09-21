"use client";

import { useEffect, useState, type RefObject } from "react";

import Link from "next/link";

import dynamic from "next/dynamic";

import { Dialog } from "radix-ui";

import { Newspaper, ArrowUpRight, BookOpen, CalendarDays, ChevronLeft, ChevronRight, Compass, Home, MapPin, Mail, Menu, MessageCircle, Search, Users, UserRound, X, LogOut, Sparkles, ArrowRight, Sprout } from "lucide-react";

import { Input } from "@/components/ui/input";

import { getAuthClient } from "@/lib/auth/client";

import { localPath } from "@/lib/i18n/routes";

import { formatDate, localName, type CopyKey } from "@/lib/community/copy";

import type { View } from "@/lib/community/types";

import { useCommunity, type GoOptions } from "./context";

import { gamePath, languageIndex } from "@/lib/community/games/catalog";

import { games } from "./games/catalog";

import { GameScreen } from "./games";

import { projectPath, projectsPath, sectionById } from "@/lib/community/studio/sections";

import { Action, Avatar, IconAction, Loading } from "./controls";

import { Home as HomeScreen } from "./home";

import { CoinBalance } from "./unicoins";

function ScreenLoading(){const {c}=useCommunity();return <div className="u-screen-loading" role="status" aria-live="polite"><span className="sr-only">{c("loading")}</span><div className="u-screen-loading-copy" aria-hidden="true"><span/><span/></div><div className="u-screen-loading-grid" aria-hidden="true"><span/><span/><span/></div></div>;}

function RouteProgress({label,view}:{label:string;view:View}){
 return <div className={`u-route-progress u-route-progress-${view}`} role="status" aria-live="polite"><span className="sr-only">{label}</span></div>;
}

const Unicoins=dynamic(()=>import("./unicoins").then(m=>m.Unicoins),{loading:ScreenLoading});

const Plans=dynamic(()=>import("./plans").then(m=>m.Plans),{loading:ScreenLoading});

const Groups=dynamic(()=>import("./groups").then(m=>m.Groups),{loading:ScreenLoading});

const Campus=dynamic(()=>import("./campus").then(m=>m.Campus),{loading:ScreenLoading});

const People=dynamic(()=>import("./people-profile").then(m=>m.People),{loading:ScreenLoading});

const MyProfile=dynamic(()=>import("./people-profile").then(m=>m.MyProfile),{loading:ScreenLoading});

const Messages=dynamic(()=>import("./messages").then(m=>m.Messages),{loading:ScreenLoading});

const Discover=dynamic(()=>import("./discover").then(m=>m.Discover),{loading:ScreenLoading});
const ProjectScreen=dynamic(()=>import("./projects/screen").then(m=>m.ProjectScreen),{loading:ScreenLoading});
const Magazine=dynamic(()=>import("./magazine").then(m=>m.Magazine),{loading:ScreenLoading});
const Explore=dynamic(()=>import("./explore").then(m=>m.Explore),{loading:ScreenLoading});
const MailboxPage=dynamic(()=>import("./mailbox").then(m=>m.MailboxPage),{loading:ScreenLoading});

const navigation:{view:View;Icon:typeof Home}[]=[{view:"home",Icon:Home},{view:"explore",Icon:Compass},{view:"magazine",Icon:Newspaper},{view:"messages",Icon:MessageCircle},{view:"profile",Icon:UserRound}];

export function CommunityShell({navigating=false,headingRef,query,setQuery,notice,dismissNotice,onRefresh}:{navigating?:boolean;headingRef:RefObject<HTMLHeadingElement|null>;query:string;setQuery:(q:string)=>void;notice:{text:string;error:boolean}|null;dismissNotice:()=>void;onRefresh:()=>Promise<void>}){

 const {c,locale,demo,view,game,project,projectId,me,go,busy,repo}=useCommunity();const gameEntry=game?games.find(entry=>entry.id===game):undefined;
 // A project section titles the page itself; the hub keeps the ordinary "Proyectos" heading.
 const sectionEntry=project&&project!=="hub"?sectionById(project):undefined;
 const projectHref=(target:typeof locale)=>sectionEntry?projectPath(target,demo,sectionEntry.id,projectId??undefined):projectsPath(target,demo);const [drawer,setDrawer]=useState(false),[leaving,setLeaving]=useState(false),[logoutError,setLogoutError]=useState("");

 const logout=async()=>{if(demo){repo.dispose();window.location.assign(localPath(locale,"home"));return;}setLeaving(true);setLogoutError("");const {error}=await getAuthClient().auth.signOut({scope:"local"});if(error){setLogoutError(c("genericError"));setLeaving(false);}};

 const navigate=(v:View)=>{setDrawer(false);go(v);};

 const exploreViews:View[]=["explore","projects","plans","groups","campus","people","discover"];
 const isCurrent=(candidate:View)=>candidate==="explore"?exploreViews.includes(view):view===candidate;

 const nav=<><Link className="u-brand" href={localPath(locale,"home")}>entreclase<span aria-hidden="true">&#10035;</span></Link><span className="u-campus-stamp"><span/>Val&#232;ncia &#183; {c("campus")}</span><nav aria-label={c("navigation")}>{navigation.map(({view:v,Icon})=><button key={v} onClick={()=>navigate(v)} className={isCurrent(v)?"active":""} aria-current={isCurrent(v)?"page":undefined}><Icon aria-hidden="true"/>{c(v)}{isCurrent(v)&&<span className="u-nav-dot"/>}</button>)}</nav><SidebarNote locale={locale} />{!demo&&<div className="u-sidebar-bottom"><button className="u-logout" onClick={()=>void logout()} disabled={leaving}><LogOut aria-hidden="true"/>{c("logout")}</button>{logoutError&&<p role="alert" className="u-small">{logoutError}</p>}</div>}</>;

 const screen=project?<ProjectScreen/>:game?<GameScreen id={game}/>:view==="home"?<HomeScreen/>:view==="explore"?<Explore/>:view==="magazine"?<Magazine/>:view==="plans"?<Plans/>:view==="groups"?<Groups/>:view==="campus"?<Campus/>:view==="people"?<People/>:view==="messages"?<Messages/>:view==="mailbox"?<MailboxPage/>:view==="profile"?<MyProfile/>:view==="unicoins"?<Unicoins/>:view==="discover"?<Discover/>:<Loading label={c("loading")}/>;

 return <><a href="#community-content" className="u-skip">{locale==="va"?"Anar al contingut":"Ir al contenido"}</a><aside className="u-sidebar">{nav}</aside><div className="u-workspace"><header className="u-topbar"><div className="u-mobile-brand"><IconAction label={c("more")} onClick={()=>setDrawer(true)}><Menu/></IconAction><Link className="u-brand" href={localPath(locale,"home")}>entreclase<span aria-hidden="true">&#10035;</span></Link></div><div className="u-breadcrumb"><span>Entreclase</span><ChevronRight aria-hidden="true"/>{gameEntry?<><button onClick={()=>go("explore")}>{c("explore")}</button><ChevronRight aria-hidden="true"/>{gameEntry.title[languageIndex(locale)]}</>:sectionEntry?<><Link href={projectsPath(locale,demo)}>{c("projects")}</Link><ChevronRight aria-hidden="true"/>{sectionEntry.title[languageIndex(locale)]}</>:c(view)}</div><div className="u-topbar-actions"><Mailbox/><CoinBalance/><div className="u-language" aria-label={locale==="va"?"Idioma":"Idioma"}>{(["es","va"] as const).map(l=><Link key={l} lang={l==="va"?"ca-ES-valencia":"es"} aria-current={l===locale?"page":undefined} href={game?gamePath(l,demo,game):project?projectHref(l):localPath(l,demo?"demo":"app")+(view!=="home"?`?view=${view}`:"")}>{l==="es"?"ES":"VAL"}</Link>)}</div><button className="u-top-avatar" onClick={()=>go("profile")} aria-label={c("profile")}><Avatar size="small" person={me}/></button></div>{navigating&&<RouteProgress view={view} label={locale==="va"?"Carregant la secció":"Cargando la sección"}/>}</header>{demo&&<div className="u-demo-banner"><Sparkles aria-hidden="true"/><p><strong>{c("demo")}.</strong> {c("demoHelp")}</p><Link href={localPath(locale,"login")}>{c("realAccess")}<ArrowUpRight aria-hidden="true"/></Link></div>}<div className={`u-page u-page-${view} ${view==="home"?"u-page-home":""}`}><main id="community-content" tabIndex={-1}><div className="u-page-heading"><div><p className="u-eyebrow">{c(view)} &#183; {locale==="va"?"València":"Valencia"}</p><h1 ref={headingRef} tabIndex={-1}>{gameEntry?gameEntry.title[languageIndex(locale)]:sectionEntry?sectionEntry.title[languageIndex(locale)]:c(`${view}Title` as CopyKey)}</h1><p>{gameEntry?gameEntry.description[languageIndex(locale)]:sectionEntry?sectionEntry.body[languageIndex(locale)]:c(`${view}Sub` as CopyKey)}</p></div></div>{!game&&!sectionEntry&&<div className="u-search"><Search aria-hidden="true"/><label className="sr-only" htmlFor="community-search">{c("search")}</label><Input id="community-search" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={c("search")} autoComplete="off"/>{query&&<IconAction label={c("close")} onClick={()=>setQuery("")}><X/></IconAction>}</div>}<div className="u-screen" aria-busy={navigating} key={game??project??view}>{screen}</div></main>{view==="home"&&<RightRail/>}</div></div><nav className="u-bottom-nav" aria-label={c("navigation")}>{navigation.map(({view:v,Icon})=><button key={v} className={isCurrent(v)?"active":""} aria-current={isCurrent(v)?"page":undefined} onClick={()=>go(v)}><Icon aria-hidden="true"/><span>{c(v)}</span></button>)}</nav><Dialog.Root open={drawer} onOpenChange={setDrawer}><Dialog.Portal><Dialog.Overlay className="u-overlay"/><Dialog.Content className="u-mobile-drawer community-surface" aria-describedby={undefined}><Dialog.Title className="sr-only">{c("navigation")}</Dialog.Title><Dialog.Close asChild><IconAction label={c("close")}><X/></IconAction></Dialog.Close>{nav}</Dialog.Content></Dialog.Portal></Dialog.Root>{notice&&<div className={`u-toast community-surface ${notice.error?"error":""}`} role={notice.error?"alert":"status"}><p>{notice.text}</p><IconAction label={c("close")} onClick={dismissNotice}><X/></IconAction></div>}</>;

}

function SidebarNote({locale}:{locale:"es"|"va"}){

 const messages=locale==="va"?["Menys scroll.\nM\u00e9s \u00abbaixem?\u00bb.","La uni \u00e9s m\u00e9s f\u00e0cil\nquan hi ha tribu.","Un caf\u00e9 r\u00e0pid\npot canviar-te el dia.","Hui tamb\u00e9 compta\nper con\u00e9ixer gent.","El teu pr\u00f2xim pla\ncomen\u00e7a ac\u00ed.","No busques una excusa.\nBusca companyia."]:["Menos scroll.\nM\u00e1s \u00ab\u00bfbajamos?\u00bb.","La uni se vive mejor\ncuando hay tribu.","Un caf\u00e9 r\u00e1pido\npuede cambiarte el d\u00eda.","Hoy tambi\u00e9n cuenta\npara conocer gente.","Tu pr\u00f3ximo plan\nempieza aqu\u00ed.","No busques una excusa.\nBusca compa\u00f1\u00eda."];

 const [index,setIndex]=useState(0);

 useEffect(()=>{const timer=window.setInterval(()=>setIndex(current=>(current+1)%messages.length),5200);return()=>window.clearInterval(timer)},[messages.length]);

 const previous=()=>setIndex(current=>(current-1+messages.length)%messages.length);

 const next=()=>setIndex(current=>(current+1)%messages.length);

 return <div className={`u-sidebar-note u-sidebar-note-step-${index%4}`}><div className="u-sidebar-note-top"><span className="u-sidebar-note-icon"><Sprout aria-hidden="true"/></span><span className="u-sidebar-note-count">{index+1}/{messages.length}</span></div><div className="u-sidebar-note-copy" aria-live="polite"><p key={index} className={`u-sidebar-note-copy-motion-${index%4}`}>{messages[index]}</p></div><div className="u-sidebar-note-footer"><div className="u-sidebar-note-progress" aria-hidden="true">{messages.map((_,position)=><span key={position} className={position===index?"active":""}/>)}</div><div className="u-sidebar-note-actions"><div className="u-sidebar-note-controls"><button type="button" onClick={previous} aria-label="Texto anterior"><ChevronLeft aria-hidden="true"/></button><button type="button" onClick={next} aria-label="Texto siguiente"><ChevronRight aria-hidden="true"/></button></div></div></div></div>;

}

/* Los planes del lateral abren su ficha en Explorar, que es la lista canónica; «Mis planes» llega ya filtrado. */
function RightRail(){const {c,locale,data,me,go}=useCommunity();const plans=data.plans.filter(p=>new Date(p.starts_at).getTime()>Date.now()&&data.planMembers.some(m=>m.plan_id===p.id&&m.user_id===me.user_id)).slice(0,2),people=data.profiles.filter(p=>p.user_id!==me.user_id).slice(0,3);return <aside className="u-right-rail"><div className="u-rail-heading"><h2>{c("myPlans")}</h2><button onClick={()=>go("explore",{anchor:"ex-plans",period:"mine"})} aria-label={c("myPlans")}><ArrowUpRight/></button></div>{plans.length?plans.map(p=><button key={p.id} className="u-rail-plan" onClick={()=>go("explore",{anchor:`plan-${p.id}`,period:"mine"})}><CalendarDays aria-hidden="true"/><div><small>{formatDate(p.starts_at,locale)}</small><strong>{p.title}</strong><span><MapPin aria-hidden="true"/>{localName(p.place,locale)}</span></div></button>):<p className="u-rail-empty">{c("noMyPlans")}</p>}<div className="u-rail-quote"><span aria-hidden="true">&#8599;</span><p>{locale==="va"?"El teu pr\u00f2xim amic no est\u00e0 en un reel.":"Tu pr\u00f3ximo amigo no est\u00e1 en un reel."}</p><small>{locale==="va"?"Potser est\u00e0 en la classe del costat.":"Igual est\u00e1 en la clase de al lado."}</small><button onClick={()=>go("people")}>{c("sayHi")}<ArrowRight aria-hidden="true"/></button></div><div className="u-rail-heading"><h2>{c("people")}</h2><button onClick={()=>go("people")} aria-label={c("people")}><ArrowUpRight/></button></div>{people.map(p=><button className="u-rail-person" key={p.user_id} onClick={()=>go("people")}><Avatar person={p}/><span><strong>{p.name}</strong><small>{p.campus}</small></span><PlusSmall/></button>)}<div className="u-rail-footer"><Link href={localPath(locale,"home")}>Entreclase &#183; Val&#232;ncia</Link><p>{locale==="va"?"La universitat tamb\u00e9 passa fora.":"La universidad tamb\u00e9n pasa fuera."}</p></div></aside>;}

function PlusSmall(){return <ArrowUpRight aria-hidden="true"/>;}

function Mailbox(){
 const {locale,go}=useCommunity();
 const [open,setOpen]=useState(false);
 const myPlans:GoOptions={anchor:"ex-plans",period:"mine"};
 const items=locale==="va"?[
  {id:"plan",title:"Paula t’ha apuntat a un pla",detail:"Café en Benimaclet · hui",action:"explore" as View,options:myPlans},
  {id:"reply",title:"Han respost al teu fil",detail:"El campus està despert",action:"messages" as View},
  {id:"project",title:"El teu projecte té novetats",detail:"Hi ha una nova sol·licitud",action:"explore" as View},
 ]:[
  {id:"plan",title:"Paula te ha apuntado a un plan",detail:"Café en Benimaclet · hoy",action:"explore" as View,options:myPlans},
  {id:"reply",title:"Han respondido a tu hilo",detail:"El campus está despierto",action:"messages" as View},
  {id:"project",title:"Tu proyecto tiene novedades",detail:"Hay una nueva solicitud",action:"explore" as View},
 ];
 const closeAndGo=(view:View,options?:GoOptions)=>{setOpen(false);go(view,options);};
 return <div className="u-mailbox-wrap"><button className={`u-mailbox ${open?"is-open":""}`} type="button" aria-label={locale==="va"?"Obrir bústia, 3 avisos":"Abrir buzón, 3 avisos"} aria-expanded={open} aria-controls="u-mailbox-panel" onClick={()=>setOpen(value=>!value)}><Mail aria-hidden="true"/><span className="u-mailbox-badge">3</span></button>{open&&<div id="u-mailbox-panel" className="u-mailbox-panel" role="dialog" aria-label={locale==="va"?"Bústia":"Buzón"}><header><div><span>{locale==="va"?"BÚSTIA":"BUZÓN"}</span><strong>{locale==="va"?"El que t’arriba fins ací.":"Lo que llega hasta ti."}</strong></div><button type="button" aria-label={locale==="va"?"Tancar bústia":"Cerrar buzón"} onClick={()=>setOpen(false)}><X aria-hidden="true"/></button></header><div className="u-mailbox-list">{items.map(item=><button className="u-mailbox-item" key={item.id} type="button" onClick={()=>closeAndGo(item.action,item.options)}><span className={`u-mailbox-mark u-mailbox-mark-${item.id}`} aria-hidden="true"/><span><strong>{item.title}</strong><small>{item.detail}</small></span><ArrowUpRight aria-hidden="true"/></button>)}</div><footer><button type="button" onClick={()=>closeAndGo("mailbox")}>{locale==="va"?"Veure tots els missatges":"Ver todos los mensajes"}<ArrowRight aria-hidden="true"/></button></footer></div>}</div>;
}

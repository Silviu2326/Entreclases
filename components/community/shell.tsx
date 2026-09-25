"use client";

import { useState, type RefObject } from "react";

import Link from "next/link";

import dynamic from "next/dynamic";

import { Dialog } from "radix-ui";

import { Newspaper, ArrowUpRight, CalendarDays, ChevronRight, Compass, Home, MapPin, Mail, Menu, MessageCircle, Search, X, LogOut, Sparkles, ArrowRight } from "lucide-react";

import { Input } from "@/components/ui/input";

import { getAuthClient } from "@/lib/auth/client";

import { localPath } from "@/lib/i18n/routes";

import { formatDate, localName, type CopyKey } from "@/lib/community/copy";

import type { View } from "@/lib/community/types";
import { GraduationCap } from "lucide-react";
import { StudentHub } from "./student";

import { useCommunity, type GoOptions } from "./context";

import { gamePath, languageIndex } from "@/lib/community/games/catalog";

import { games } from "./games/catalog";

import { GameScreen } from "./games";

import { projectPath, projectsPath, sectionById } from "@/lib/community/studio/sections";

import { Avatar, IconAction, Loading } from "./controls";

import { Home as HomeScreen } from "./home";

import { LegalLinks } from "@/components/entreclase/legal-links";

import { useClock } from "@/lib/community/use-clock";
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

/* Cinco puertas, todo lo demás dentro de ellas. Las secciones secundarias siguen
   teniendo rutas propias para los enlaces profundos, pero no compiten con la
   navegación principal. */
const navigation:{view:View;Icon:typeof Home}[]=[
 {view:"home",Icon:Home},
 {view:"explore",Icon:Compass},
 {view:"messages",Icon:MessageCircle},
 {view:"magazine",Icon:Newspaper},
 {view:"student",Icon:GraduationCap},
];
const mobileNavigation=navigation;

export function CommunityShell({navigating=false,headingRef,query,setQuery,notice,dismissNotice}:{navigating?:boolean;headingRef:RefObject<HTMLHeadingElement|null>;query:string;setQuery:(q:string)=>void;notice:{text:string;error:boolean}|null;dismissNotice:()=>void;onRefresh:()=>Promise<void>}){

 const {c,locale,demo,view,game,project,projectId,me,go,repo}=useCommunity();const gameEntry=game?games.find(entry=>entry.id===game):undefined;
 // A project section titles the page itself; the hub keeps the ordinary "Proyectos" heading.
 const sectionEntry=project&&project!=="hub"?sectionById(project):undefined;
 const projectHref=(target:typeof locale)=>sectionEntry?projectPath(target,demo,sectionEntry.id,projectId??undefined):projectsPath(target,demo);const [drawer,setDrawer]=useState(false),[leaving,setLeaving]=useState(false),[logoutError,setLogoutError]=useState("");

 const logout=async()=>{if(demo){repo.dispose();window.location.assign(localPath(locale,"home"));return;}setLeaving(true);setLogoutError("");const {error}=await getAuthClient().auth.signOut({scope:"local"});if(error){setLogoutError(c("genericError"));setLeaving(false);}};

 const navigate=(v:View)=>{setDrawer(false);go(v);};

 const exploreViews:View[]=["explore","plans","campus","people","discover","projects"];
 const messagesViews:View[]=["messages","groups"];
 const isCurrent=(candidate:View)=>candidate==="explore"?exploreViews.includes(view):candidate==="messages"?messagesViews.includes(view):view===candidate;

 const nav=<><Link className="u-brand" href={localPath(locale,"home")}>entreclases<span aria-hidden="true">&#10035;</span></Link><span className="u-campus-stamp"><span/>Val&#232;ncia &#183; {c("campus")}</span><nav aria-label={c("navigation")}>{navigation.map(({view:v,Icon})=><button key={v} onClick={()=>navigate(v)} className={isCurrent(v)?"active":""} aria-current={isCurrent(v)?"page":undefined}><Icon aria-hidden="true"/>{c(v)}{isCurrent(v)&&<span className="u-nav-dot"/>}</button>)}</nav>{!demo&&<div className="u-sidebar-bottom"><button className="u-logout" onClick={()=>void logout()} disabled={leaving}><LogOut aria-hidden="true"/>{c("logout")}</button>{logoutError&&<p role="alert" className="u-small">{logoutError}</p>}</div>}</>;

 const screen=project?<ProjectScreen/>:game?<GameScreen id={game}/>:view==="home"?<HomeScreen/>:view==="explore"?<Explore/>:view==="magazine"?<Magazine/>:view==="plans"?<Plans/>:view==="groups"?<Groups/>:view==="campus"?<Campus/>:view==="people"?<People/>:view==="messages"?<Messages/>:view==="mailbox"?<MailboxPage/>:view==="profile"?<MyProfile/>:view==="unicoins"?<Unicoins/>:view==="discover"?<Discover/>:view==="student"?<StudentHub/>:<Loading label={c("loading")}/>;

 return <><a href="#community-content" className="u-skip">{locale==="va"?"Anar al contingut":"Ir al contenido"}</a><aside className="u-sidebar">{nav}</aside><div className="u-workspace"><header className="u-topbar"><div className="u-mobile-brand"><IconAction label={c("more")} onClick={()=>setDrawer(true)}><Menu/></IconAction><Link className="u-brand" href={localPath(locale,"home")}>entreclases<span aria-hidden="true">&#10035;</span></Link></div><div className="u-breadcrumb"><span>Entreclases</span><ChevronRight aria-hidden="true"/>{gameEntry?<><button onClick={()=>go("explore")}>{c("explore")}</button><ChevronRight aria-hidden="true"/>{gameEntry.title[languageIndex(locale)]}</>:sectionEntry?<><Link href={projectsPath(locale,demo)}>{c("projects")}</Link><ChevronRight aria-hidden="true"/>{sectionEntry.title[languageIndex(locale)]}</>:c(view)}</div><div className="u-topbar-actions"><Mailbox/><CoinBalance/><div className="u-language" aria-label={locale==="va"?"Idioma":"Idioma"}>{(["es","va"] as const).map(l=><Link key={l} lang={l==="va"?"ca-ES-valencia":"es"} aria-current={l===locale?"page":undefined} href={game?gamePath(l,demo,game):project?projectHref(l):localPath(l,demo?"demo":"app")+(view!=="home"?`?view=${view}`:"")}>{l==="es"?"ES":"VAL"}</Link>)}</div><button className="u-top-avatar" onClick={()=>go("profile")} aria-label={c("profile")}><Avatar size="small" person={me}/></button></div>{navigating&&<RouteProgress view={view} label={locale==="va"?"Carregant la secció":"Cargando la sección"}/>}</header>{demo&&<div className="u-demo-banner"><Sparkles aria-hidden="true"/><p><strong>{c("demo")}.</strong> {c("demoHelp")}</p><Link href={localPath(locale,"login")}>{c("realAccess")}<ArrowUpRight aria-hidden="true"/></Link></div>}<div className={`u-page u-page-${view} ${view==="home"?"u-page-home":""}`}><main id="community-content" tabIndex={-1}><div className={`u-page-heading${view==="student"?" sr-only":""}`}><div><p className="u-eyebrow">{c(view)} &#183; {locale==="va"?"València":"Valencia"}</p><h1 ref={headingRef} tabIndex={-1}>{gameEntry?gameEntry.title[languageIndex(locale)]:sectionEntry?sectionEntry.title[languageIndex(locale)]:c(`${view}Title` as CopyKey)}</h1><p>{gameEntry?gameEntry.description[languageIndex(locale)]:sectionEntry?sectionEntry.body[languageIndex(locale)]:c(`${view}Sub` as CopyKey)}</p></div></div>{!game&&!sectionEntry&&view!=="student"&&<div className="u-search"><Search aria-hidden="true"/><label className="sr-only" htmlFor="community-search">{c("search")}</label><Input id="community-search" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={c("search")} autoComplete="off"/>{query&&<IconAction label={c("close")} onClick={()=>setQuery("")}><X/></IconAction>}</div>}<div className="u-screen" aria-busy={navigating} key={game??project??view}>{screen}</div><footer className="u-legal-footer"><LegalLinks locale={locale}/></footer></main>{view==="home"&&<RightRail/>}</div></div><nav className="u-bottom-nav" aria-label={c("navigation")}>{mobileNavigation.map(({view:v,Icon})=><button key={v} className={isCurrent(v)?"active":""} aria-current={isCurrent(v)?"page":undefined} onClick={()=>go(v)}><Icon aria-hidden="true"/><span>{c(v)}</span></button>)}</nav><Dialog.Root open={drawer} onOpenChange={setDrawer}><Dialog.Portal><Dialog.Overlay className="u-overlay"/><Dialog.Content className="u-mobile-drawer community-surface" aria-describedby={undefined}><Dialog.Title className="sr-only">{c("navigation")}</Dialog.Title><Dialog.Close asChild><IconAction label={c("close")}><X/></IconAction></Dialog.Close>{nav}</Dialog.Content></Dialog.Portal></Dialog.Root>{notice&&<div className={`u-toast community-surface ${notice.error?"error":""}`} role={notice.error?"alert":"status"}><p>{notice.text}</p><IconAction label={c("close")} onClick={dismissNotice}><X/></IconAction></div>}</>;

}

/* Los planes del lateral abren su ficha en Explorar, que es la lista canónica; «Mis planes» llega ya filtrado. */
function RightRail(){const now=useClock();const {c,locale,data,me,go}=useCommunity();const plans=data.plans.filter(p=>new Date(p.starts_at).getTime()>now&&data.planMembers.some(m=>m.plan_id===p.id&&m.user_id===me.user_id)).slice(0,2),people=data.profiles.filter(p=>p.user_id!==me.user_id).slice(0,3);return <aside className="u-right-rail"><div className="u-rail-heading"><h2>{c("myPlans")}</h2><button onClick={()=>go("explore",{anchor:"ex-plans",period:"mine"})} aria-label={c("myPlans")}><ArrowUpRight/></button></div>{plans.length?plans.map(p=><button key={p.id} className="u-rail-plan" onClick={()=>go("explore",{anchor:`plan-${p.id}`,period:"mine"})}><CalendarDays aria-hidden="true"/><div><small>{formatDate(p.starts_at,locale)}</small><strong>{p.title}</strong><span><MapPin aria-hidden="true"/>{localName(p.place,locale)}</span></div></button>):<p className="u-rail-empty">{c("noMyPlans")}</p>}<div className="u-rail-heading"><h2>{c("people")}</h2><button onClick={()=>go("people")} aria-label={c("people")}><ArrowUpRight/></button></div>{people.map(p=><button className="u-rail-person" key={p.user_id} onClick={()=>go("people")}><Avatar person={p}/><span><strong>{p.name}</strong><small>{p.campus}</small></span><PlusSmall/></button>)}<div className="u-rail-footer"><Link href={localPath(locale,"home")}>Entreclases &#183; Val&#232;ncia</Link><p>{locale==="va"?"La universitat tamb\u00e9 passa fora.":"La universidad también pasa fuera."}</p></div></aside>;}

function PlusSmall(){return <ArrowUpRight aria-hidden="true"/>;}

function Mailbox(){
 const {locale,go,demo}=useCommunity();
 const [open,setOpen]=useState(false);
 const myPlans:GoOptions={anchor:"ex-plans",period:"mine"};
 const items= !demo ? [] : locale==="va"?[
  {id:"plan",title:"Paula t’ha apuntat a un pla",detail:"Café en Benimaclet · hui",action:"explore" as View,options:myPlans},
  {id:"reply",title:"Han respost al teu fil",detail:"El campus està despert",action:"messages" as View},
  {id:"project",title:"El teu projecte té novetats",detail:"Hi ha una nova sol·licitud",action:"explore" as View},
 ]:[
  {id:"plan",title:"Paula te ha apuntado a un plan",detail:"Café en Benimaclet · hoy",action:"explore" as View,options:myPlans},
  {id:"reply",title:"Han respondido a tu hilo",detail:"El campus está despierto",action:"messages" as View},
  {id:"project",title:"Tu proyecto tiene novedades",detail:"Hay una nueva solicitud",action:"explore" as View},
 ];
 const closeAndGo=(view:View,options?:GoOptions)=>{setOpen(false);go(view,options);};
 return <div className="u-mailbox-wrap"><button className={`u-mailbox ${open?"is-open":""}`} type="button" aria-label={locale==="va"?`Obrir bústia, ${items.length} avisos`:`Abrir buzón, ${items.length} avisos`} aria-expanded={open} aria-controls="u-mailbox-panel" onClick={()=>setOpen(value=>!value)}><Mail aria-hidden="true"/>{items.length>0&&<span className="u-mailbox-badge">{items.length}</span>}</button>{open&&<div id="u-mailbox-panel" className="u-mailbox-panel" role="dialog" aria-label={locale==="va"?"Bústia":"Buzón"}><header><div><span>{locale==="va"?"BÚSTIA":"BUZÓN"}</span><strong>{locale==="va"?"El que t’arriba fins ací.":"Lo que llega hasta ti."}</strong></div><button type="button" aria-label={locale==="va"?"Tancar bústia":"Cerrar buzón"} onClick={()=>setOpen(false)}><X aria-hidden="true"/></button></header><div className="u-mailbox-list">{!items.length&&<p>{locale==="va"?"Consulta les teues converses en la bústia.":"Consulta tus conversaciones en el buzón."}</p>}{items.map(item=><button className="u-mailbox-item" key={item.id} type="button" onClick={()=>closeAndGo(item.action,item.options)}><span className={`u-mailbox-mark u-mailbox-mark-${item.id}`} aria-hidden="true"/><span><strong>{item.title}</strong><small>{item.detail}</small></span><ArrowUpRight aria-hidden="true"/></button>)}</div><footer><button type="button" onClick={()=>closeAndGo("mailbox")}>{locale==="va"?"Veure tots els missatges":"Ver todos los mensajes"}<ArrowRight aria-hidden="true"/></button></footer></div>}</div>;
}

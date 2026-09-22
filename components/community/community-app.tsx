"use client";
import { useEffectEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, GraduationCap } from "lucide-react";
import { authConfigured } from "@/lib/auth/config";
import { getAuthClient, getUniversityMember, type UniversityMember } from "@/lib/auth/client";
import { localPath, type Locale } from "@/lib/i18n/routes";
import { unicoinCopy } from "@/lib/i18n/unicoins";
import { communityCopy, communityError } from "@/lib/community/copy";
import type { CommunityData, CommunityRepository, View } from "@/lib/community/types";
import { views } from "@/lib/community/types";
import type { GameKind } from "@/lib/community/games/types";
import { gamePath } from "@/lib/community/games/catalog";
import { projectPath, projectsPath, type ProjectRoute } from "@/lib/community/studio/sections";
import { siteTitle } from "@/lib/i18n/metadata";
import { withFakeHomeData } from "@/lib/community/fake-home-data";
import { StudioProvider } from "./studio-context";
import { CommunityContext, type GoOptions } from "./context";
import { isPlaceKind, isPlanPeriod, type PlaceKind, type PlanPeriod } from "@/lib/community/places";
import { Action, Loading } from "./controls";
import { CommunityShell } from "./shell";
import { ProfileEditor } from "./people-profile";
import { useAnalytics } from "@/components/analytics/analytics-provider";

type Runtime={member:UniversityMember;repo:CommunityRepository;data:CommunityData};
export function CommunityApp({locale,demo=false,game=null,project=null}:{locale:Locale;demo?:boolean;game?:GameKind|null;project?:ProjectRoute|null}){
 const c=communityCopy(locale);const [runtime,setRuntime]=useState<Runtime|null>(null),[error,setError]=useState(""),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  let active=true,repository:CommunityRepository|undefined,identity:string|undefined; const client=!demo&&authConfigured?getAuthClient():null;
  const open=async()=>{try{
   let member:UniversityMember;
   if(demo){const {createDemoRepository,demoUserId}=await import("@/lib/community/demo");member={id:demoUserId,name:"Álex Torres",email:"",university:"Universitat de València"};repository=createDemoRepository(locale);}
   else {if(!client)return;const session=await client.auth.getSession();if(session.error)throw session.error;if(!session.data.session){window.location.replace(localPath(locale,"login"));return;}member=await getUniversityMember();const {createCommunityRepository}=await import("@/lib/community/repository");repository=createCommunityRepository(member.id);}
   identity=member.id;const params=new URLSearchParams(window.location.search);const loadedData=await repository.read(params.get("invite")??undefined);const fakeHome=demo&&params.get("fake")==="1";const data=fakeHome?withFakeHomeData(loadedData,locale):loadedData;if(active)setRuntime({member,repo:repository,data});
  }catch(e){if(active)setError(communityError(e,locale));}};
  queueMicrotask(()=>{if(active){setError("");setRuntime(null);void open();}});
  const subscription=client?.auth.onAuthStateChange((event,session)=>{if(!active)return;if(event==="SIGNED_OUT"){setRuntime(null);window.location.replace(localPath(locale,"login"));}else if(event==="SIGNED_IN"&&identity&&session?.user.id!==identity){setRuntime(null);setAttempt(n=>n+1);}});
  return()=>{active=false;subscription?.data.subscription.unsubscribe();repository?.dispose();};
 },[demo,locale,attempt]);
 if(runtime)return <CommunityWorkspace key={`${demo}-${locale}-${runtime.member.id}`} locale={locale} demo={demo} game={game} project={project} runtime={runtime} onLostAccess={()=>{setRuntime(null);setError(c("accessError"));}}/>;
 return <div className="community-surface u-gate"><Link href={localPath(locale,"home")} className="u-brand">entreclases<span>✳</span></Link>{!demo&&!authConfigured?<><GraduationCap className="u-gate-icon" aria-hidden="true"/><h1>{c("preparing")}</h1><p>{c("preparingBody")}</p><Action asChild><Link href={localPath(locale,"demo")}>{c("exploreDemo")}<ArrowUpRight/></Link></Action></>:error?<><h1>{c("accessError")}</h1><p role="alert">{error}</p><Action onClick={()=>setAttempt(n=>n+1)}>{c("retry")}</Action><Link className="u-text-link" href={localPath(locale,"demo")}>{c("exploreDemo")}</Link></>:<Loading label={c("loading")}/>}<Link className="u-text-link" href={localPath(locale,"home")}>{c("backLanding")}</Link><noscript>Entreclases necesita JavaScript para abrir la aplicación. / Entreclases necessita JavaScript per a obrir l’aplicació.</noscript></div>;
}
function CommunityWorkspace({locale,demo,game,project,runtime,onLostAccess}:{locale:Locale;demo:boolean;game:GameKind|null;project:ProjectRoute|null;runtime:Runtime;onLostAccess:()=>void}){
 const c=communityCopy(locale),[data,setData]=useState(runtime.data),[view,setView]=useState<View>(game?"explore":project?"projects":"home"),[activeGame,setActiveGame]=useState<GameKind|null>(game),[activeProject,setActiveProject]=useState<ProjectRoute|null>(project),[projectId,setProjectId]=useState<string|null>(null),[query,setQuery]=useState(""),[groupId,setGroupId]=useState<string|null>(null),[threadId,setThreadId]=useState<string|null>(null),[place,setPlace]=useState<string|null>(null),[period,setPeriod]=useState<PlanPeriod|null>(null),[kind,setKind]=useState<PlaceKind|null>(null),[busy,setBusy]=useState(false),[pageLoading,setPageLoading]=useState(false),[notice,setNotice]=useState<{text:string;error:boolean}|null>(null);const locked=useRef(false),mounted=useRef(true),heading=useRef<HTMLHeadingElement>(null);
 const trimSlash=(value:string)=>value.replace(/\/+$/,"");
 const onGamePage=()=>game!==null&&trimSlash(window.location.pathname)===trimSlash(gamePath(locale,demo,game));
 const projectRoute=project===null?null:project==="hub"?projectsPath(locale,demo):projectPath(locale,demo,project);
 const onProjectPage=()=>projectRoute!==null&&trimSlash(window.location.pathname)===trimSlash(projectRoute);
 const readView=useEffectEvent(()=>{if(onGamePage()){setActiveGame(game);return "explore" as View;}setActiveGame(null);const params=new URLSearchParams(window.location.search);if(onProjectPage()){setActiveProject(project);setProjectId(params.get("id"));return "projects" as View;}setActiveProject(null);setGroupId(params.get("group"));setPlace(params.get("place"));const when=params.get("when"),kindParam=params.get("kind");setPeriod(isPlanPeriod(when)?when:null);setKind(isPlaceKind(kindParam)?kindParam:null);const raw=params.get("view");if(raw==="projects"){window.location.replace(projectsPath(locale,demo));return "projects" as View;}return views.includes(raw as View)?raw as View:"home";});
 useEffect(()=>{mounted.current=true;queueMicrotask(()=>{if(mounted.current)setView(readView());});const pop=()=>{setView(readView());setQuery("");setThreadId(null);};window.addEventListener("popstate",pop);return()=>{mounted.current=false;window.removeEventListener("popstate",pop);};},[]);
 useEffect(()=>{if(demo)return;let pending=false,active=true;const check=async()=>{if(document.visibilityState!=="visible"||pending)return;pending=true;try{const member=await getUniversityMember();if(active&&member.id!==runtime.member.id)onLostAccess();}catch{if(active)onLostAccess();}finally{pending=false;}};window.addEventListener("focus",check);document.addEventListener("visibilitychange",check);return()=>{active=false;window.removeEventListener("focus",check);document.removeEventListener("visibilitychange",check);};},[demo,runtime.member.id,onLostAccess]);
 const refresh=useCallback(async()=>{const result=await runtime.repo.read();if(mounted.current)setData(result);return result;},[runtime.repo]);
 const run=async(task:()=>Promise<unknown>,message=c("done"))=>{if(locked.current)return false;locked.current=true;setBusy(true);setNotice(null);let success=false;try{await task();success=true;try{const fresh=await refresh();const delta=fresh.wallet.balance-data.wallet.balance;const coinText=delta?`${unicoinCopy(locale)(delta>0?"earned":"spent")} ${Math.abs(delta)} ClasiCoins.`:"";if(mounted.current&&(message||coinText))setNotice({text:[message,coinText].filter(Boolean).join(" "),error:false});}catch{if(mounted.current)setNotice({text:c("refreshAfterSave"),error:true});}}catch(e){if(mounted.current)setNotice({text:communityError(e,locale),error:true});try{await refresh();}catch{/* Keep the action error; a later refresh can restore connectivity. */}}finally{locked.current=false;if(mounted.current)setBusy(false);}return success;};
 /* `anchor` deja el id de la sección en el hash: la pantalla que llega lo lee al montarse,
    y aquí se intenta también el salto para cuando ya estabas en esa misma pantalla. */
 const go=(requested:View,options?:GoOptions)=>{if(requested==="projects"){window.location.assign(projectsPath(locale,demo));return;}const next=requested;const anchor=options?.anchor??"";if(activeGame||activeProject)updatePageTitle(siteTitle(locale));setPageLoading(true);setView(next);setActiveGame(null);setActiveProject(null);setQuery("");setGroupId(options?.groupId??null);setThreadId(options?.threadId??null);setPlace(options?.place??null);setPeriod(options?.period??null);setKind(options?.kind??null);const url=new URL(localPath(locale,demo?"demo":"app"),window.location.href);if(next!=="home")url.searchParams.set("view",next);if(options?.groupId)url.searchParams.set("group",options.groupId);else url.searchParams.delete("group");if(options?.place)url.searchParams.set("place",options.place);else url.searchParams.delete("place");if(options?.period)url.searchParams.set("when",options.period);else url.searchParams.delete("when");if(options?.kind)url.searchParams.set("kind",options.kind);else url.searchParams.delete("kind");url.searchParams.delete("invite");if(anchor)url.hash=anchor;history.pushState(null,"",url);window.setTimeout(()=>{if(mounted.current)setPageLoading(false);},420);if(options?.stay)return;requestAnimationFrame(()=>{heading.current?.focus({preventScroll:true});if(!anchor){window.scrollTo({top:0,behavior:"instant"});return;}requestAnimationFrame(()=>document.getElementById(anchor)?.scrollIntoView({block:"start"}));});};
 const me=data.profiles.find(p=>p.user_id===runtime.member.id);
 const placeholder={user_id:runtime.member.id,name:runtime.member.name,university:runtime.member.university,account_kind:runtime.member.account_kind,campus:runtime.member.account_kind==="guest"?"Valencia":"Tarongers",degree:"",year:runtime.member.account_kind==="guest"?0:1,bio:"",interests:[],color:0,favorites:[],picks:[],avatar_url:"/avatars/alex.svg",relationship_status:"prefer_not_to_say" as const,created_at:""};
 const analyticsPath=activeGame?gamePath(locale,demo,activeGame):view==="home"?localPath(locale,demo?"demo":"app"):`${localPath(locale,demo?"demo":"app")}?view=${view}`;
 useAnalytics({enabled:!demo&&authConfigured,locale,path:analyticsPath,view,game:activeGame});
 return <CommunityContext.Provider value={{locale,c,demo,member:runtime.member,data,me:me??placeholder,repo:runtime.repo,feedback:notice,busy,query,view,game:activeGame,project:activeProject,projectId,groupId,threadId,place,period,kind,go,run,refresh}}><StudioProvider><div className="community-app community-surface">{me?<CommunityShell navigating={pageLoading} headingRef={heading} query={query} setQuery={setQuery} notice={notice} dismissNotice={()=>setNotice(null)} onRefresh={async()=>{if(locked.current)return;setBusy(true);locked.current=true;try{await refresh();setNotice(null);}catch(e){setNotice({text:communityError(e,locale),error:true});}finally{setBusy(false);locked.current=false;}}}/>:<div className="u-onboarding"><Link href={localPath(locale,"home")} className="u-brand">entreclases<span>✳</span></Link><div className="u-card"><p className="u-eyebrow">{runtime.member.university}</p><h1>{c("introTitle")}</h1><p className="u-muted">{c("introBody")}</p><p className="u-onboarding-coins">{unicoinCopy(locale)("start")}</p><ProfileEditor initial={placeholder} onboarding onSaved={profile=>setData(prev=>({...prev,profiles:[...prev.profiles.filter(p=>p.user_id!==profile.user_id),profile]}))}/>{notice&&<p role={notice.error?"alert":"status"} className="u-form-notice">{notice.text}</p>}</div><Action secondary onClick={()=>void getAuthClient().auth.signOut({scope:"local"}).then(({error})=>{if(error)setNotice({text:c("genericError"),error:true});})}>{c("logout")}</Action></div>}</div></StudioProvider></CommunityContext.Provider>;
}

function updatePageTitle(title:string){document.title=title;}
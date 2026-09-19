"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, GraduationCap } from "lucide-react";
import { authConfigured } from "@/lib/auth/config";
import { getAuthClient, getUniversityMember, type UniversityMember } from "@/lib/auth/client";
import { localPath, type Locale } from "@/lib/i18n/routes";
import { unicoinCopy } from "@/lib/i18n/unicoins";
import { communityCopy, communityError } from "@/lib/community/copy";
import type { CommunityData, CommunityRepository, View } from "@/lib/community/types";
import { views } from "@/lib/community/types";
import { withFakeHomeData } from "@/lib/community/fake-home-data";
import { StudioProvider } from "./studio-context";
import { CommunityContext } from "./context";
import { Action, Loading } from "./controls";
import { CommunityShell } from "./shell";
import { ProfileEditor } from "./people-profile";

type Runtime={member:UniversityMember;repo:CommunityRepository;data:CommunityData};
export function CommunityApp({locale,demo=false}:{locale:Locale;demo?:boolean}){
 const c=communityCopy(locale);const [runtime,setRuntime]=useState<Runtime|null>(null),[error,setError]=useState(""),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  let active=true,repository:CommunityRepository|undefined,identity:string|undefined; const client=!demo&&authConfigured?getAuthClient():null;
  const open=async()=>{try{
   let member:UniversityMember;
   if(demo){const {createDemoRepository,demoUserId}=await import("@/lib/community/demo");member={id:demoUserId,name:"Álex Torres",email:"",university:"Universitat de València"};repository=createDemoRepository(locale);}
   else {if(!client)return;const session=await client.auth.getSession();if(session.error)throw session.error;if(!session.data.session){window.location.replace(localPath(locale,"login"));return;}member=await getUniversityMember();const {createCommunityRepository}=await import("@/lib/community/repository");repository=createCommunityRepository(member.id);}
   identity=member.id;const loadedData=await repository.read();const fakeHome=new URLSearchParams(window.location.search).get("fake")==="1";const data=fakeHome?withFakeHomeData(loadedData,locale):loadedData;if(active)setRuntime({member,repo:repository,data});
  }catch(e){if(active)setError(communityError(e,locale));}};
  setError("");setRuntime(null);void open();
  const subscription=client?.auth.onAuthStateChange((event,session)=>{if(!active)return;if(event==="SIGNED_OUT"){setRuntime(null);window.location.replace(localPath(locale,"login"));}else if(event==="SIGNED_IN"&&identity&&session?.user.id!==identity){setRuntime(null);setAttempt(n=>n+1);}});
  return()=>{active=false;subscription?.data.subscription.unsubscribe();repository?.dispose();};
 },[demo,locale,attempt]);
 if(runtime)return <CommunityWorkspace key={`${demo}-${locale}-${runtime.member.id}`} locale={locale} demo={demo} runtime={runtime} onLostAccess={()=>{setRuntime(null);setError(c("accessError"));}}/>;
 return <div className="community-surface u-gate"><Link href={localPath(locale,"home")} className="u-brand">entreclase<span>✳</span></Link>{!demo&&!authConfigured?<><GraduationCap className="u-gate-icon" aria-hidden="true"/><h1>{c("preparing")}</h1><p>{c("preparingBody")}</p><Action asChild><Link href={localPath(locale,"demo")}>{c("exploreDemo")}<ArrowUpRight/></Link></Action></>:error?<><h1>{c("accessError")}</h1><p role="alert">{error}</p><Action onClick={()=>setAttempt(n=>n+1)}>{c("retry")}</Action><Link className="u-text-link" href={localPath(locale,"demo")}>{c("exploreDemo")}</Link></>:<Loading label={c("loading")}/>}<Link className="u-text-link" href={localPath(locale,"home")}>{c("backLanding")}</Link><noscript>Entreclase necesita JavaScript para abrir la aplicación. / Entreclase necessita JavaScript per a obrir l’aplicació.</noscript></div>;
}
function CommunityWorkspace({locale,demo,runtime,onLostAccess}:{locale:Locale;demo:boolean;runtime:Runtime;onLostAccess:()=>void}){
 const c=communityCopy(locale),[data,setData]=useState(runtime.data),[view,setView]=useState<View>("home"),[query,setQuery]=useState(""),[groupId,setGroupId]=useState<string|null>(null),[threadId,setThreadId]=useState<string|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState<{text:string;error:boolean}|null>(null);const locked=useRef(false),mounted=useRef(true),heading=useRef<HTMLHeadingElement>(null);
 const readView=()=>{const params=new URLSearchParams(window.location.search);const raw=params.get("view");if(raw==="projects"){const url=new URL(window.location.href);url.searchParams.set("view","explore");url.hash="proyectos";window.history.replaceState(null,"",url);return "explore" as View;}return views.includes(raw as View)?raw as View:"home";};
 useEffect(()=>{mounted.current=true;setView(readView());const pop=()=>{setView(readView());setQuery("");setGroupId(null);setThreadId(null);};window.addEventListener("popstate",pop);return()=>{mounted.current=false;window.removeEventListener("popstate",pop);};},[]);
 useEffect(()=>{if(demo)return;let pending=false,active=true;const check=async()=>{if(document.visibilityState!=="visible"||pending)return;pending=true;try{const member=await getUniversityMember();if(active&&member.id!==runtime.member.id)onLostAccess();}catch{if(active)onLostAccess();}finally{pending=false;}};window.addEventListener("focus",check);document.addEventListener("visibilitychange",check);return()=>{active=false;window.removeEventListener("focus",check);document.removeEventListener("visibilitychange",check);};},[demo,runtime.member.id,onLostAccess]);
 const refresh=useCallback(async()=>{const result=await runtime.repo.read();if(mounted.current)setData(result);return result;},[runtime.repo]);
 const run=async(task:()=>Promise<unknown>,message=c("done"))=>{if(locked.current)return false;locked.current=true;setBusy(true);setNotice(null);let success=false;try{await task();success=true;try{const fresh=await refresh();const delta=fresh.wallet.balance-data.wallet.balance;const coinText=delta?`${unicoinCopy(locale)(delta>0?"earned":"spent")} ${Math.abs(delta)} ClasiCoins.`:"";if(mounted.current&&(message||coinText))setNotice({text:[message,coinText].filter(Boolean).join(" "),error:false});}catch{if(mounted.current)setNotice({text:c("refreshAfterSave"),error:true});}}catch(e){if(mounted.current)setNotice({text:communityError(e,locale),error:true});try{await refresh();}catch{/* Keep the action error; a later refresh can restore connectivity. */}}finally{locked.current=false;if(mounted.current)setBusy(false);}return success;};
 const go=(requested:View,options?:{groupId?:string;threadId?:string})=>{const next=requested==="projects"?"explore":requested;setView(next);setQuery("");setGroupId(options?.groupId??null);setThreadId(options?.threadId??null);const url=new URL(window.location.href);url.search="";if(next!=="home")url.searchParams.set("view",next);if(requested==="projects")url.hash="proyectos";history.pushState(null,"",url);requestAnimationFrame(()=>{heading.current?.focus({preventScroll:true});if(requested!=="projects")window.scrollTo({top:0,behavior:"instant"});});};
 const me=data.profiles.find(p=>p.user_id===runtime.member.id);
 const placeholder={user_id:runtime.member.id,name:runtime.member.name,university:runtime.member.university,campus:"Tarongers",degree:"",year:1,bio:"",interests:[],color:0,avatar_url:"/avatars/alex.svg",relationship_status:"prefer_not_to_say" as const,created_at:""};
 return <CommunityContext.Provider value={{locale,c,demo,member:runtime.member,data,me:me??placeholder,repo:runtime.repo,feedback:notice,busy,query,view,groupId,threadId,go,run,refresh}}><StudioProvider><div className="community-app community-surface">{me?<CommunityShell headingRef={heading} query={query} setQuery={setQuery} notice={notice} dismissNotice={()=>setNotice(null)} onRefresh={async()=>{if(locked.current)return;setBusy(true);locked.current=true;try{await refresh();setNotice(null);}catch(e){setNotice({text:communityError(e,locale),error:true});}finally{setBusy(false);locked.current=false;}}}/>:<div className="u-onboarding"><Link href={localPath(locale,"home")} className="u-brand">entreclase<span>✳</span></Link><div className="u-card"><p className="u-eyebrow">{runtime.member.university}</p><h1>{c("introTitle")}</h1><p className="u-muted">{c("introBody")}</p><p className="u-onboarding-coins">{unicoinCopy(locale)("start")}</p><ProfileEditor initial={placeholder} onboarding onSaved={profile=>setData(prev=>({...prev,profiles:[...prev.profiles.filter(p=>p.user_id!==profile.user_id),profile]}))}/>{notice&&<p role={notice.error?"alert":"status"} className="u-form-notice">{notice.text}</p>}</div><Action secondary onClick={()=>void getAuthClient().auth.signOut({scope:"local"}).then(({error})=>{if(error)setNotice({text:c("genericError"),error:true});})}>{c("logout")}</Action></div>}</div></StudioProvider></CommunityContext.Provider>;
}

"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, Flame, Heart, MessageCircle, MessageSquareText, Search, X } from "lucide-react";
import { useCommunity, matches } from "./context";
import { Action, Avatar, Empty } from "./controls";
import { Chat } from "./chat";
import { Feed } from "./feed";
import "./charlas.css";

/* One page, two ways of talking. On a wide screen the forum and the chats sit
   side by side; when there is no room for both, the switch decides which one
   fills the column. Arriving with a conversation open starts on the chats. */
export function Messages(){
 const {c,locale,data,me,threadId,go}=useCommunity();
 const t=(es:string,va:string)=>locale==="va"?va:es;
 const [mode,setMode]=useState<"forum"|"chats">(threadId?"chats":"forum"),[search,setSearch]=useState("");
 /* "Hablarlo entre dos" opens a conversation from inside a thread: follow it to the chats. */
 const [seenThread,setSeenThread]=useState(threadId);if(threadId!==seenThread){setSeenThread(threadId);if(threadId)setMode("chats");}
 /* Opening a conversation never teleports you. The page stays put, the chat panel
    comes into view if it was out of sight, flashes once so the eye lands on it,
    and the cursor is already in the reply box. Arriving from another screen is
    left alone: that one starts at the top like every other page. */
 const dock=useRef<HTMLElement>(null),arrived=useRef(false);
 useEffect(()=>{
  if(!arrived.current){arrived.current=true;return;}
  if(!threadId)return;
  const timer=window.setTimeout(()=>{const el=dock.current;if(!el)return;
   /* On a narrow screen the switch is the landmark: it shows you moved from "En abierto" to "Entre dos". */
   const tabs=el.parentElement?.querySelector<HTMLElement>(".u-message-tabs"),anchor=tabs?.offsetParent?tabs:el,top=anchor.getBoundingClientRect().top;
   if(top<84||top>window.innerHeight*.5)window.scrollTo({top:Math.max(0,window.scrollY+top-96),behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
   el.classList.remove("ch-arrived");void el.offsetWidth;el.classList.add("ch-arrived");document.getElementById("chat-message")?.focus({preventScroll:true});},260);
  return()=>window.clearTimeout(timer);
 },[threadId]);
 /* The masthead only ever quotes what this person could read in the forum. */
 const mine=data.groupMembers.filter(m=>m.user_id===me.user_id).map(m=>m.group_id);
 const open=data.posts.filter(p=>{const g=data.groups.find(x=>x.id===p.group_id);return !g?.is_private||mine.includes(g.id);});
 const voices=[...open].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)).slice(0,3);
 const talking=new Set([...open.map(p=>p.author_id),...data.comments.filter(x=>open.some(p=>p.id===x.post_id)).map(x=>x.author_id)]).size;
 const quote=(body:string,max=84)=>{const line=body.split("\n")[0];return line.length>max?`${line.slice(0,max-2).trimEnd()}…`:line;};
 /* The thread people are answering most. A reply weighs more than a like. */
 const likesOf=(id:string)=>data.likes.filter(l=>l.post_id===id).length,repliesOf=(id:string)=>data.comments.filter(x=>x.post_id===id).length;
 const heat=(id:string)=>likesOf(id)+2*repliesOf(id);
 const hot=[...open].sort((a,b)=>heat(b.id)-heat(a.id))[0];
 /* Walk to a thread. If a filter is hiding it, the board resets so it can be found. */
 const [board,setBoard]=useState(0);
 const jump=(id:string)=>{
  const reveal=()=>{const el=document.getElementById(`hilo-${id}`);if(!el||!el.offsetParent)return false;el.scrollIntoView({block:"center",behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});el.focus({preventScroll:true});el.classList.remove("ch-spotlit");void el.offsetWidth;el.classList.add("ch-spotlit");return true;};
  setMode("forum");
  window.setTimeout(()=>{if(reveal())return;setSearch("");setBoard(k=>k+1);window.setTimeout(reveal,160);},40);
 };
 return <div className="u-charlas" data-mode={mode}>
  <header className="ch-masthead">
   <div>
    <p className="ch-live"><span aria-hidden="true"/>{t("Ahora mismo en tu campus","Ara mateix al teu campus")}</p>
    <h1>{c("messages")}<span>.</span></h1>
    <p className="ch-lead">{t("Lo que se dice en abierto. Y lo que se queda entre dos.","El que es diu en obert. I el que es queda entre dos.")}</p>
    <ul className="ch-stats"><li><strong>{open.length}</strong>{c(open.length===1?"forumResult":"forumResults")}</li><li><strong>{data.groups.length}</strong>{c("communities").toLocaleLowerCase()}</li><li><strong>{talking}</strong>{t("voces","veus")}</li></ul>
   </div>
   {voices.length>0&&<ul className="ch-voices" aria-label={t("Lo último que se ha dicho","L’últim que s’ha dit")}>{voices.map(p=>{const author=data.profiles.find(a=>a.user_id===p.author_id);return <li key={p.id}><button type="button" className="ch-voice" onClick={()=>jump(p.id)}><Avatar size="small" person={author}/><span><strong>{author?.name??c("student")}</strong>{quote(p.body)}</span></button></li>;})}</ul>}
   <label className="ch-search"><Search aria-hidden="true"/><span className="sr-only">{c("search")}</span><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder={t("Busca un hilo, una comunidad, una persona…","Busca un fil, una comunitat, una persona…")} autoComplete="off"/>{search&&<button type="button" aria-label={c("close")} onClick={()=>setSearch("")}><X aria-hidden="true"/></button>}</label>
  </header>
  <div className="u-message-tabs" role="tablist" aria-label={c("messagesModes")}>
   <button type="button" role="tab" aria-selected={mode==="forum"} className={mode==="forum"?"active":""} onClick={()=>setMode("forum")}><MessageSquareText aria-hidden="true"/>{c("openTalk")}</button>
   <button type="button" role="tab" aria-selected={mode==="chats"} className={mode==="chats"?"active":""} onClick={()=>setMode("chats")}><MessageCircle aria-hidden="true"/>{c("betweenTwo")}</button>
  </div>
  <section className="ch-communities" aria-labelledby="ch-communities-title">
   <div className="ch-communities-heading"><div><p className="ch-kicker">{t("DONDE TAMBIÉN SE HABLA","ON TAMBÉ ES PARLA")}</p><h2 id="ch-communities-title">{t("Tus comunidades, aquí al lado.","Les teues comunitats, ací al costat.")}</h2></div><button type="button" onClick={()=>go("groups")}>{t("Ver todas","Vore-les totes")}<ArrowDown aria-hidden="true"/></button></div>
   <div className="ch-communities-list">{data.groups.slice(0,4).map(group=><button type="button" key={group.id} onClick={()=>go("messages",{groupId:group.id})}><span className={`ch-community-mark ch-community-mark-${group.category}`} aria-hidden="true"/><span><strong>{group.name}</strong><small>{group.description}</small></span><ArrowDown aria-hidden="true"/></button>)}</div>
  </section>  <div className="u-charlas-forum">
   <p className="ch-kicker"><strong>{c("openTalk")}</strong>{c("openTalkHelp")}</p>
   {hot&&heat(hot.id)>0&&!search&&<article className="ch-hot" aria-label={c("threadOfDay")}>
    <p className="ch-hot-label"><Flame aria-hidden="true"/>{c("threadOfDay")}</p>
    <blockquote>{quote(hot.body,160)}</blockquote>
    <footer><Avatar size="small" person={data.profiles.find(a=>a.user_id===hot.author_id)}/><span className="ch-hot-author"><strong>{data.profiles.find(a=>a.user_id===hot.author_id)?.name??c("student")}</strong>{data.groups.find(g=>g.id===hot.group_id)?.name??c("allCampus")}</span><span className="ch-hot-counts"><Heart aria-hidden="true"/>{likesOf(hot.id)}<MessageCircle aria-hidden="true"/>{repliesOf(hot.id)}</span><button type="button" className="ch-hot-link" onClick={()=>jump(hot.id)}>{c("goToThread")}<ArrowDown aria-hidden="true"/></button></footer>
   </article>}
   <Feed key={board} compact forum search={search}/>
  </div>
  <aside className="u-charlas-dock" ref={dock} aria-label={c("privateMessages")}><PrivateChats query={search}/></aside>
  <footer className="ch-footer"><span>{c("messages")}.<small>× Entreclases</small></span><p>{t("Dilo aquí. Y luego, en persona.","Dis-ho ací. I després, en persona.")}</p></footer>
 </div>;
}

function PrivateChats({query}:{query:string}){const {c,data,me,go,threadId,repo,run,busy}=useCommunity();const selected=data.threads.find(t=>t.id===threadId);
 /* A chat list with one name in it is a dead end, so it also offers the next hello. */
 const known=new Set(data.threads.flatMap(t=>[t.user_a,t.user_b]));const strangers=query?[]:data.profiles.filter(p=>p.user_id!==me.user_id&&!known.has(p.user_id)).slice(0,3);
 const hello=async(peer:string)=>{let id="";if(await run(async()=>{id=await repo.openThread(peer);},""))go("messages",{threadId:id,stay:true});};const threads=data.threads.filter(t=>matches(query,data.profiles.find(p=>p.user_id===(t.user_a===me.user_id?t.user_b:t.user_a))?.name));return <div className={`u-messages ${selected?"u-chat-open":""}`}><aside className="u-chat-list"><header className="u-chat-list-head"><h2>{c("betweenTwo")}</h2><p>{c("privateMessagesHelp")}</p></header>{threads.length?threads.map(t=>{const peer=data.profiles.find(p=>p.user_id===(t.user_a===me.user_id?t.user_b:t.user_a));return <button className={t.id===selected?.id?"active":""} aria-current={t.id===selected?.id?"true":undefined} key={t.id} onClick={()=>go("messages",{threadId:t.id,stay:true})}><Avatar person={peer}/><span><strong>{peer?.name??c("student")}</strong><small>{peer?.campus??c("conversation")}</small></span><MessageCircle aria-hidden="true"/></button>;}):<Empty title={c("noMessages")} body={c("noMessagesBody")} action={<Action secondary onClick={()=>go("people")}>{c("people")}</Action>}/>}{strangers.length>0&&<section className="ch-strangers" aria-label={c("notTalkedYet")}><h3>{c("notTalkedYet")}</h3>{strangers.map(p=><div key={p.user_id}><Avatar size="small" person={p}/><span><strong>{p.name}</strong><small>{p.degree}</small></span><button type="button" disabled={busy} onClick={()=>void hello(p.user_id)}>{c("sayHi")}</button></div>)}</section>}</aside>{selected?<Chat key={selected.id} threadId={selected.id} peerId={selected.user_a===me.user_id?selected.user_b:selected.user_a}/>:<div className="u-chat-empty"><Empty title={c("selectChat")} body={c("noMessagesBody")} action={<Action onClick={()=>go("people")}>{c("sayHi")}</Action>}/></div>}</div>;}

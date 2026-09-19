"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, LockKeyhole, MessageCircle, MessageSquareText, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { communityError, formatDate } from "@/lib/community/copy";
import type { Message } from "@/lib/community/types";
import { useCommunity, matches } from "./context";
import { Action, Avatar, Empty, IconAction, Loading } from "./controls";
import { Feed } from "./feed";

export function Messages(){
 const {c}=useCommunity();
 return <div className="u-messages-page">
  <section className="u-message-section" aria-labelledby="forum-title">
   <header className="u-message-section-heading"><MessageSquareText aria-hidden="true"/><div><p className="u-eyebrow">{c("forum")}</p><h2 id="forum-title">{c("forumHelp")}</h2></div></header>
   <Feed compact/>
  </section>
  <section className="u-message-section" aria-labelledby="private-title">
   <header className="u-message-section-heading"><MessageCircle aria-hidden="true"/><div><p className="u-eyebrow">{c("privateMessages")}</p><h2 id="private-title">{c("privateMessagesHelp")}</h2></div></header>
   <PrivateChats/>
  </section>
 </div>;
}

function PrivateChats(){const {c,data,me,go,threadId,query}=useCommunity();const selected=data.threads.find(t=>t.id===threadId);const threads=data.threads.filter(t=>matches(query,data.profiles.find(p=>p.user_id===(t.user_a===me.user_id?t.user_b:t.user_a))?.name));return <div className={`u-messages ${selected?"u-chat-open":""}`}><aside className="u-chat-list"><h2>{c("privateMessages")}</h2>{threads.length?threads.map(t=>{const peer=data.profiles.find(p=>p.user_id===(t.user_a===me.user_id?t.user_b:t.user_a));return <button className={t.id===selected?.id?"active":""} aria-current={t.id===selected?.id?"true":undefined} key={t.id} onClick={()=>go("messages",{threadId:t.id})}><Avatar person={peer}/><span><strong>{peer?.name??c("student")}</strong><small>{peer?.campus??c("conversation")}</small></span><MessageCircle aria-hidden="true"/></button>;}):<Empty title={c("noMessages")} body={c("noMessagesBody")} action={<Action secondary onClick={()=>go("people")}>{c("people")}</Action>}/>}</aside>{selected?<Chat key={selected.id} threadId={selected.id} peerId={selected.user_a===me.user_id?selected.user_b:selected.user_a}/>:<div className="u-chat-empty"><Empty title={c("selectChat")} body={c("noMessagesBody")} action={<Action onClick={()=>go("people")}>{c("sayHi")}</Action>}/></div>}</div>;}

function Chat({threadId,peerId}:{threadId:string;peerId:string}){const {c,locale,data,me,repo,run,busy,demo,go}=useCommunity();const peer=data.profiles.find(p=>p.user_id===peerId);const [messages,setMessages]=useState<Message[]|null>(null),[body,setBody]=useState(""),[error,setError]=useState("");const scroll=useRef<HTMLDivElement>(null),atBottom=useRef(true),alive=useRef(true),loading=useRef(false);
 const load=useCallback(async()=>{if(loading.current)return;loading.current=true;try{const result=await repo.messages(threadId);if(alive.current){setMessages(result);setError("");}}catch(e){if(alive.current)setError(communityError(e,locale));}finally{loading.current=false;}},[repo,threadId,locale]);
 useEffect(()=>{alive.current=true;void load();const poll=()=>{if(document.visibilityState==="visible")void load();};const timer=window.setInterval(poll,10000);document.addEventListener("visibilitychange",poll);return()=>{alive.current=false;clearInterval(timer);document.removeEventListener("visibilitychange",poll);};},[load]);
 useEffect(()=>{if(atBottom.current&&scroll.current)scroll.current.scrollTop=scroll.current.scrollHeight;},[messages]);
 return <section className="u-chat" aria-label={`${c("conversation")}: ${peer?.name??c("student")}`}><header><IconAction label={c("backChats")} onClick={()=>go("messages")}><ArrowLeft/></IconAction><Avatar person={peer}/><div><h2>{peer?.name??c("student")}</h2><p>{peer?.campus}</p></div><LockKeyhole aria-label={c("privateChat")}/></header><p className="u-chat-privacy">{demo?c("demoMessages"):c("privateChat")}</p><div className="u-message-scroll" ref={scroll} onScroll={e=>{const el=e.currentTarget;atBottom.current=el.scrollHeight-el.scrollTop-el.clientHeight<80;}}>{messages===null&&!error?<Loading label={c("loading")}/>:messages?.length?messages.map(m=><article key={m.id} className={`u-message ${m.sender_id===me.user_id?"own":""}`}><span className="sr-only">{m.sender_id===me.user_id?me.name:peer?.name}</span><p>{m.body}</p><time dateTime={m.created_at}>{formatDate(m.created_at,locale)}</time></article>):<Empty title={c("noMessages")} body={c("messagesSub")}/>}</div>{messages&&messages.length>=100&&<p className="u-chat-privacy">{locale==="va"?"Es mostren els últims 100 missatges.":"Se muestran los últimos 100 mensajes."}</p>}{error&&<div className="u-chat-error" role="alert"><p>{error}</p><Action secondary onClick={()=>void load()}>{c("retry")}</Action></div>}<form className="u-message-form" onSubmit={async e=>{e.preventDefault();const sent=body;if(await run(()=>repo.sendMessage(threadId,sent),"")){setBody(prev=>prev===sent?"":prev);atBottom.current=true;await load();}}}><label className="sr-only" htmlFor="chat-message">{c("messagePlaceholder")}</label><Input id="chat-message" className="u-input" value={body} onChange={e=>setBody(e.target.value)} placeholder={c("messagePlaceholder")} maxLength={2000} required autoComplete="off"/><Action type="submit" disabled={busy||!body.trim()} aria-label={c("send")}><Send/></Action></form></section>;
}

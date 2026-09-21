"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { ArrowUpRight, Heart, MessageCircle, Plus, Send, Trash2, ArrowLeft, HelpCircle, ThumbsDown, Hand, LifeBuoy, UsersRound, BookOpen, Coffee, Lightbulb, Globe, Users, LockKeyhole, Share2 } from "lucide-react";
import { useCommunity, matches } from "./context";
import { Action, Avatar, Chips, Confirm, Empty, IconAction, Person, SelectField } from "./controls";
import { relativeDate, localName } from "@/lib/community/copy";
import { COIN_RULES } from "@/lib/community/unicoins";
import { unicoinCopy } from "@/lib/i18n/unicoins";
import { CoinAmount, SpendNotice, RewardHint } from "./unicoins";
import type { Group, Post, SignalKind } from "@/lib/community/types";
import { shareGroup } from "./groups";
const categoryIcon=(category:string)=>category==="study"?<BookOpen aria-hidden="true"/>:category==="leisure"?<Coffee aria-hidden="true"/>:<Lightbulb aria-hidden="true"/>;

/* The forum reads like a board: the communities you can post to on top, then the
   topic and the order, then the threads. Every filter works off data we already
   have — a post belongs to a group, and a group has a category and a campus. */
export function Feed({compact=false,home=false,forum=false,search}:{compact?:boolean;home?:boolean;forum?:boolean;search?:string}={}){
 /* Charlas brings its own search box; everywhere else the shell's query applies. */
 const {c,locale,data,me,query:shellQuery,groupId,go}=useCommunity(),query=search??shellQuery;
 const [filter,setFilter]=useState("all"),[community,setCommunity]=useState(""),[topic,setTopic]=useState("all"),[sort,setSort]=useState("new");
 const group=data.groups.find(g=>g.id===groupId),mine=data.groupMembers.filter(m=>m.user_id===me.user_id).map(m=>m.group_id);
 const selected=forum?data.groups.find(g=>g.id===community):undefined;
 const score=(id:string)=>data.likes.filter(l=>l.post_id===id).length,replies=(id:string)=>data.comments.filter(x=>x.post_id===id).length;
 const inScope=(p:Post)=>group?p.group_id===group.id:selected?p.group_id===selected.id:filter!=="groups"||(!!p.group_id&&mine.includes(p.group_id));
 const inTopic=(p:Post)=>!forum||topic==="all"||(topic==="question"?p.kind==="question":data.groups.find(g=>g.id===p.group_id)?.category===topic);
 const found=data.posts.filter(p=>{const postGroup=data.groups.find(g=>g.id===p.group_id);const visible=!postGroup?.is_private||mine.includes(postGroup.id);return visible&&inScope(p)&&inTopic(p)&&matches(query,p.body,data.profiles.find(a=>a.user_id===p.author_id)?.name,postGroup?.name);});
 const posts=forum?[...found].sort((a,b)=>sort==="top"?score(b.id)-score(a.id):sort==="talked"?replies(b.id)-replies(a.id):Date.parse(b.created_at)-Date.parse(a.created_at)):found;
 /* Posting straight into a community only works once you belong to it. */
 const composerGroup=group?.id??(selected&&mine.includes(selected.id)?selected.id:null);
 const communities=data.groups.filter(group=>!group.is_private||mine.includes(group.id)).sort((a,b)=>Number(mine.includes(b.id))-Number(mine.includes(a.id))||data.posts.filter(p=>p.group_id===b.id).length-data.posts.filter(p=>p.group_id===a.id).length);
 const pickCommunity=(id:string)=>{setCommunity(current=>current===id?"":id);setFilter("all");};
 return <div className={`u-feed ${forum?"u-forum":""}`}>
  {!compact&&!group&&!query&&<section className="u-welcome"><div><span className="u-eyebrow">València · {locale==="va"?"Ens veiem fora":"Nos vemos fuera"}</span><h2>{c("welcome")}<br/><em>{c("welcomeLine")}</em></h2><p>{c("welcomeBody")}</p><Action onClick={()=>go("plans")}>{c("findPlan")}<ArrowUpRight/></Action></div><Image src="/images/campus-walk.webp" alt={c("welcomeAlt")} width={620} height={760} priority/><span className="u-welcome-sticker" aria-hidden="true">{locale==="va"?"Ei, anem?":"Ey, ¿vamos?"}</span></section>}
  {group&&<div className="u-group-heading"><IconAction label={c("groups")} onClick={()=>go("groups")}><ArrowLeft/></IconAction><div><p className="u-eyebrow">{c("groups")} · {group.campus}</p><h2>{group.name}</h2><p>{group.description}</p></div></div>}
  <Composer key={composerGroup??"all"} groupId={composerGroup}/>
  {forum&&!group&&<div className="u-forum-bar">
   <div className="u-forum-communities" role="group" aria-label={c("communities")}>
    <button type="button" className={`u-forum-chip ${!community&&filter==="all"?"active":""}`} aria-pressed={!community&&filter==="all"} onClick={()=>{setCommunity("");setFilter("all");}}><Globe aria-hidden="true"/>{c("allCampus")}</button>
    <button type="button" className={`u-forum-chip ${!community&&filter==="groups"?"active":""}`} aria-pressed={!community&&filter==="groups"} onClick={()=>{setCommunity("");setFilter("groups");}}><Users aria-hidden="true"/>{c("following")}</button>
    {communities.map(g=><button key={g.id} type="button" className={`u-forum-chip ${community===g.id?"active":""}`} aria-pressed={community===g.id} onClick={()=>pickCommunity(g.id)}>{categoryIcon(g.category)}{g.name}<span>{data.posts.filter(p=>p.group_id===g.id).length}</span></button>)}
    <button type="button" className="u-forum-chip u-forum-chip-new" onClick={()=>go("groups")}><Plus aria-hidden="true"/>{c("createGroup")}</button>
   </div>
   <div className="u-forum-filters">
    <Chips label={c("topics")} value={topic} onChange={setTopic} options={[{value:"all",label:c("all")},{value:"study",label:c("study")},{value:"leisure",label:c("leisure")},{value:"projects",label:c("projects")},{value:"question",label:c("questions")}]}/>
    <Chips label={c("sortBy")} value={sort} onChange={setSort} options={[{value:"new",label:c("sortNew")},{value:"top",label:c("sortTop")},{value:"talked",label:c("sortTalked")}]}/>
    <p className="u-forum-count">{posts.length} {c(posts.length===1?"forumResult":"forumResults")}</p>
   </div>
  </div>}
  {forum&&selected&&<CommunityHeader group={selected} onClear={()=>setCommunity("")}/>}
  {!forum&&<div className="u-section-heading"><h2>{group?group.name:home?c("forumSection"):c("wall")}</h2>{!group&&<Chips label={home?c("forumSection"):c("wall")} options={[{value:"all",label:c("all")},{value:"groups",label:c("following")}]} value={filter} onChange={setFilter}/>}</div>}
  {posts.length?posts.map(p=><PostCard key={p.id} post={p} onCommunity={forum?pickCommunity:undefined}/>):<Empty title={selected?c("noCommunityPosts"):forum&&(topic!=="all"||filter==="groups")?c("noTopicPosts"):c("noPosts")} body={selected?c("noCommunityPostsBody"):forum&&(topic!=="all"||filter==="groups")?c("noTopicPostsBody"):c("noPostsBody")}/>}
 </div>;
}

/* The header of the community you are standing in: what it is, who is in it,
   and the way back out to the whole campus. */
function CommunityHeader({group,onClear}:{group:Group;onClear:()=>void}){
 const {c,locale,data,me,repo,run,busy}=useCommunity();
 const members=data.groupMembers.filter(m=>m.group_id===group.id),joined=members.some(m=>m.user_id===me.user_id),own=group.creator_id===me.user_id;const [shareNotice,setShareNotice]=useState("");
 const threads=data.posts.filter(p=>p.group_id===group.id).length;
 return <section className="u-card u-forum-community" aria-label={group.name}>
  <span className={`u-group-icon u-group-icon-${group.category}`}>{categoryIcon(group.category)}</span>
  <div className="u-forum-community-copy">
   <p className="u-eyebrow">{c(group.category as "study"|"leisure"|"projects")} · {localName(group.campus,locale)} {group.is_private&&<span className="u-group-private-label"><LockKeyhole aria-hidden="true"/>{c("privateGroup")}</span>}</p>
   <h2>{group.name}</h2>
   <p>{group.description}</p>
   <div className="u-forum-community-meta"><span><Users aria-hidden="true"/>{members.length} {c("members")}</span><span><MessageCircle aria-hidden="true"/>{threads} {c(threads===1?"forumResult":"forumResults")}</span>{!joined&&<span className="u-forum-community-note">{c("joinToPost")}</span>}{shareNotice&&<span role="status">{shareNotice}</span>}</div>
  </div>
  <div className="u-forum-community-actions">
   <div className="u-forum-community-button-row"><Action secondary={joined} disabled={busy||own} onClick={()=>void run(()=>repo.joinGroup(group.id,!joined,group.share_token),"")}>{own?c("member"):joined?c("leaveGroup"):c("joinGroup")}</Action><IconAction label={c("shareGroup")} onClick={()=>void shareGroup(group,c,setShareNotice)}><Share2/></IconAction></div>
   <button type="button" className="u-text-link" onClick={onClear}><Globe aria-hidden="true"/>{c("allCampus")}</button>
  </div>
 </section>;
}
export function Composer({groupId}:{groupId:string|null}){const {me,data,c,repo,run,busy}=useCommunity();const requestId=useRef<string|null>(null);const [body,setBody]=useState(""),[kind,setKind]=useState<Post["kind"]>("post"),[audience,setAudience]=useState(groupId??"");const groups=data.groups.filter(g=>data.groupMembers.some(m=>m.group_id===g.id&&m.user_id===me.user_id));if(groupId&&!groups.some(g=>g.id===groupId))return <p className="u-info">{c("groupOnly")}</p>;const selected=groupId??audience;return <form className="u-card u-composer" onSubmit={async e=>{e.preventDefault();const action=requestId.current??=crypto.randomUUID();if(await run(()=>repo.publish(body,kind,selected||null,action),c("posted"))){setBody(current=>current===body?"":current);requestId.current=null;}}}><div className="u-composer-body"><Avatar person={me}/><label className="u-composer-label"><span className="sr-only">{c("composer")}</span><textarea value={body} onChange={e=>{setBody(e.target.value);requestId.current=null;}} placeholder={c("composer")} maxLength={2000} required rows={2}/></label></div><div className="u-composer-footer"><div><Chips label={c("post")} options={[{value:"post",label:c("post")},{value:"question",label:c("question")}]} value={kind} onChange={v=>{setKind(v as Post["kind"]);requestId.current=null;}}/>{!groupId&&<SelectField label={c("audience")} value={audience} onChange={e=>{setAudience(e.target.value);requestId.current=null;}}><option value="">{c("audience")}</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</SelectField>}</div><Action type="submit" disabled={busy||!body.trim()||data.wallet.balance<COIN_RULES.createThread}><Plus/>{c("publish")}<CoinAmount amount={-COIN_RULES.createThread}/></Action></div><SpendNotice amount={COIN_RULES.createThread}/></form>;}
/* A like says "seen". A signal says what you will do about it, and it carries a
   face: who is coming, who has the same doubt, who can help. The author cannot
   signal their own thread, but is the one who gets to turn it into a plan. */
function ThreadSignals({post}:{post:Post}){
 const {c,data,me,repo,run,busy,go,view}=useCommunity();
 const own=post.author_id===me.user_id,kinds:SignalKind[]=post.kind==="question"?["same","help"]:["in"];
 const labels={in:c("signalIn"),same:c("signalSame"),help:c("signalHelp")},icons={in:<Hand aria-hidden="true"/>,same:<UsersRound aria-hidden="true"/>,help:<LifeBuoy aria-hidden="true"/>};
 /* You come first in the list: the point is seeing yourself among the others. */
 const rows=(kind:SignalKind)=>data.signals.filter(s=>s.post_id===post.id&&s.kind===kind).sort((a,b)=>Number(b.user_id===me.user_id)-Number(a.user_id===me.user_id));
 const names=(ids:string[])=>{const list=ids.map(id=>id===me.user_id?c("signalYou"):data.profiles.find(p=>p.user_id===id)?.name.split(" ")[0]??c("student"));return list.length<=2?list.join(` ${c("signalAnd")} `):`${list.slice(0,2).join(", ")} ${c("signalAnd")} ${list.length-2} ${c("signalMore")}`;};
 /* Talking it over in private happens right here, under the thread. Sending you
    off to another screen to write one line is what made this feel like nothing. */
 const author=data.profiles.find(p=>p.user_id===post.author_id),first=author?.name.split(" ")[0]??c("student");
 const [talking,setTalking]=useState(false),[text,setText]=useState(""),[sentTo,setSentTo]=useState("");
 const quoted=()=>{const line=post.body.split("\n")[0];return `${c("talkAbout")}: «${line.length>70?`${line.slice(0,68).trimEnd()}…`:line}»\n${text.trim()}`;};
 const send=async()=>{let id="";if(await run(async()=>{id=await repo.openThread(post.author_id);await repo.sendMessage(id,quoted());},"")){setSentTo(id);setText("");}};
 const coming=rows("in").length;
 if(own&&!kinds.some(kind=>rows(kind).length))return null;
 return <div className="u-signals" role="group" aria-label={c("signalsLabel")}>
  {kinds.map(kind=>{const ids=rows(kind).map(s=>s.user_id),on=ids.includes(me.user_id);if(own&&!ids.length)return null;return <div className="u-signal" data-signal={kind} key={kind}>
   {own?<span className="u-signal-static">{icons[kind]}{labels[kind]}</span>:<button type="button" className={on?"active":""} aria-pressed={on} disabled={busy} onClick={()=>void run(()=>repo.signal(post.id,kind,!on),"")}>{icons[kind]}{labels[kind]}</button>}
   {ids.length>0&&<span className="u-signal-who"><span className="u-avatar-stack">{ids.slice(0,4).map(id=><Avatar key={id} size="small" person={data.profiles.find(p=>p.user_id===id)}/>)}</span>{names(ids)}</span>}
  </div>;})}
  {!own&&<button type="button" className={`u-signal-talk ${talking?"active":""}`} aria-expanded={talking} aria-controls={`entre-dos-${post.id}`} onClick={()=>{setTalking(v=>!v);setSentTo("");}}><MessageCircle aria-hidden="true"/>{c("talkBetweenTwo")}</button>}
  {own&&coming>=2&&<button type="button" className="u-signal-talk" onClick={()=>go("plans")}>{c("makeItAPlan")}<ArrowUpRight aria-hidden="true"/></button>}
  {talking&&!own&&<div className="u-signal-whisper" id={`entre-dos-${post.id}`}>
   {sentTo?<p className="u-signal-sent" role="status"><Avatar size="small" person={author}/><span><strong>{c("talkSent")} {first}.</strong> {c("talkSentHelp")}</span><button type="button" onClick={()=>go("messages",{threadId:sentTo,stay:view==="messages"})}>{c("openConversation")}<ArrowUpRight aria-hidden="true"/></button></p>
   :<form onSubmit={e=>{e.preventDefault();void send();}}>
     <p><LockKeyhole aria-hidden="true"/>{c("talkOnly")} {first}. {c("talkQuoted")}</p>
     <div><Avatar size="small" person={me}/><label className="sr-only" htmlFor={`whisper-${post.id}`}>{c("talkTo")} {first}</label><Input autoFocus className="u-input" id={`whisper-${post.id}`} value={text} onChange={e=>setText(e.target.value)} placeholder={`${c("talkTo")} ${first}…`} maxLength={600} required autoComplete="off"/><button type="submit" disabled={busy||!text.trim()} aria-label={c("send")}><Send aria-hidden="true"/></button></div>
    </form>}
  </div>}
 </div>;
}

/* `onCommunity` keeps the badge inside the forum: it filters the board instead of
   throwing you out to the group's own screen. Without it the badge navigates. */
export function PostCard({post,onCommunity}:{post:Post;onCommunity?:(id:string)=>void}){
 const {c,data,me,locale,repo,run,busy,go}=useCommunity();
 const [open,setOpen]=useState(false),[body,setBody]=useState(""),[disliked,setDisliked]=useState(false);
 const likes=data.likes.filter(l=>l.post_id===post.id),liked=likes.some(l=>l.user_id===me.user_id),comments=data.comments.filter(x=>x.post_id===post.id),group=data.groups.find(g=>g.id===post.group_id);
 const toggleDislike=async()=>{if(!disliked&&liked)await run(()=>repo.like(post.id,false),"");setDisliked(value=>!value);};
 const toggleLike=async()=>{if(disliked)setDisliked(false);await run(()=>repo.like(post.id,!liked),"");};
 return <article className="u-card u-post" data-kind={post.kind} id={`hilo-${post.id}`} tabIndex={-1}><header><Person id={post.author_id} detail={<>{data.profiles.find(p=>p.user_id===post.author_id)?.campus} <span aria-hidden="true">·</span> <time dateTime={post.created_at}>{relativeDate(post.created_at,locale)}</time></>}/>{post.author_id===me.user_id&&<Confirm title={c("deletePost")} description={`${c("deleteHelp")} ${unicoinCopy(locale)("noRefund")}`} onConfirm={()=>run(()=>repo.removePost(post.id),c("removed"))}><IconAction label={c("delete")}><Trash2/></IconAction></Confirm>}</header>{group&&<button className="u-group-tag" onClick={()=>onCommunity?onCommunity(group.id):go("home",{groupId:group.id})}>{group.name}{!onCommunity&&<ArrowUpRight aria-hidden="true"/>}</button>}{post.kind==="question"&&<span className="u-question"><HelpCircle aria-hidden="true"/>{c("question")}</span>}<p className="u-post-body">{post.body}</p>{post.image_url&&<Image className="u-post-image" src={post.image_url} width={920} height={480} alt={c("exampleImage")}/>}<ThreadSignals post={post}/><div className="u-post-actions"><button type="button" disabled={busy} className={liked?"liked":""} aria-pressed={liked} onClick={()=>void toggleLike()}><Heart fill={liked?"currentColor":"none"} aria-hidden="true"/>{liked?c("liked"):c("like")}<span>{likes.length}</span></button><button type="button" disabled={busy} className={disliked?"disliked":""} aria-pressed={disliked} onClick={()=>void toggleDislike()}><ThumbsDown aria-hidden="true"/>{c("dislike")}</button><button type="button" aria-expanded={open} aria-controls={`comments-${post.id}`} onClick={()=>setOpen(!open)}><MessageCircle aria-hidden="true"/>{c("comment")}<span>{comments.length}</span></button></div>{open&&<section className="u-comments" id={`comments-${post.id}`} aria-label={c("comments")}>{comments.map(comment=><div className="u-comment" key={comment.id}><Avatar size="small" person={data.profiles.find(p=>p.user_id===comment.author_id)}/><div><strong>{data.profiles.find(p=>p.user_id===comment.author_id)?.name??c("student")}</strong><p>{comment.body}</p></div></div>)}<RewardHint kind="thread" resourceId={post.id} own={post.author_id===me.user_id} participated={comments.some(comment=>comment.author_id===me.user_id)}/><form onSubmit={async e=>{e.preventDefault();if(await run(()=>repo.comment(post.id,body),""))setBody(current=>current===body?"":current);}}><label className="sr-only" htmlFor={`comment-${post.id}`}>{c("comment")}</label><Input className="u-input" id={`comment-${post.id}`} value={body} onChange={e=>setBody(e.target.value)} placeholder={c("commentPlaceholder")} maxLength={600} required/><IconAction label={c("send")} disabled={busy||!body.trim()} type="submit"><Send/></IconAction></form></section>}</article>;
}

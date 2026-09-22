import type { CoinWallet } from "./unicoins";
import { getAuthClient } from "../auth/client";
import { emptyCommunity, type CommunityRepository, type Profile, type Post, type Comment, type Like, type Signal, type Plan, type PlanMember, type Group, type GroupMember, type Note, type Thread, type Message, type ShowcaseItem } from "./types";
import { requireText, showcaseMedia, validateChatMedia, validateGroup, validatePdf, validatePlan, validateProfile, validateShowcase } from "./validation";
import { isStoredPiece, showcaseFrames } from "./showcase";
import { faceLimits, isStoredFace, type FaceKind } from "./images";

export function createCommunityRepository(userId: string): CommunityRepository {
 const signedMedia=new Map<string,{url:string;until:number}>();
 const client = getAuthClient();
 function check<T>(result: {data: T; error: unknown}) { if(result.error) throw result.error; return result.data; }
 async function createOnce(table:string, row:Record<string,unknown>, ownerColumn:string) {
  const result=await client.from(table).insert(row);
  if(!result.error)return;
  if(result.error.code==="23505") {
   const existing=check(await client.from(table).select("*").eq("id",row.id).eq(ownerColumn,userId).maybeSingle());
   if(existing&&Object.entries(row).every(([key,value])=>key==="starts_at"?new Date(existing[key]).getTime()===new Date(String(value)).getTime():existing[key]===value))return;
   throw {message:"UNICOINS_REQUEST_USED"};
  }
  throw result.error;
 }
 // The shelf columns ship in a separate migration. Until it is applied the rows
 // come back without them, so they are stripped from the upsert: the rest of the
 // profile keeps saving instead of failing with PGRST204.
 let tasteColumns=false;
 const withTastes=(rows:Profile[])=>rows.map(row=>({...row,favorites:Array.isArray(row.favorites)?row.favorites:[],picks:Array.isArray(row.picks)?row.picks:[]}));
 // Faces live in a private bucket: one batch of signed links per read, so a photo
 // is only ever visible to a verified member. A storage hiccup costs the picture,
 // never the page.
 let faceColumns=false;
 // The showcase ships in its own migration. Until it is applied the profile has
 // no frame column and the table is missing: the page loads without a window,
 // and the buttons that would write to it say so instead of failing.
 let showcaseColumns=false;
 // A piece behind a file is signed per read, like a face, and only for rows
 // the database already let this member see.
 const signPieces=async(rows:ShowcaseItem[])=>{
  const paths=[...new Set(rows.map(row=>row.media_path).filter(isStoredPiece) as string[])];
  if(!paths.length)return rows;
  try{
   const signed=await client.storage.from("universe-showcase").createSignedUrls(paths,3600);
   if(signed.error)return rows;
   const links=new Map((signed.data??[]).filter(item=>item.signedUrl&&item.path).map(item=>[item.path as string,item.signedUrl as string]));
   return rows.map(row=>isStoredPiece(row.media_path)?{...row,media_url:links.get(row.media_path as string)}:row);
  }catch{return rows;}
 };
 const signFaces=async(rows:Profile[])=>{
  const paths=[...new Set(rows.flatMap(row=>[row.avatar_url,row.banner_url]).filter(isStoredFace) as string[])];
  if(!paths.length)return rows;
  try{
   const signed=await client.storage.from("universe-faces").createSignedUrls(paths,3600);
   if(signed.error)return rows;
   const links=new Map((signed.data??[]).filter(item=>item.signedUrl&&item.path).map(item=>[item.path as string,item.signedUrl as string]));
   return rows.map(row=>({...row,
    avatar_url:isStoredFace(row.avatar_url)?links.get(row.avatar_url as string):row.avatar_url,
    banner_url:isStoredFace(row.banner_url)?links.get(row.banner_url as string):row.banner_url}));
  }catch{return rows;}
 };
 return {
  async read(sharedGroupToken?: string) {
   const results=await Promise.all([
    client.from("universe_profiles").select("*").order("created_at",{ascending:false}).limit(200),
    client.from("universe_posts").select("*").order("created_at",{ascending:false}).limit(80),
    client.from("universe_groups").select("*").order("created_at",{ascending:false}).limit(100),
    client.from("universe_plans").select("*").gte("starts_at",new Date(Date.now()-86400000).toISOString()).order("starts_at").limit(100),
    client.from("universe_notes").select("*").order("created_at",{ascending:false}).limit(100),
    client.from("universe_threads").select("*").order("created_at",{ascending:false}).limit(100),
    client.rpc("universe_coin_wallet"),
   ]);
   results.forEach(check);
   const data=emptyCommunity();
   const wallet=results[6].data as CoinWallet|null;
   if(!wallet||!Number.isInteger(wallet.balance)||wallet.balance<0||!Array.isArray(wallet.transactions))throw {code:"not_configured"};
   data.wallet=wallet;
   const profileRows=results[0].data as Profile[];if(profileRows.length){tasteColumns=Object.hasOwn(profileRows[0],"favorites");faceColumns=Object.hasOwn(profileRows[0],"banner_url");showcaseColumns=Object.hasOwn(profileRows[0],"showcase_frame");}data.profiles=await signFaces(withTastes(profileRows));data.posts=results[1].data as Post[];data.groups=results[2].data as Group[];data.plans=results[3].data as Plan[];data.notes=results[4].data as Note[];data.threads=results[5].data as Thread[];
   if(sharedGroupToken){
    const shared=check(await client.rpc("universe_shared_group",{share_uuid:sharedGroupToken}));
    const group=(Array.isArray(shared)?shared[0]:shared) as Group|undefined;
    if(group&&!data.groups.some(item=>item.id===group.id))data.groups.push(group);
   }
   // Page relations below the API row limit, so counts and capacity indicators
   // remain accurate for the loaded feed, groups and plans.
   async function related<T>(table:string,column:string,ids:string[],order:string,second:string) {
    const rows:T[]=[];if(!ids.length)return rows;
    for(let offset=0;;offset+=500){const result=await client.from(table).select("*").in(column,ids).order(order).order(second).range(offset,offset+499);const page=check(result) as T[];rows.push(...page);if(page.length<500)break;}
    return rows;
   }
   const [groupMembers,planMembers,comments,likes]=await Promise.all([
    related<GroupMember>("universe_group_members","group_id",data.groups.map(g=>g.id),"group_id","user_id"),
    related<PlanMember>("universe_plan_members","plan_id",data.plans.map(p=>p.id),"plan_id","user_id"),
    related<Comment>("universe_comments","post_id",data.posts.map(p=>p.id),"created_at","id"),
    related<Like>("universe_likes","post_id",data.posts.map(p=>p.id),"post_id","user_id"),
   ]);
   data.groupMembers=groupMembers;data.planMembers=planMembers;data.comments=comments;data.likes=likes;
   // Signals arrive with their own migration. Until it is applied the forum still loads, just without them.
   data.signals=await related<Signal>("universe_post_signals","post_id",data.posts.map(p=>p.id),"post_id","user_id").catch(()=>[]);
   // Same for the showcase: the rows that come back are exactly the ones this member may see.
   data.showcase=showcaseColumns?await (async()=>{try{const rows=check(await client.from("universe_showcase").select("*").order("position").order("created_at",{ascending:false}).limit(400));return await signPieces((rows??[]) as ShowcaseItem[]);}catch{return [];}})():[];
   const referenced=new Set([userId,...data.posts.map(p=>p.author_id),...data.comments.map(p=>p.author_id),...data.plans.map(p=>p.creator_id),...planMembers.map(p=>p.user_id),...groupMembers.map(p=>p.user_id),...data.notes.map(n=>n.author_id),...data.threads.flatMap(t=>[t.user_a,t.user_b])]);
   data.profiles.forEach(p=>referenced.delete(p.user_id));const missing=[...referenced];
   for(let i=0;i<missing.length;i+=200){const result=check(await client.from("universe_profiles").select("*").in("user_id",missing.slice(i,i+200)));data.profiles.push(...await signFaces(withTastes(result as Profile[])));}
   return data;
  },
  async saveFace(kind:FaceKind,image:Blob|null) {
   if(!faceColumns)throw {code:"faces_missing"};
   const column=kind==="avatar"?"avatar_url":"banner_url";
   const current=check(await client.from("universe_profiles").select(column).eq("user_id",userId).single()) as Record<string,string|null>;
   const previous=current?.[column]??null;
   let path:string|null=null;
   if(image){
    if(image.size>faceLimits.output||image.type!=="image/webp")throw {code:"invalid_image"};
    path=`${userId}/${kind}-${Date.now()}.webp`;
    check(await client.storage.from("universe-faces").upload(path,image,{contentType:"image/webp",upsert:true}));
   }
   const saved=await client.from("universe_profiles").update({[column]:path}).eq("user_id",userId).select().single();
   if(saved.error){ if(path)await client.storage.from("universe-faces").remove([path]); throw saved.error; }
   // The old picture is unreferenced now; losing this cleanup is not worth failing the save.
   if(previous&&isStoredFace(previous)&&previous!==path)try{await client.storage.from("universe-faces").remove([previous]);}catch{/* orphan left behind */}
   const [row]=await signFaces(withTastes([saved.data as Profile]));
   return row;
  },
  async saveProfile(input) { validateProfile(input); const payload:Record<string,unknown>={...input}; if(!tasteColumns){delete payload.favorites;delete payload.picks;} return withTastes([check(await client.from("universe_profiles").upsert({...payload,user_id:userId},{onConflict:"user_id"}).select().single()) as Profile])[0]; },
  async publish(body,kind,groupId,requestId) { requireText(body,1,2000); await createOnce("universe_posts",{id:requestId??crypto.randomUUID(),author_id:userId,body:body.trim(),kind,group_id:groupId},"author_id"); },
  async removePost(id) { check(await client.from("universe_posts").delete().eq("id",id).eq("author_id",userId)); },
  async signal(postId,kind,on) { if(on) check(await client.from("universe_post_signals").upsert({post_id:postId,user_id:userId,kind},{onConflict:"post_id,user_id,kind",ignoreDuplicates:true})); else check(await client.from("universe_post_signals").delete().eq("post_id",postId).eq("user_id",userId).eq("kind",kind)); },
  async like(postId,on) { if(on) check(await client.from("universe_likes").upsert({post_id:postId,user_id:userId},{onConflict:"post_id,user_id",ignoreDuplicates:true})); else check(await client.from("universe_likes").delete().eq("post_id",postId).eq("user_id",userId)); },
  async comment(postId,body) { requireText(body,1,600); check(await client.from("universe_comments").insert({post_id:postId,author_id:userId,body:body.trim()})); },
  async createPlan(input,requestId) { validatePlan(input); await createOnce("universe_plans",{...input,id:requestId??crypto.randomUUID(),creator_id:userId},"creator_id"); },
  async joinPlan(id,join) { check(await client.rpc("universe_set_plan_attendance",{plan_uuid:id,attending:join})); },
  async removePlan(id) { check(await client.from("universe_plans").delete().eq("id",id).eq("creator_id",userId)); },
  async createGroup(input) { validateGroup(input); check(await client.from("universe_groups").insert({...input,creator_id:userId})); },
  async joinGroup(id,join,shareToken) { check(await client.rpc("universe_set_group_membership",{group_uuid:id,attending:join,share_uuid:shareToken??null})); },
  async uploadNote(input,file) {
   requireText(input.title,3,100);requireText(input.subject,2,100);requireText(input.description,0,600);await validatePdf(file);
   const path=userId+"/"+crypto.randomUUID()+".pdf";
   check(await client.storage.from("universe-notes").upload(path,file,{contentType:"application/pdf",upsert:false}));
   const result=await client.from("universe_notes").insert({...input,author_id:userId,file_name:file.name.replace(/[\\/\u0000]/g,"-").slice(0,-4).slice(0,116)+".pdf",file_path:path,file_size:file.size});
   if(result.error) { await client.storage.from("universe-notes").remove([path]);throw result.error; }
  },
  async downloadNote(note) { const result=check(await client.storage.from("universe-notes").createSignedUrl(note.file_path,60,{download:note.file_name}));if(!result?.signedUrl)throw {code:"invalid_file"};return result.signedUrl; },
  async removeNote(note) {
   if(note.author_id!==userId) throw {code:"validation"};
   // Storage API removes the actual object. Retain metadata on a storage failure
   // so the author can retry. Repeating remove is safe if the object is gone.
   check(await client.storage.from("universe-notes").remove([note.file_path]));
   const result=await client.from("universe_notes").delete().eq("id",note.id).eq("author_id",userId);
   if(result.error) throw {code:"note_cleanup"};
  },
  async openThread(peerId) { return check(await client.rpc("universe_open_thread",{peer_uuid:peerId})) as string; },
  async messages(threadId) {
   const rows=(check(await client.from("universe_messages").select("*").eq("thread_id",threadId).order("created_at",{ascending:false}).order("id",{ascending:false}).limit(100))??[]).reverse() as Message[];
   // The chat polls. Signing once and reusing the link keeps photos from reloading on every poll.
   const stale=rows.flatMap(m=>m.media_path&&!((signedMedia.get(m.media_path)?.until??0)>Date.now())?[m.media_path]:[]);
   if(stale.length){const result=await client.storage.from("universe-chat").createSignedUrls(stale,3600);result.data?.forEach(item=>{if(item.path&&item.signedUrl)signedMedia.set(item.path,{url:item.signedUrl,until:Date.now()+3000000});});}
   return rows.map(m=>m.media_path?{...m,media_url:signedMedia.get(m.media_path)?.url}:m);
  },
  async sendMessage(threadId,body,file) {
   if(!file){requireText(body,1,2000);check(await client.from("universe_messages").insert({thread_id:threadId,sender_id:userId,body:body.trim()}));return;}
   const media=validateChatMedia(file);requireText(body,0,2000);
   const path=`${threadId}/${userId}/${crypto.randomUUID()}.${media.ext}`;
   check(await client.storage.from("universe-chat").upload(path,file,{contentType:file.type,upsert:false}));
   const result=await client.from("universe_messages").insert({thread_id:threadId,sender_id:userId,body:body.trim(),media_path:path,media_kind:media.kind});
   if(result.error){await client.storage.from("universe-chat").remove([path]);throw result.error;}
  },
  async saveShowcaseFrame(frame) {
   if(!showcaseColumns)throw {code:"showcase_missing"};
   if(!showcaseFrames.includes(frame))throw {code:"validation"};
   const saved=check(await client.from("universe_profiles").update({showcase_frame:frame}).eq("user_id",userId).select().single()) as Profile;
   return (await signFaces(withTastes([saved])))[0];
  },
  async addShowcaseItem(input,file) {
   if(!showcaseColumns)throw {code:"showcase_missing"};
   validateShowcase(input);
   const needsFile=input.kind==="story"||input.kind==="media"||input.kind==="file";
   if(needsFile!==!!file)throw {code:"validation"};
   let media_path:string|null=null, media_kind:ShowcaseItem["media_kind"]=null;
   if(file){
    const media=await showcaseMedia(input.kind,file);
    media_path=`${userId}/${crypto.randomUUID()}.${media.ext}`; media_kind=media.kind;
    check(await client.storage.from("universe-showcase").upload(media_path,file,{contentType:file.type||"application/pdf",upsert:false}));
   }
   const row={owner_id:userId,kind:input.kind,title:input.title.trim(),body:input.body.trim(),url:input.kind==="link"?input.url:null,media_path,media_kind,audience:input.audience,viewers:input.audience==="chosen"?input.viewers:[]};
   const result=await client.from("universe_showcase").insert(row).select().single();
   if(result.error){ if(media_path)await client.storage.from("universe-showcase").remove([media_path]).catch(()=>{}); throw result.error; }
   return (await signPieces([result.data as ShowcaseItem]))[0];
  },
  async updateShowcaseItem(id,patch) {
   const current=check(await client.from("universe_showcase").select("*").eq("id",id).eq("owner_id",userId).single()) as ShowcaseItem;
   const next={...current,...patch};
   validateShowcase({kind:next.kind,title:next.title,body:next.body,url:next.url??undefined,audience:next.audience,viewers:next.viewers});
   const saved=check(await client.from("universe_showcase").update({title:next.title.trim(),body:next.body.trim(),audience:next.audience,viewers:next.audience==="chosen"?next.viewers:[],position:next.position}).eq("id",id).eq("owner_id",userId).select().single()) as ShowcaseItem;
   return (await signPieces([saved]))[0];
  },
  async removeShowcaseItem(item) {
   if(item.owner_id!==userId)throw {code:"validation"};
   // The bytes go first, as with the notes: a retry after a storage hiccup is
   // harmless, a row without its file is not.
   if(isStoredPiece(item.media_path))check(await client.storage.from("universe-showcase").remove([item.media_path as string]));
   const result=await client.from("universe_showcase").delete().eq("id",item.id).eq("owner_id",userId);
   if(result.error)throw {code:"note_cleanup"};
  },
  async openShowcaseFile(item) {
   if(!isStoredPiece(item.media_path))throw {code:"invalid_file"};
   const name=(item.title.trim()||"archivo").replace(/[\\/\u0000]/g,"-").slice(0,116)+(item.media_kind==="pdf"?".pdf":"");
   const result=check(await client.storage.from("universe-showcase").createSignedUrl(item.media_path as string,60,item.media_kind==="pdf"?{download:name}:undefined));
   if(!result?.signedUrl)throw {code:"invalid_file"};
   return result.signedUrl;
  },
  dispose() {},
 };
}

import type { CoinWallet } from "./unicoins";
import { getAuthClient } from "../auth/client";
import { emptyCommunity, type CommunityRepository, type Profile, type Post, type Comment, type Like, type Plan, type PlanMember, type Group, type GroupMember, type Note, type Thread, type Message } from "./types";
import { requireText, validateGroup, validatePdf, validatePlan, validateProfile } from "./validation";

export function createCommunityRepository(userId: string): CommunityRepository {
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
 return {
  async read() {
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
   data.profiles=results[0].data as Profile[];data.posts=results[1].data as Post[];data.groups=results[2].data as Group[];data.plans=results[3].data as Plan[];data.notes=results[4].data as Note[];data.threads=results[5].data as Thread[];
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
   const referenced=new Set([userId,...data.posts.map(p=>p.author_id),...data.comments.map(p=>p.author_id),...data.plans.map(p=>p.creator_id),...planMembers.map(p=>p.user_id),...groupMembers.map(p=>p.user_id),...data.notes.map(n=>n.author_id),...data.threads.flatMap(t=>[t.user_a,t.user_b])]);
   data.profiles.forEach(p=>referenced.delete(p.user_id));const missing=[...referenced];
   for(let i=0;i<missing.length;i+=200){const result=check(await client.from("universe_profiles").select("*").in("user_id",missing.slice(i,i+200)));data.profiles.push(...result as Profile[]);}
   return data;
  },
  async saveProfile(input) { validateProfile(input); return check(await client.from("universe_profiles").upsert({...input,user_id:userId},{onConflict:"user_id"}).select().single()) as Profile; },
  async publish(body,kind,groupId,requestId) { requireText(body,1,2000); await createOnce("universe_posts",{id:requestId??crypto.randomUUID(),author_id:userId,body:body.trim(),kind,group_id:groupId},"author_id"); },
  async removePost(id) { check(await client.from("universe_posts").delete().eq("id",id).eq("author_id",userId)); },
  async like(postId,on) { if(on) check(await client.from("universe_likes").upsert({post_id:postId,user_id:userId},{onConflict:"post_id,user_id",ignoreDuplicates:true})); else check(await client.from("universe_likes").delete().eq("post_id",postId).eq("user_id",userId)); },
  async comment(postId,body) { requireText(body,1,600); check(await client.from("universe_comments").insert({post_id:postId,author_id:userId,body:body.trim()})); },
  async createPlan(input,requestId) { validatePlan(input); await createOnce("universe_plans",{...input,id:requestId??crypto.randomUUID(),creator_id:userId},"creator_id"); },
  async joinPlan(id,join) { check(await client.rpc("universe_set_plan_attendance",{plan_uuid:id,attending:join})); },
  async removePlan(id) { check(await client.from("universe_plans").delete().eq("id",id).eq("creator_id",userId)); },
  async createGroup(input) { validateGroup(input); check(await client.from("universe_groups").insert({...input,creator_id:userId})); },
  async joinGroup(id,join) { if(join) check(await client.from("universe_group_members").upsert({group_id:id,user_id:userId},{onConflict:"group_id,user_id",ignoreDuplicates:true})); else check(await client.from("universe_group_members").delete().eq("group_id",id).eq("user_id",userId)); },
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
  async messages(threadId) { return (check(await client.from("universe_messages").select("*").eq("thread_id",threadId).order("created_at",{ascending:false}).order("id",{ascending:false}).limit(100))??[]).reverse() as Message[]; },
  async sendMessage(threadId,body) { requireText(body,1,2000); check(await client.from("universe_messages").insert({thread_id:threadId,sender_id:userId,body:body.trim()})); },
  dispose() {},
 };
}

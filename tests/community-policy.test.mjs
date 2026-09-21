import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db=new PGlite();
await db.exec(`
 create role anon; create role authenticated; create role supabase_auth_admin;
 create schema auth; create schema storage;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,storage to authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,unique(bucket_id,name));
 alter table storage.objects enable row level security;
 grant select,insert,delete on storage.objects to authenticated;
 -- Supabase's initial defaults can be permissive; migrations must narrow them.
 alter default privileges in schema public grant all on tables to authenticated;
`);
for(const name of ['202609090001_university_auth','202609090002_valencia_launch','202609090003_community','202609090004_community_storage','202609200010_group_privacy'])await db.exec(await readFile(new URL('../supabase/migrations/'+name+'.sql',import.meta.url),'utf8'));
await db.exec("insert into public.universe_university_domains values('campus.example.test','Campus verificado',true,'valencia')");
const ids=[1,2,3,4].map(n=>'00000000-0000-4000-8000-00000000000'+n);
for(let i=0;i<4;i++)await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,$3)',[ids[i],`user${i}@campus.example.test`,i===3?null:new Date().toISOString()]);
async function asUser(i,run){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[i]]);await db.exec('set role authenticated');try{return await run();}finally{await db.exec('reset role');}}
const q=(sql,args=[])=>db.query(sql,args);
for(let i=0;i<3;i++)await asUser(i,()=>q("insert into public.universe_profiles(user_id,name,university,campus,degree,year) values($1,$2,'Forged institution','Tarongers','Economía',2)",[ids[i],`Persona ${i}`]));
after(()=>db.close());

test('Only a confirmed Valencia member reads the community; profile authority is server derived',async()=>{
 const p=await asUser(0,()=>q('select university from public.universe_profiles where user_id=$1',[ids[0]]));assert.equal(p.rows[0].university,'Campus verificado');
 await asUser(0,()=>assert.rejects(q("update public.universe_profiles set university='Forged' where user_id=$1",[ids[0]]),/permission denied/i));
 await asUser(3,async()=>{assert.equal((await q('select * from public.universe_profiles')).rows.length,0);await assert.rejects(q("insert into public.universe_profiles(user_id,name,campus,degree,year) values($1,'False member','Tarongers','Economía',2)",[ids[3]]),/UNIVERSE_UNIVERSITY_REQUIRED|row-level security/);});
 await asUser(0,async()=>{const other=await q("update public.universe_profiles set name='Changed' where user_id=$1 returning *",[ids[1]]);assert.equal(other.rows.length,0);});
 await db.exec('set role anon');try{await assert.rejects(q('select * from public.universe_posts'),/permission denied/);}finally{await db.exec('reset role');}
});
let post,group,plan,thread;
test('The feed rejects impersonation and cross-user deletion; deleting a post cascades',async()=>{
 await asUser(0,async()=>{await assert.rejects(q("insert into public.universe_posts(author_id,body,kind) values($1,'Forged','post')",[ids[1]]),/row-level security/);post=(await q("insert into public.universe_posts(author_id,body,kind) values($1,'Hola campus','post') returning id",[ids[0]])).rows[0].id;});
 await asUser(1,async()=>{assert.equal((await q('delete from public.universe_posts where id=$1 returning *',[post])).rows.length,0);await q("insert into public.universe_comments(post_id,author_id,body) values($1,$2,'Hola')",[post,ids[1]]);await q('insert into public.universe_likes values($1,$2)',[post,ids[1]]);});
 await asUser(0,()=>q('delete from public.universe_posts where id=$1',[post]));assert.equal((await q('select * from public.universe_comments')).rows.length,0);assert.equal((await q('select * from public.universe_likes')).rows.length,0);
});
test('Group posting requires membership and the creator stays enrolled',async()=>{
 group=(await asUser(0,()=>q("insert into public.universe_groups(creator_id,name,description,category,campus) values($1,'Grupo de estudio','Descripción suficiente','study','Tarongers') returning id",[ids[0]]))).rows[0].id;
 await asUser(1,async()=>{await assert.rejects(q("insert into public.universe_posts(author_id,body,kind,group_id) values($1,'Hola grupo','post',$2)",[ids[1],group]),/row-level security/);await q('insert into public.universe_group_members values($1,$2)',[group,ids[1]]);await q("insert into public.universe_posts(author_id,body,kind,group_id) values($1,'Hola grupo','post',$2)",[ids[1],group]);});
 assert.equal((await asUser(0,()=>q('delete from public.universe_group_members where group_id=$1 and user_id=$2 returning *',[group,ids[0]]))).rows.length,0);
});
test('Private groups require an invitation token and keep discovery and posts private',async()=>{
 const privateGroup=(await asUser(0,()=>q("insert into public.universe_groups(creator_id,name,description,category,campus,is_private) values($1,'Grupo cerrado','Solo con invitación','study','Tarongers',true) returning id,share_token",[ids[0]]))).rows[0];
 await asUser(1,async()=>{
  assert.equal((await q('select * from public.universe_groups where id=$1',[privateGroup.id])).rows.length,0);
  assert.equal((await q('select * from public.universe_shared_group($1)',[privateGroup.share_token])).rows.length,1);
  await assert.rejects(q('insert into public.universe_group_members values($1,$2)',[privateGroup.id,ids[1]]),/row-level security/);
  await assert.rejects(q('select public.universe_set_group_membership($1,true,null)',[privateGroup.id]),/PRIVATE_GROUP_INVITE_REQUIRED/);
  await q('select public.universe_set_group_membership($1,true,$2)',[privateGroup.id,privateGroup.share_token]);
  assert.equal((await q('select * from public.universe_groups where id=$1',[privateGroup.id])).rows.length,1);
  await q("insert into public.universe_posts(author_id,body,kind,group_id) values($1,'Dentro del grupo','post',$2)",[ids[1],privateGroup.id]);
 });
 await asUser(2,async()=>{assert.equal((await q('select * from public.universe_groups where id=$1',[privateGroup.id])).rows.length,0);assert.equal((await q('select * from public.universe_posts where group_id=$1',[privateGroup.id])).rows.length,0);});
});
test('Attendance is idempotent, counts its organiser and cannot bypass capacity through a table write',async()=>{
 plan=(await asUser(0,()=>q("insert into public.universe_plans(creator_id,title,place,meeting_point,starts_at,capacity) values($1,'Un café en el barrio','Benimaclet','En la plaza',now()+interval '2 days',2) returning id",[ids[0]]))).rows[0].id;
 await asUser(1,async()=>{await q('select public.universe_set_plan_attendance($1,true)',[plan]);await q('select public.universe_set_plan_attendance($1,true)',[plan]);});
 await asUser(2,async()=>{await assert.rejects(q('select public.universe_set_plan_attendance($1,true)',[plan]),/PLAN_FULL/);await assert.rejects(q('insert into public.universe_plan_members values($1,$2)',[plan,ids[2]]),/permission denied/);});
 await asUser(0,()=>assert.rejects(q('select public.universe_set_plan_attendance($1,false)',[plan]),/ORGANISER_MUST_CANCEL/));
 await asUser(1,()=>q('select public.universe_set_plan_attendance($1,false)',[plan]));await asUser(2,()=>q('select public.universe_set_plan_attendance($1,true)',[plan]));assert.equal((await q('select * from public.universe_plan_members where plan_id=$1',[plan])).rows.length,2);
});
test('Only both participants can read or send messages; opening a pair reuses the thread',async()=>{
 thread=(await asUser(0,()=>q('select public.universe_open_thread($1) as id',[ids[1]]))).rows[0].id;
 assert.equal((await asUser(1,()=>q('select public.universe_open_thread($1) as id',[ids[0]]))).rows[0].id,thread);
 await asUser(0,()=>q("insert into public.universe_messages(thread_id,sender_id,body) values($1,$2,'Hola privado')",[thread,ids[0]]));
 await asUser(2,async()=>{assert.equal((await q('select * from public.universe_threads')).rows.length,0);assert.equal((await q('select * from public.universe_messages')).rows.length,0);await assert.rejects(q("insert into public.universe_messages(thread_id,sender_id,body) values($1,$2,'Espionaje')",[thread,ids[2]]),/row-level security/);});
 await asUser(1,async()=>{assert.equal((await q('select * from public.universe_messages')).rows.length,1);await assert.rejects(q("insert into public.universe_messages(thread_id,sender_id,body) values($1,$2,'Impersonation')",[thread,ids[0]]),/row-level security/);await assert.rejects(q('select public.universe_open_thread($1)',[ids[3]]),/PEER_UNAVAILABLE/);});
});
test('PDF storage is private, owns a user folder and cannot be removed by another member',async()=>{
 const path=ids[0]+'/10000000-0000-4000-8000-000000000001.pdf';
 await asUser(0,()=>q("insert into storage.objects(bucket_id,name) values('universe-notes',$1)",[path]));
 await asUser(1,async()=>{await assert.rejects(q("insert into storage.objects(bucket_id,name) values('universe-notes',$1)",[ids[0]+'/10000000-0000-4000-8000-000000000002.pdf']),/row-level security/);assert.equal((await q('delete from storage.objects where name=$1 returning *',[path])).rows.length,0);assert.equal((await q('select * from storage.objects where name=$1',[path])).rows.length,0);});
 await asUser(0,()=>q("insert into public.universe_notes(author_id,title,subject,campus,file_name,file_path,file_size) values($1,'Mis apuntes','Economía','Tarongers','apuntes.pdf',$2,100)",[ids[0],path]));
 await asUser(1,async()=>{assert.equal((await q('select * from storage.objects where name=$1',[path])).rows.length,1);assert.equal((await q('delete from public.universe_notes where file_path=$1 returning *',[path])).rows.length,0);});
 assert.equal((await q("select public from storage.buckets where id='universe-notes'")).rows[0].public,false);
});
test('Revoking the reviewed launch region removes access to existing profiles, messages and files',async()=>{
 await q("update public.universe_university_domains set launch_region='madrid' where domain='campus.example.test'");
 await asUser(0,async()=>{for(const table of ['universe_profiles','universe_posts','universe_threads','universe_messages','universe_notes'])assert.equal((await q('select * from public.'+table)).rows.length,0);assert.equal((await q('select * from storage.objects')).rows.length,0);await assert.rejects(q('select public.universe_open_thread($1)',[ids[1]]),/UNIVERSE_UNIVERSITY_REQUIRED/);await assert.rejects(q('select public.universe_set_plan_attendance($1,true)',[plan]),/UNIVERSE_UNIVERSITY_REQUIRED/);});
});

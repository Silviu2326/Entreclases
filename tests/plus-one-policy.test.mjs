import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { readInvitation } from '../lib/auth/invitations.ts';
import { actionSuffix } from '../lib/auth/action-language.ts';

const db = new PGlite();
await db.exec(`
 create role anon; create role authenticated; create role supabase_auth_admin;
 create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;
 alter default privileges in schema public grant all on tables to authenticated;
`);
for (const name of ['202609090001_university_auth','202609090002_valencia_launch','202609090003_community','202609200014_plus_one']) {
 await db.exec(await readFile(new URL('../supabase/migrations/'+name+'.sql',import.meta.url),'utf8'));
}
await db.exec("insert into public.universe_university_domains values('campus.example.test','Universidad de prueba',true,'valencia')");
const ids = Array.from({length:12},(_,i)=>`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
const q = (sql,args=[]) => db.query(sql,args);
async function asUser(id,fn) { await q("select set_config('request.jwt.claim.sub',$1,false)",[id]); await db.exec('set role authenticated'); try { return await fn(); } finally { await db.exec('reset role'); } }
async function rpc(id,name,args=[]) { return asUser(id,async()=> (await q(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as result`,args)).rows[0].result); }
async function profile(id) { return asUser(id,()=>q("insert into public.universe_profiles(user_id,name,university,campus,degree,year,bio,interests) values($1,'Persona de prueba','Fake','Tarongers','Trabajo en diseño',2,'Una bio',array['Café']) returning *",[id])); }
async function eligible(id) { await q("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",[id,id+'@campus.example.test']); await profile(id); await asUser(id,()=>q("insert into public.universe_posts(author_id,body,kind) values($1,'Hola','post')",[id])); }
async function signup(id,email,token) { return q("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)",[id,email,JSON.stringify({plus_one_token:token,account_kind:'university',university_verified:true})]); }
after(()=>db.close());
let token;

test('Tu +1 requires confirmed university membership, a complete profile and participation',async()=>{
 await q("insert into auth.users(id,email) values($1,'owner@campus.example.test')",[ids[0]]);
 await assert.rejects(rpc(ids[0],'universe_create_plus_one',['guest@gmail.com']),/INVITE_NOT_ELIGIBLE/);
 await q('update auth.users set email_confirmed_at=now() where id=$1',[ids[0]]);
 assert.equal((await rpc(ids[0],'universe_plus_one_status')).state,'locked');
 await profile(ids[0]);
 await assert.rejects(rpc(ids[0],'universe_create_plus_one',['guest@gmail.com']),/INVITE_NOT_ELIGIBLE/);
 await asUser(ids[0],()=>q("insert into public.universe_posts(author_id,body,kind) values($1,'Hola','post')",[ids[0]]));
 const issued=await rpc(ids[0],'universe_create_plus_one',[' GUEST@gmail.com ']);
 assert.equal(issued.state,'pending'); assert.equal(issued.email,'guest@gmail.com'); token=issued.token;
 assert.equal((await rpc(ids[0],'universe_create_plus_one',['guest@gmail.com'])).token,token);
 await assert.rejects(rpc(ids[0],'universe_create_plus_one',['different@gmail.com']),/INVITE_PENDING/);
});

test('Neither anonymous nor authenticated callers can read or forge invitation records',async()=>{
 for (const role of ['anon','authenticated']) {
  await db.exec(`set role ${role}`);
  try {
   await assert.rejects(q('select * from public.universe_plus_one'),/permission denied/);
   await assert.rejects(q("insert into public.universe_plus_one(inviter_id,recipient_email) values($1,'evil@gmail.com')",[ids[2]]),/permission denied/);
   await assert.rejects(q('select public.universe_account_kind($1)',[ids[0]]),/permission denied/);
  } finally { await db.exec('reset role'); }
 }
});

test('Hook allows the intended email only; database guard works without the hook',async()=>{
 await db.exec('set role supabase_auth_admin');
 try {
  for(const email of ['guest@gmail.com','other@gmail.com']) {
   const hook=(await q('select public.universe_before_user_created($1) as result',[JSON.stringify({user:{email,user_metadata:{plus_one_token:token}}})])).rows[0].result;
   assert.equal(!!hook.error,email!=='guest@gmail.com');
  }
 } finally { await db.exec('reset role'); }
 await assert.rejects(signup(ids[1],'other@gmail.com',token),/INVITE_INVALID/);
 await assert.rejects(signup(ids[1],'guest@gmail.com','not-a-token'),/INVITE_INVALID/);
 await assert.rejects(q("insert into auth.users(id,email,raw_user_meta_data) values($1,'evil@gmail.com','{\"account_kind\":\"university\"}')",[ids[1]]),/UNIVERSE_UNIVERSITY_REQUIRED/);
 await signup(ids[1],'guest@gmail.com',token);
 assert.equal((await rpc(ids[0],'universe_plus_one_status')).state,'used');
 assert.equal(await rpc(ids[1],'universe_current_member'),null);
 assert.equal((await q('select raw_user_meta_data from auth.users where id=$1',[ids[1]])).rows[0].raw_user_meta_data.plus_one_token,undefined);
 await assert.rejects(signup(ids[2],'guest@gmail.com',token),/INVITE_INVALID/);
 await q('update auth.users set email_confirmed_at=now() where id=$1',[ids[1]]);
 assert.equal((await rpc(ids[1],'universe_current_member')).account_kind,'guest');
});

test('Invited member participates and chats, cannot grant themselves university status or invite',async()=>{
 const p=(await profile(ids[1])).rows[0];
 assert.equal(p.account_kind,'guest'); assert.equal(p.year,0); assert.equal(p.university,'Acceso por invitación');
 await asUser(ids[1],()=>q("insert into public.universe_posts(author_id,body,kind) values($1,'Soy el +1','post')",[ids[1]]));
 await asUser(ids[1],()=>assert.rejects(q("update public.universe_profiles set account_kind='university' where user_id=$1",[ids[1]]),/permission denied/));
 await assert.rejects(rpc(ids[1],'universe_create_plus_one',['friend@gmail.com']),/INVITE_NOT_ELIGIBLE/);
 assert.equal((await rpc(ids[1],'universe_plus_one_status')).state,'guest');
 const thread=await rpc(ids[0],'universe_open_thread',[ids[1]]);
 assert.equal(await rpc(ids[1],'universe_open_thread',[ids[0]]),thread);
 await asUser(ids[1],()=>q("insert into public.universe_messages(thread_id,sender_id,body) values($1,$2,'Hola')",[thread,ids[1]]));
 assert.equal((await rpc(ids[0],'universe_cancel_plus_one')).state,'used');
 assert.equal((await rpc(ids[1],'universe_current_member')).account_kind,'guest');
});

test('Cancellation and expiration invalidate unused links; regenerated links cannot revive old tokens',async()=>{
 await eligible(ids[3]);
 const old=await rpc(ids[3],'universe_create_plus_one',['next@gmail.com']);
 assert.equal((await rpc(ids[3],'universe_cancel_plus_one')).state,'available');
 await assert.rejects(signup(ids[4],'next@gmail.com',old.token),/INVITE_INVALID/);
 const fresh=await rpc(ids[3],'universe_create_plus_one',['next@gmail.com']);assert.notEqual(old.token,fresh.token);
 await q("update public.universe_plus_one set expires_at=now()-interval '1 second' where inviter_id=$1",[ids[3]]);
 await assert.rejects(signup(ids[4],'next@gmail.com',fresh.token),/INVITE_INVALID/);
 assert.equal((await rpc(ids[3],'universe_plus_one_status')).state,'available');
});

test('Deleting guests does not restore the invitation, and deleting inviters does not revoke guest access',async()=>{
 await q('delete from auth.users where id=$1',[ids[1]]);
 await assert.rejects(rpc(ids[0],'universe_create_plus_one',['replacement@gmail.com']),/INVITE_ALREADY_USED/);
 await assert.rejects(signup(ids[2],'guest@gmail.com',token),/INVITE_INVALID/);
 const next=await rpc(ids[3],'universe_create_plus_one',['next@gmail.com']);
 await signup(ids[4],'next@gmail.com',next.token);await q('update auth.users set email_confirmed_at=now() where id=$1',[ids[4]]);
 await q('delete from auth.users where id=$1',[ids[3]]);
 assert.equal((await rpc(ids[4],'universe_current_member')).account_kind,'guest');
});

test('University promotion uses the confirmed auth email, never profile metadata',async()=>{
 await q("update auth.users set email='new@campus.example.test', email_confirmed_at=null where id=$1",[ids[4]]);
 assert.equal(await rpc(ids[4],'universe_current_member'),null);
 await q('update auth.users set email_confirmed_at=now() where id=$1',[ids[4]]);
 assert.equal((await rpc(ids[4],'universe_current_member')).account_kind,'university');
});

test('Invitation tokens stay in fragments and survive language switches without leaking other parameters',()=>{
 assert.equal(readInvitation('#plus-one='+token).token,token);
 assert.equal(readInvitation('#plus-one=bad').invalid,true);
 assert.equal(actionSuffix('?email=private@example.com#plus-one='+token+'&access_token=secret&preview=1','register'),'#plus-one='+token+'&preview=1');
 assert.equal(actionSuffix('#plus-one=bad','register'),'');
});


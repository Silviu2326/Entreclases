import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { COIN_RULES } from '../lib/community/unicoins.ts';
const db=new PGlite();
await db.exec(`
 create role anon; create role authenticated; create role supabase_auth_admin;
 create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}',is_anonymous boolean default false);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;
 alter default privileges in schema public grant all on tables to authenticated;
`);
for(const file of ['202609090001_university_auth','202609090002_valencia_launch','202609090003_community'])await db.exec(await readFile(new URL('../supabase/migrations/'+file+'.sql',import.meta.url),'utf8'));
await db.exec("insert into public.universe_university_domains values('coins.example.test','Campus de prueba',true,'valencia')");
const ids=Array.from({length:12},(_,i)=>'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'));
const q=(sql,args=[])=>db.query(sql,args);
async function asUser(i,run){await q("select set_config('request.jwt.claim.sub',$1,false)",[ids[i]]);await db.exec('set role authenticated');try{return await run();}finally{await db.exec('reset role');}}
for(let i=0;i<ids.length;i++)await q('insert into auth.users(id,email,email_confirmed_at) values($1,$2,$3)',[ids[i],`user${i}@coins.example.test`,i===11?null:new Date().toISOString()]);
for(let i=0;i<11;i++)await asUser(i,()=>q("insert into public.universe_profiles(user_id,name,campus,degree,year) values($1,$2,'Tarongers','Economía',2)",[ids[i],`Persona ${i}`]));
const post=async(i,body='Hola, ¿nos vemos?')=>(await asUser(i,()=>q("insert into public.universe_posts(author_id,body,kind) values($1,$2,'post') returning id",[ids[i],body]))).rows[0].id;
const plan=async(i,title='Un café por el campus')=>(await asUser(i,()=>q("insert into public.universe_plans(creator_id,title,place,meeting_point,starts_at,capacity) values($1,$2,'Benimaclet','En la plaza',now()+interval '2 days',8) returning id",[ids[i],title]))).rows[0].id;
const reply=(i,id)=>asUser(i,()=>q("insert into public.universe_comments(author_id,post_id,body) values($1,$2,'Vamos a ver ese tema juntos')",[ids[i],id]));
const join=(i,id,on=true)=>asUser(i,()=>q('select public.universe_set_plan_attendance($1,$2)',[id,on]));
const wallet=async(i)=>(await asUser(i,()=>q('select public.universe_coin_wallet() as wallet'))).rows[0].wallet;
const legacyPost=await post(10),legacyPlan=await plan(10);await reply(0,legacyPost);await join(1,legacyPlan);
await db.exec(await readFile(new URL('../supabase/migrations/202609090005_unicoins.sql',import.meta.url),'utf8'));
after(()=>db.close());

test('The published amounts match server rules and the welcome grant happens exactly once',async()=>{
 assert.deepEqual((await q('select public.universe_coin_rules() as rules')).rows[0].rules,COIN_RULES);
 for(let n=0;n<3;n++){const w=await wallet(0);assert.equal(w.balance,20);assert.equal(w.transactions.length,1);}
 await asUser(0,()=>q("update public.universe_profiles set name='Mi nuevo nombre' where user_id=$1",[ids[0]]));assert.equal((await wallet(0)).balance,20);
});
test('Opening threads spends 5 atomically; insufficient funds leave no post, charge or negative balance',async()=>{
 const posts=[];for(let n=0;n<4;n++)posts.push(await post(1));assert.equal((await wallet(1)).balance,0);
 const before=(await q('select count(*)::integer as n from public.universe_posts where author_id=$1',[ids[1]])).rows[0].n;
 await assert.rejects(post(1),/UNICOINS_INSUFFICIENT/);assert.equal((await q('select count(*)::integer as n from public.universe_posts where author_id=$1',[ids[1]])).rows[0].n,before);
 await asUser(1,()=>q('delete from public.universe_posts where id=$1',[posts[0]]));assert.equal((await wallet(1)).balance,0);
 await asUser(1,()=>assert.rejects(q("insert into public.universe_posts(id,author_id,body,kind) values($1,$2,'Recycled identity','post')",[posts[0],ids[1]]),/UNICOINS_REQUEST_USED/));
 assert.equal((await wallet(1)).transactions.filter(t=>t.reason==='create_thread').length,4);
});
test('Events spend 10, never reward their organiser, and a repeated request ID cannot charge twice',async()=>{
 const event=await plan(2);assert.equal((await wallet(2)).balance,10);
 await asUser(2,()=>assert.rejects(q("insert into public.universe_plans(id,creator_id,title,place,meeting_point,starts_at,capacity) values($1,$2,'Retry','Benimaclet','Plaza',now()+interval '2 days',8)",[event,ids[2]]),/duplicate key/));assert.equal((await wallet(2)).balance,10);
 await plan(2);assert.equal((await wallet(2)).balance,0);await assert.rejects(plan(2),/UNICOINS_INSUFFICIENT/);
 const idsBefore=(await q('select id from public.universe_plans where creator_id=$1',[ids[2]])).rows.map(r=>r.id);
 assert.equal(idsBefore.length,2);assert.equal((await wallet(2)).transactions.filter(t=>t.reason==='join_event').length,0);
 await asUser(2,()=>q('delete from public.universe_plans where id=$1',[event]));assert.equal((await wallet(2)).balance,0);
});
test('Event rewards are once per event, capped daily, and a capped claim cannot be replayed tomorrow',async()=>{
 const a=await plan(6),b=await plan(6),c=await plan(7);await join(3,a);assert.equal((await wallet(3)).balance,23);
 await join(3,a);await join(3,a,false);await join(3,a);assert.equal((await wallet(3)).balance,23);
 await join(3,b);await join(3,c);let w=await wallet(3);assert.equal(w.balance,26);assert.equal(w.today.events,2);assert.ok(w.claimed_events.includes(c));
 await q("update public.universe_coin_ledger set created_at=now()-interval '2 days' where user_id=$1 and reason='join_event'",[ids[3]]);
 await join(3,c,false);await join(3,c);w=await wallet(3);assert.equal(w.balance,26);assert.equal(w.today.events,0);
});
test('Only first replies to other people earn coins, with three rewarded threads per day',async()=>{
 const own=await post(4);await reply(4,own);assert.equal((await wallet(4)).balance,15);
 const posts=[];for(let n=0;n<4;n++)posts.push(await post(9));
 await reply(4,posts[0]);await reply(4,posts[0]);assert.equal((await wallet(4)).balance,17);
 for(const id of posts.slice(1))await reply(4,id);let w=await wallet(4);assert.equal(w.balance,21);assert.equal(w.today.replies,3);assert.ok(w.claimed_threads.includes(posts[3]));
 await q("update public.universe_coin_ledger set created_at=now()-interval '2 days' where user_id=$1 and reason='reply_thread'",[ids[4]]);await reply(4,posts[3]);w=await wallet(4);assert.equal(w.balance,21);assert.equal(w.today.replies,0);
});
test('Rejected content and forged authors do not spend coins; an entire failed transaction rolls back the ledger',async()=>{
 const before=await wallet(5);
 await asUser(5,async()=>{await assert.rejects(q("insert into public.universe_posts(author_id,body,kind) values($1,'','post')",[ids[5]]),/check constraint/);await assert.rejects(q("insert into public.universe_posts(author_id,body,kind) values($1,'Forged','post')",[ids[0]]),/row-level security/);});
 await db.exec('begin');await asUser(5,()=>q("insert into public.universe_posts(author_id,body,kind) values($1,'Rolled back','post')",[ids[5]]));await db.exec('rollback');assert.deepEqual(await wallet(5),before);
});
test('Pre-release participation is remembered without retroactive charges or replay rewards',async()=>{
 assert.equal((await wallet(10)).balance,20);await reply(0,legacyPost);assert.equal((await wallet(0)).balance,20);
 const before=(await wallet(1)).balance;await join(1,legacyPlan,false);await join(1,legacyPlan);assert.equal((await wallet(1)).balance,before);
});
test('A client cannot mint, edit, delete, transfer or inspect another wallet, including through internal functions',async()=>{
 await asUser(0,async()=>{
  assert.equal((await q('select * from public.universe_coin_wallets where user_id=$1',[ids[1]])).rows.length,0);
  assert.equal((await q('select * from public.universe_coin_ledger where user_id=$1',[ids[1]])).rows.length,0);
  await assert.rejects(q('update public.universe_coin_wallets set balance=100000 where user_id=$1',[ids[0]]),/permission denied/);
  await assert.rejects(q('delete from public.universe_coin_claims where user_id=$1',[ids[0]]),/permission denied/);
  await assert.rejects(q('delete from public.universe_coin_ledger where user_id=$1',[ids[0]]),/permission denied/);
  await assert.rejects(q('select public.universe_coin_ensure($1)',[ids[0]]),/permission denied/);
  await assert.rejects(q("select public.universe_coin_reward($1,'join_event',$2,'Fake')",[ids[0],legacyPlan]),/permission denied/);
 });
 await asUser(11,()=>assert.rejects(q('select public.universe_coin_wallet()'),/UNIVERSE_UNIVERSITY_REQUIRED/));
 await db.exec('set role anon');try{await assert.rejects(q('select public.universe_coin_wallet()'),/permission denied/);}finally{await db.exec('reset role');}
});
test('Revoked university membership loses both the wallet RPC and row access',async()=>{
 await q("update public.universe_university_domains set enabled=false where domain='coins.example.test'");await asUser(0,async()=>{await assert.rejects(q('select public.universe_coin_wallet()'),/UNIVERSE_UNIVERSITY_REQUIRED/);assert.equal((await q('select * from public.universe_coin_wallets')).rows.length,0);assert.equal((await q('select * from public.universe_coin_ledger')).rows.length,0);});
});


test('Launch upgrade preserves balances, grants one free first thread and stops signup rewards',async()=>{
 await q("update public.universe_university_domains set enabled=true where domain='coins.example.test'");
 const before=(await wallet(2)).balance;
 await db.exec(await readFile(new URL('../supabase/migrations/202609220018_participation_incentives.sql',import.meta.url),'utf8'));
 assert.equal((await wallet(2)).balance,before,'historical balances stay intact');
 const fresh='00000000-0000-4000-8000-000000000099';
 await q("insert into auth.users(id,email,email_confirmed_at) values($1,'fresh@coins.example.test',now())",[fresh]);
 await q("select set_config('request.jwt.claim.sub',$1,false)",[fresh]);
 await db.exec('set role authenticated');
 try {
  await q("insert into public.universe_profiles(user_id,name,campus,degree,year) values($1,'Nueva persona','Tarongers','Economía',2)",[fresh]);
  const getWallet=async()=>(await q('select public.universe_coin_wallet() as w')).rows[0].w;
  assert.equal((await getWallet()).first_thread_available,true);
  const id=(await q("insert into public.universe_posts(author_id,body,kind) values($1,'Primer hilo gratis','post') returning id",[fresh])).rows[0].id;
  assert.equal((await getWallet()).balance,20);
  assert.equal((await getWallet()).first_thread_available,false);
  await q('delete from public.universe_posts where id=$1',[id]);
  await assert.rejects(q("insert into public.universe_posts(id,author_id,body,kind) values($1,$2,'Reutilizar primer hilo','post')",[id,fresh]),/UNICOINS_REQUEST_USED/);
  await q("insert into public.universe_posts(author_id,body,kind) values($1,'Segundo hilo con coste','post')",[fresh]);
  assert.equal((await getWallet()).balance,15);
  await q('select public.universe_set_plan_attendance($1,true)',[legacyPlan]);
  assert.equal((await getWallet()).balance,15,'joining grants no coins');
  assert.equal((await getWallet()).event_rewards_enabled,false);
  await assert.rejects(q('delete from public.universe_free_threads'),/permission denied/);
 } finally { await db.exec('reset role'); }
});

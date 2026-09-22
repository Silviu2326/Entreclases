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
 alter default privileges in schema public grant all on tables to authenticated;
`);
for(const name of ['202609090001_university_auth','202609090002_valencia_launch','202609090003_community','202609090004_community_storage','202609260027_profile_space'])await db.exec(await readFile(new URL('../supabase/migrations/'+name+'.sql',import.meta.url),'utf8'));
await db.exec("insert into public.universe_university_domains values('campus.example.test','Campus verificado',true,'valencia')");
const ids=[0,1,2].map(n=>'00000000-0000-4000-8000-00000000000'+n);
for(let i=0;i<3;i++)await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,$3)',[ids[i],`user${i}@campus.example.test`,i===2?null:new Date().toISOString()]);
async function as(i,run){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[i]]);await db.exec('set role authenticated');try{return await run();}finally{await db.exec('reset role');}}
const q=(sql,args=[])=>db.query(sql,args);
for(let i=0;i<2;i++)await as(i,()=>q("insert into public.universe_profiles(user_id,name,university,campus,degree,year) values($1,$2,'x','Tarongers','Economía',2)",[ids[i],`Persona ${i}`]));
after(()=>db.close());

test('The space is one JSON the owner writes and everybody reads, bounded in shape and size',async()=>{
 await as(0,()=>q(`update public.universe_profiles set space='{"background":"noche","hidden":["network"],"order":["shelf","showcase"]}' where user_id=$1`,[ids[0]]));
 await as(1,async()=>assert.equal((await q('select space->>\'background\' as bg from public.universe_profiles where user_id=$1',[ids[0]])).rows[0].bg,'noche'));
 await as(1,async()=>assert.equal((await q(`update public.universe_profiles set space='{"background":"lima"}' where user_id=$1 returning *`,[ids[0]])).rows.length,0,'nadie decora el espacio de otro'));
 await as(0,()=>assert.rejects(q(`update public.universe_profiles set space='["no","es","objeto"]' where user_id=$1`,[ids[0]]),/check constraint/));
 await as(0,()=>assert.rejects(q(`update public.universe_profiles set space=$2 where user_id=$1`,[ids[0],JSON.stringify({background:'x'.repeat(2100)})]),/check constraint/));
});

test('Stickers: everybody sees them, only the owner pins, moves and peels them',async()=>{
 const own=(await as(0,()=>q("insert into public.universe_stickers(owner_id,path,x,y) values($1,'builtin:cafe',12,30) returning id",[ids[0]]))).rows[0].id;
 await as(1,async()=>assert.equal((await q('select path from public.universe_stickers where owner_id=$1',[ids[0]])).rows[0].path,'builtin:cafe'));
 await as(2,async()=>assert.equal((await q('select * from public.universe_stickers')).rows.length,0,'sin confirmar, nada'));
 await as(1,()=>assert.rejects(q("insert into public.universe_stickers(owner_id,path) values($1,'builtin:sol')",[ids[0]]),/row-level security/));
 await as(1,async()=>{
  assert.equal((await q('update public.universe_stickers set x=99 where id=$1 returning *',[own])).rows.length,0);
  assert.equal((await q('delete from public.universe_stickers where id=$1 returning *',[own])).rows.length,0);
 });
 await as(0,async()=>assert.equal((await q('update public.universe_stickers set x=88.5,rotation=-15,scale=1.4,z=3 where id=$1 returning x',[own])).rows[0].x,88.5));
});

test('A sticker path is a shipped one or the owner own folder, and the placement stays on the cover',async()=>{
 const stored=ids[0]+'/sticker-11111111-2222-4333-8444-555555555555.webp';
 await as(0,()=>q("insert into public.universe_stickers(owner_id,path) values($1,$2)",[ids[0],stored]));
 await as(0,()=>assert.rejects(q("insert into public.universe_stickers(owner_id,path) values($1,$2)",[ids[0],ids[1]+'/sticker-11111111-2222-4333-8444-555555555555.webp']),/check constraint/,'la carpeta de otro no'));
 await as(0,()=>assert.rejects(q("insert into public.universe_stickers(owner_id,path) values($1,'https://fuera.test/x.png')",[ids[0]]),/check constraint/,'ni una dirección externa'));
 for(const bad of ['x=101','y=-1','scale=0.1','scale=4','rotation=181','z=100'])await as(0,()=>assert.rejects(q(`update public.universe_stickers set ${bad} where owner_id=$1`,[ids[0]]),/check constraint/,bad));
});

test('Twelve stickers per cover, enforced by the table',async()=>{
 const have=(await as(0,()=>q('select count(*)::int as n from public.universe_stickers where owner_id=$1',[ids[0]]))).rows[0].n;
 for(let i=have;i<12;i++)await as(0,()=>q("insert into public.universe_stickers(owner_id,path) values($1,'builtin:estrella')",[ids[0]]));
 await as(0,()=>assert.rejects(q("insert into public.universe_stickers(owner_id,path) values($1,'builtin:sol')",[ids[0]]),/STICKER_LIMIT/));
 await as(1,()=>q("insert into public.universe_stickers(owner_id,path) values($1,'builtin:sol')",[ids[1]]),'el tope es por persona');
});

test('The sticker bucket takes only own webp files and lets every member read them',async()=>{
 const path=ids[0]+'/sticker-22222222-2222-4333-8444-555555555555.webp';
 await as(1,()=>assert.rejects(q("insert into storage.objects(bucket_id,name) values('universe-stickers',$1)",[path]),/row-level security/));
 await as(0,()=>assert.rejects(q("insert into storage.objects(bucket_id,name) values('universe-stickers',$1)",[ids[0]+'/foto.png']),/row-level security/,'solo el nombre de sticker'));
 await as(0,()=>q("insert into storage.objects(bucket_id,name) values('universe-stickers',$1)",[path]));
 await as(1,async()=>assert.equal((await q("select * from storage.objects where name=$1",[path])).rows.length,1));
 await as(1,async()=>assert.equal((await q("delete from storage.objects where name=$1 returning *",[path])).rows.length,0));
 await as(0,async()=>assert.equal((await q("delete from storage.objects where name=$1 returning *",[path])).rows.length,1));
});

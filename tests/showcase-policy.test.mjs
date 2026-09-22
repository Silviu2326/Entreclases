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
for(const name of ['202609090001_university_auth','202609090002_valencia_launch','202609090003_community','202609090004_community_storage','202609250026_showcase'])await db.exec(await readFile(new URL('../supabase/migrations/'+name+'.sql',import.meta.url),'utf8'));
await db.exec("insert into public.universe_university_domains values('campus.example.test','Campus verificado',true,'valencia')");
// 0 owner (Tarongers) · 1 same campus · 2 other campus, has chatted with 0 · 3 other campus, stranger · 4 unconfirmed
const ids=[0,1,2,3,4].map(n=>'00000000-0000-4000-8000-00000000000'+n);
for(let i=0;i<5;i++)await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,$3)',[ids[i],`user${i}@campus.example.test`,i===4?null:new Date().toISOString()]);
async function as(i,run){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[i]]);await db.exec('set role authenticated');try{return await run();}finally{await db.exec('reset role');}}
const q=(sql,args=[])=>db.query(sql,args);
for(let i=0;i<4;i++)await as(i,()=>q("insert into public.universe_profiles(user_id,name,university,campus,degree,year) values($1,$2,'x',$3,'Economía',2)",[ids[i],`Persona ${i}`,i<2?'Tarongers':'Vera']));
// Threads open through the same RPC the app uses; the table takes no direct inserts.
await as(0,()=>q("select public.universe_open_thread($1)",[ids[2]]));
after(()=>db.close());
const piece=(audience,extra={})=>as(0,()=>q("insert into public.universe_showcase(owner_id,kind,title,body,audience,viewers) values($1,'note','t','hola',$2,$3) returning id",[ids[0],audience,extra.viewers??[]])).then(r=>r.rows[0].id);
const seen=(i)=>as(i,()=>q("select audience from public.universe_showcase where owner_id=$1 order by audience",[ids[0]])).then(r=>r.rows.map(x=>x.audience));

test('Each audience is enforced by the row, from five different chairs',async()=>{
 await piece('everyone');await piece('campus');await piece('contacts');await piece('chosen',{viewers:[ids[3]]});await piece('only_me');
 assert.deepEqual(await seen(0),['campus','chosen','contacts','everyone','only_me'],'la dueña lo ve todo');
 assert.deepEqual(await seen(1),['campus','everyone'],'mismo campus, sin haber hablado');
 assert.deepEqual(await seen(2),['contacts','everyone'],'otro campus, pero han hablado');
 assert.deepEqual(await seen(3),['chosen','everyone'],'elegida a dedo, nada más');
 await as(4,async()=>assert.equal((await q('select * from public.universe_showcase')).rows.length,0,'sin confirmar no hay escaparate'));
 await db.exec('set role anon');try{await assert.rejects(q('select * from public.universe_showcase'),/permission denied/);}finally{await db.exec('reset role');}
});

test('Only the owner writes, and never in somebody else name',async()=>{
 await as(1,()=>assert.rejects(q("insert into public.universe_showcase(owner_id,kind,body) values($1,'note','ajena')",[ids[0]]),/row-level security/));
 const mine=(await as(1,()=>q("insert into public.universe_showcase(owner_id,kind,body) values($1,'note','mía') returning id",[ids[1]]))).rows[0].id;
 await as(0,async()=>{
  assert.equal((await q("update public.universe_showcase set body='pisada' where id=$1 returning *",[mine])).rows.length,0);
  assert.equal((await q('delete from public.universe_showcase where id=$1 returning *',[mine])).rows.length,0);
  await assert.rejects(q("update public.universe_showcase set owner_id=$2 where owner_id=$1",[ids[0],ids[1]]),/row-level security/);
 });
 await as(1,async()=>assert.equal((await q("update public.universe_showcase set audience='only_me' where id=$1 returning audience",[mine])).rows[0].audience,'only_me'));
});

test('A piece carries exactly what its kind needs',async()=>{
 const bad=[
  ["'link','',''",'un enlace sin url'],["'note','',''",'una nota vacía'],["'story','',''",'una historia sin archivo'],
 ];
 for(const [cols,why] of bad)await as(0,()=>assert.rejects(q(`insert into public.universe_showcase(owner_id,kind,title,body) values($1,${cols})`,[ids[0]]),/check constraint/,why));
 await as(0,()=>assert.rejects(q("insert into public.universe_showcase(owner_id,kind,url) values($1,'link','http://inseguro.test')",[ids[0]]),/check constraint/,'solo https'));
 await as(0,()=>assert.rejects(q("insert into public.universe_showcase(owner_id,kind,media_path,media_kind) values($1,'file',$2,'image')",[ids[0],ids[0]+'/'+ids[1]+'.jpg']),/check constraint/,'un archivo es un pdf'));
 await as(0,()=>assert.rejects(q("insert into public.universe_showcase(owner_id,kind,media_path,media_kind) values($1,'media',$2,'image')",[ids[0],ids[1]+'/'+ids[0]+'.jpg']),/check constraint/,'la ruta lleva a su dueño'));
 await as(0,()=>assert.rejects(q("insert into public.universe_showcase(owner_id,kind,body,audience) values($1,'note','x','chosen')",[ids[0]]),/check constraint/,'elegir a nadie no es elegir'));
 await as(0,()=>assert.rejects(q("insert into public.universe_showcase(owner_id,kind,body,audience,viewers) values($1,'note','x','chosen',$2)",[ids[0],Array.from({length:51},()=>ids[1])]),/check constraint/,'tope de cincuenta'));
});

test('The file behind a piece is only readable by whoever can see the piece',async()=>{
 const path=ids[0]+'/11111111-2222-4333-8444-555555555555.pdf';
 await as(1,()=>assert.rejects(q("insert into storage.objects(bucket_id,name) values('universe-showcase',$1)",[path]),/row-level security/,'nadie sube en la carpeta de otro'));
 await as(0,()=>q("insert into storage.objects(bucket_id,name) values('universe-showcase',$1)",[path]));
 // Uploaded but not yet on a row: only its owner can reach it.
 await as(3,async()=>assert.equal((await q("select * from storage.objects where name=$1",[path])).rows.length,0));
 await as(0,()=>q("insert into public.universe_showcase(owner_id,kind,title,media_path,media_kind,audience,viewers) values($1,'file','Apuntes',$2,'pdf','chosen',$3)",[ids[0],path,[ids[3]]]));
 await as(3,async()=>assert.equal((await q("select * from storage.objects where name=$1",[path])).rows.length,1,'la elegida abre el archivo'));
 await as(1,async()=>assert.equal((await q("select * from storage.objects where name=$1",[path])).rows.length,0,'la que no está en la lista, no'));
 await as(0,()=>q("update public.universe_showcase set audience='only_me',viewers='{}' where media_path=$1",[path]));
 await as(3,async()=>assert.equal((await q("select * from storage.objects where name=$1",[path])).rows.length,0,'al cambiar la audiencia el archivo la sigue'));
 await as(3,async()=>assert.equal((await q("delete from storage.objects where name=$1 returning *",[path])).rows.length,0));
 await as(0,async()=>assert.equal((await q("delete from storage.objects where name=$1 returning *",[path])).rows.length,1));
});

test('The finish is a profile setting the owner changes and everybody reads',async()=>{
 await as(0,()=>q("update public.universe_profiles set showcase_frame='neon' where user_id=$1",[ids[0]]));
 await as(1,async()=>assert.equal((await q('select showcase_frame from public.universe_profiles where user_id=$1',[ids[0]])).rows[0].showcase_frame,'neon'));
 await as(1,async()=>assert.equal((await q("update public.universe_profiles set showcase_frame='cristal' where user_id=$1 returning *",[ids[0]])).rows.length,0));
 await as(0,()=>assert.rejects(q("update public.universe_profiles set showcase_frame='terciopelo' where user_id=$1",[ids[0]]),/check constraint/));
});

// Estudiar con un apunte: quién puede pedirlo, cuánto, y qué se ve del resultado.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db=new PGlite();
await db.exec(`
 create role anon; create role authenticated; create role service_role; create role supabase_auth_admin;
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
for(const name of ['202609090001_university_auth','202609090002_valencia_launch','202609090003_community','202609090004_community_storage','202609270029_note_study','202609270033_student_learning'])await db.exec(await readFile(new URL('../supabase/migrations/'+name+'.sql',import.meta.url),'utf8'));
await db.exec("insert into public.universe_university_domains values('campus.example.test','Campus verificado',true,'valencia')");
const ids=[1,2,3].map(n=>'00000000-0000-4000-8000-00000000000'+n);
for(let i=0;i<3;i++)await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,$3)',[ids[i],`user${i}@campus.example.test`,i===2?null:new Date().toISOString()]);
const q=(sql,args=[])=>db.query(sql,args);
async function as(role,i,run){if(i!==null)await q("select set_config('request.jwt.claim.sub',$1,false)",[ids[i]]);await db.exec(`set role ${role}`);try{return await run();}finally{await db.exec('reset role');}}
const asUser=(i,run)=>as('authenticated',i,run);
for(let i=0;i<2;i++)await asUser(i,()=>q("insert into public.universe_profiles(user_id,name,university,campus,degree,year) values($1,$2,'x','Tarongers','Economía',2)",[ids[i],`Persona ${i}`]));

const save=(i,tool,value,revision=0)=>asUser(i,async()=>(await q('select public.universe_student_save($1,$2,$3) as revision',[tool,JSON.stringify(value),revision])).rows[0].revision);
after(()=>db.close());
test('Only the owner can read state; authenticated users cannot bypass the save function',async()=>{
 assert.equal(await save(0,'subjects',{subjects:[{name:'Privada'}]}),1);
 assert.equal((await asUser(0,()=>q('select * from public.universe_student_state'))).rows.length,1);
 assert.equal((await asUser(1,()=>q('select * from public.universe_student_state'))).rows.length,0);
 await asUser(0,()=>assert.rejects(q("update public.universe_student_state set revision=77"),/permission denied/));
 await as('anon',null,()=>assert.rejects(q('select * from public.universe_student_state'),/permission denied/));
 await as('anon',null,()=>assert.rejects(q("select public.universe_student_save('subjects','{}',0)"),/permission denied/));
 await assert.rejects(save(2,'subjects',{}),/STUDENT_NOT_MEMBER/);
});
test('Stale or duplicate writes cannot overwrite a newer device version',async()=>{
 assert.equal(await save(0,'subjects',{subjects:[{name:'Updated'}]},1),2);
 await assert.rejects(save(0,'subjects',{subjects:[]},1),/STUDENT_CONFLICT/);
 await assert.rejects(save(0,'subjects',{subjects:[]},0),/STUDENT_CONFLICT/);
 const row=(await asUser(0,()=>q('select value,revision from public.universe_student_state'))).rows[0];assert.equal(row.revision,2);assert.equal(row.value.subjects[0].name,'Updated');
 assert.equal(await save(1,'subjects',{subjects:[]}),1);
});
test('Invalid namespaces and excessive payloads are rejected',async()=>{await assert.rejects(save(0,'admin',{}),/STUDENT_INVALID/);await assert.rejects(save(0,'learning',{data:'x'.repeat(4000001)}),/STUDENT_INVALID/);});
test('Both AI entrypoints share enforced per-user daily limits',async()=>{
 const claim=(i,prepare)=>asUser(i,async()=>(await q('select public.universe_student_ai_claim($1) as ok',[prepare])).rows[0].ok);
 for(let n=0;n<6;n++)assert.equal(await claim(0,true),true);assert.equal(await claim(0,true),false);assert.equal(await claim(1,true),true);
 for(let n=0;n<30;n++)assert.equal(await claim(0,false),true);assert.equal(await claim(0,false),false);
 await assert.rejects(claim(2,true),/STUDENT_NOT_MEMBER/);
});

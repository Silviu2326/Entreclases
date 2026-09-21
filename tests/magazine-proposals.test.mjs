import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create schema auth; create schema storage; grant usage on schema auth to authenticated;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table public.universe_profiles(user_id uuid primary key,name text);
create table public.universe_plans(id uuid primary key,creator_id uuid);
create table public.universe_posts(id uuid primary key,author_id uuid,group_id uuid);
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;
create function public.universe_is_member() returns boolean language sql stable security definer as $$select exists(select 1 from public.universe_profiles where user_id=auth.uid())$$;`);
for(const name of ['202609190008_projects_magazine.sql','202609200011_magazine_proposals.sql']){const sql=await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');try{await db.exec(sql);}catch(e){console.error(e.message,sql.slice(Number(e.position)-180,Number(e.position)+180));process.exit(1);}}
const users=[1,2,3].map(x=>'00000000-0000-4000-8000-'+String(x).padStart(12,'0'));
for(let i=0;i<users.length;i++)await db.query('insert into public.universe_profiles values($1,$2)',[users[i],`Persona ${i}`]);
await db.query('insert into public.universe_magazine_editors values($1)',[users[2]]);
async function as(i,fn){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[users[i]??'']);await db.exec('set role authenticated');try{return await fn();}finally{await db.exec('reset role');}}
async function rpc(i,command='read',input={}){return as(i,async()=>(await db.query('select public.universe_studio($1,$2) data',[command,JSON.stringify(input)])).rows[0].data);}
const draft={kind:'story',title:'Nuestra historia',body:'Hemos preparado una muestra de los bocetos del taller y buscamos a otras personas para participar.',summary:'Un taller entre clases.',section:'Cultura',layout:'photo',images:[],author_note:'Solo el equipo editorial puede leer esta nota.',send:false};
const photoPath=`${users[0]}/10000000-0000-4000-8000-000000000001.webp`;
let id,revision,edition;
after(()=>db.close());
test('Drafts stay private, legacy RPC is closed, authors cannot review',async()=>{
 await as(0,()=>assert.rejects(db.query("select public.universe_studio_legacy('read','{}')"),/permission denied/));
 await assert.rejects(rpc(9),/verificada/);
 const data=await rpc(0,'save_submission',draft);id=data.submissions[0].id;revision=data.submissions[0].revision;
 assert.equal(data.magazine_version,2);assert.equal(data.submissions[0].status,'draft');assert.equal(data.submissions[0].consent,false);
 assert.equal((await rpc(1)).submissions.length,0);assert.equal((await rpc(2)).submissions.length,0);
 await assert.rejects(rpc(1,'save_submission',{...draft,id,revision}),/editarla/);
 await assert.rejects(rpc(0,'save_submission',{...draft,id,revision:0}),/cambiado/);
 await assert.rejects(rpc(0,'review_submission',{id,status:'accepted'}),/editorial/);
});
test('Image upload and reference ownership, permission, metadata and format enforced',async()=>{
 await as(0,()=>db.query("insert into storage.objects(bucket_id,name) values('universe-magazine',$1)",[photoPath]));
 await as(1,()=>assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('universe-magazine',$1)",[photoPath]),/row-level security/));
 const photo={path:photoPath,alt:'Una mesa con bocetos',caption:'Primera sesión del taller',credit:'Persona 0'};
 await assert.rejects(rpc(0,'save_submission',{...draft,id,revision,send:true,consent:false,images:[photo],image_rights:true}),/autorizar/);
 await assert.rejects(rpc(0,'save_submission',{...draft,id,revision,send:true,consent:true,images:[photo]}),/permisos/);
 await assert.rejects(rpc(1,'save_submission',{...draft,images:[photo]}),/tus imágenes/);
 await assert.rejects(rpc(0,'save_submission',{...draft,id,revision,images:[{...photo,path:`${users[0]}/10000000-0000-4000-8000-000000000002.webp`}]}),/subido/);
 await assert.rejects(rpc(0,'save_submission',{...draft,id,revision,send:true,consent:true,image_rights:true,images:[{...photo,alt:''}]}),/descripción/);
 const data=await rpc(0,'save_submission',{...draft,id,revision,send:true,consent:true,image_rights:true,images:[photo]});
 assert.equal(data.submissions[0].status,'pending');assert.equal(data.submissions[0].images[0].caption,photo.caption);
 await as(1,async()=>assert.equal((await db.query("select * from storage.objects")).rows.length,0));
 await as(2,async()=>assert.equal((await db.query("select * from storage.objects")).rows.length,1));
 await as(0,async()=>assert.equal((await db.query("delete from storage.objects where name=$1 returning name",[photoPath])).rows.length,0));
});
test('Changes and rejection include feedback; editing requires fresh author consent and review',async()=>{
 await assert.rejects(rpc(2,'review_submission',{id,status:'changes_requested',note:''}),/motivo/);
 await rpc(2,'review_submission',{id,status:'changes_requested',note:'Incluye dónde será el taller.'});
 const s=(await rpc(0)).submissions[0];assert.equal(s.editorial_note,'Incluye dónde será el taller.');assert.equal(s.history.length,3);
 await rpc(0,'save_submission',{...draft,id,revision:s.revision,layout:'classic',send:false});
 const fresh=(await rpc(0)).submissions[0];assert.equal(fresh.status,'draft');assert.equal(fresh.consent,false);assert.equal((await rpc(2)).submissions.length,0);
 await rpc(0,'save_submission',{...draft,id,revision:fresh.revision,layout:'classic',send:true,consent:true});
 await rpc(2,'review_submission',{id,status:'rejected',note:'La fecha del taller ya ha pasado.'});
 assert.equal((await rpc(0)).submissions[0].status,'rejected');assert.equal((await rpc(1)).submissions.length,0);
});
test('Only accepted submissions publish; private notes never reach readers; withdrawal removes images and story access',async()=>{
 let s=(await rpc(0)).submissions[0];
 const images=[{path:photoPath,alt:'Mesa del taller',caption:'Taller',credit:'Persona 0'}];
 await rpc(0,'save_submission',{...draft,id,revision:s.revision,send:true,consent:true,image_rights:true,images});
 edition=(await rpc(2,'create_edition',{title:'Talleres entre clases',date:'2026-10-04'})).editions[0].id;
 await assert.rejects(rpc(2,'select',{id,edition,on:true}),/aceptadas/);
 await rpc(2,'review_submission',{id,status:'accepted',note:'Lista para el próximo número.'});
 await assert.rejects(rpc(0,'save_submission',{...draft,id,revision:8}),/editarla/);
 await rpc(2,'select',{id,edition,on:true});await rpc(2,'publish_edition',{edition});
 s=(await rpc(1)).submissions[0];assert.equal(s.status,'published');assert.equal(s.layout,'photo');assert.equal(s.author_note,undefined);assert.equal(s.editorial_note,undefined);assert.equal(s.history,undefined);assert.equal(s.images.length,1);
 await as(1,async()=>assert.equal((await db.query("select * from storage.objects")).rows.length,1));
 await assert.rejects(rpc(1,'withdraw',{id}),/disponible/);
 await rpc(0,'withdraw',{id});assert.equal((await rpc(1)).submissions.length,0);
 await as(1,async()=>assert.equal((await db.query("select * from storage.objects")).rows.length,0));
 assert.equal((await rpc(0)).submissions[0].status,'withdrawn');
});

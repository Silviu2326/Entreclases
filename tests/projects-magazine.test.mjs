import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table public.universe_profiles(user_id uuid primary key,name text);
create table public.universe_plans(id uuid primary key,creator_id uuid);
create table public.universe_posts(id uuid primary key,author_id uuid,group_id uuid);
create function public.universe_is_member() returns boolean language sql stable as $$select exists(select 1 from public.universe_profiles where user_id=auth.uid())$$;
alter default privileges in schema public grant all on tables to authenticated;`);
await db.exec(await readFile(new URL('../supabase/migrations/202609190008_projects_magazine.sql',import.meta.url),'utf8'));
const users=[1,2,3,4].map(x=>'00000000-0000-4000-8000-'+String(x).padStart(12,'0'));
for(let i=0;i<users.length;i++)await db.query('insert into public.universe_profiles values($1,$2)',[users[i],`Persona ${i}`]);
await db.query('insert into public.universe_magazine_editors values($1)',[users[3]]);
async function as(i,fn){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[users[i]??'']);await db.exec('set role authenticated');try{return await fn();}finally{await db.exec('reset role');}}
async function rpc(i,command='read',input={}){return as(i,async()=> (await db.query('select public.universe_studio($1,$2) data',[command,JSON.stringify(input)])).rows[0].data);}
const spec={title:'Probar la colección',objective:'Una demostración de un probador virtual',existing:'Tenemos bocetos y diseños',contribution:'Diseño y coordinación',commitment:'3 horas semanales por seis semanas',offer:'Portfolio. Sin remuneración.',mode:'Mixto',roles:['Desarrollo','Diseño 3D'],beginners:true};
let project,application,submission,edition;
after(()=>db.close());
test('No direct table access, no anonymous RPC, verified membership and editorial roles enforced',async()=>{
 for(const table of ['projects','project_applications','project_follows','project_credits','project_messages','magazine_editors','magazine_editions','magazine_submissions'])await as(0,()=>assert.rejects(db.query(`select * from public.universe_${table}`),/permission denied/));
 await db.exec('set role anon');try{await assert.rejects(db.query('select public.universe_studio()'),/permission denied/);}finally{await db.exec('reset role');}
 await assert.rejects(rpc(8),/verificada/);
 await assert.rejects(rpc(0,'create_edition',{title:'Semana nueva',date:'2026-10-01'}),/editorial/);
 await assert.rejects(rpc(0,'create_project',{...spec,roles:[]}),/puestos/);
 await assert.rejects(rpc(0,'create_project',{...spec,roles:['Uno','Uno']}),/distinto/);
 project=(await rpc(0,'create_project',spec)).projects[0].id;
});
test('Applications stay private, require acceptance and cannot overfill a role',async()=>{
 let data=await rpc(1,'apply',{id:project,role:'Desarrollo',body:'Puedo programar el prototipo y probarlo.',availability:'Tres horas semanales',portfolio:''});
 application=data.applications[0].id;
 assert.equal((await rpc(2)).applications.length,0);
 assert.equal((await rpc(1)).projects[0].team.length,0);
 await assert.rejects(rpc(1,'team_message',{id:project,body:'Esto no debería entrar'}),/Solo el equipo/);
 await assert.rejects(rpc(1,'decide',{id:project,application,status:'accepted'}),/Solo quien/);
 data=await rpc(0,'decide',{id:project,application,status:'accepted'});
 assert.equal(data.projects[0].team[0].user_id,users[1]);
 await assert.rejects(rpc(2,'apply',{id:project,role:'Desarrollo',body:'Yo también puedo ayudar',availability:'Cuatro horas'}),/cubierto/);
 await rpc(1,'team_message',{id:project,body:'Mensaje privado del equipo'});
 assert.equal((await rpc(2)).messages.length,0);
 assert.equal((await rpc(0)).messages.length,1);
 await rpc(1,'milestone',{id:project,index:0,done:true});
 assert.equal((await rpc(2)).projects[0].milestones[0].done,true);
 await assert.rejects(rpc(2,'milestone',{id:project,index:0,done:false}),/Solo el equipo/);
 await rpc(2,'follow',{id:project,on:true});
 assert.equal((await rpc(2)).projects[0].following,true);
 assert.equal((await rpc(0)).projects[0].following,false);
});
test('Magazine proposal is an immutable, attributed permission; draft is private and editorial selection separate',async()=>{
 const proposal={title:'Un probador entre varias carreras',body:'Ya tenemos diseños. Ahora buscamos personas para construir una demostración juntas.',kind:'project',source_id:project,consent:true};
 await assert.rejects(rpc(1,'submit',proposal),/propio/);
 await assert.rejects(rpc(0,'submit',{...proposal,consent:false}),/autorizar/);
 submission=(await rpc(0,'submit',proposal)).submissions[0].id;
 assert.equal((await rpc(1)).submissions.length,0);
 const editor=await rpc(3);assert.equal(editor.submissions[0].attribution,'Persona 0');
 await assert.rejects(rpc(3,'edit_submission',{id:submission,body:'Nuevo contenido'}),/no disponible/);
 edition=(await rpc(3,'create_edition',{title:'Esta semana hacemos cosas',date:'2026-10-01'})).editions[0].id;
 await assert.rejects(rpc(3,'publish_edition',{edition}),/al menos una/);
 await rpc(3,'select',{edition,id:submission,on:true});
 assert.equal((await rpc(1)).editions.length,0);
 await rpc(3,'publish_edition',{edition});
 const publicData=await rpc(1);assert.equal(publicData.submissions[0].body,proposal.body);assert.equal(publicData.editions[0].published,true);
 await assert.rejects(rpc(3,'select',{edition,id:submission,on:false}),/borrador/);
 await assert.rejects(rpc(1,'withdraw',{id:submission}),/disponible/);
 await rpc(0,'withdraw',{id:submission});
 assert.equal((await rpc(1)).submissions.length,0);
 assert.equal((await rpc(3)).submissions.length,0);
 assert.equal((await rpc(0)).submissions[0].consent,false);
});
test('Private group posts and other authors content cannot be proposed; result closes new applications',async()=>{
 const post='10000000-0000-4000-8000-000000000001';
 await db.query('insert into public.universe_posts values($1,$2,$3)',[post,users[0],project]);
 await assert.rejects(rpc(0,'submit',{kind:'post',source_id:post,title:'Un hilo',body:'Mi texto con suficiente longitud.',consent:true}),/público propio/);
 await assert.rejects(rpc(0,'submit',{kind:'initiative',title:'Noticia',body:'Una iniciativa de la universidad.',source_url:'javascript:alert(1)',consent:true}),/fuente/);
 await assert.rejects(rpc(1,'result',{id:project,body:'Ya tenemos nuestro primer prototipo terminado.'}),/Solo quien/);
 await rpc(0,'result',{id:project,body:'Terminamos una demostración con seis prendas y pruebas de uso.',url:'https://example.com/result'});
 assert.equal((await rpc(1)).projects[0].stage,'completed');
 assert.equal((await rpc(1)).projects[0].team.length,1);
 await assert.rejects(rpc(2,'credit',{id:project,on:true}),/tu equipo/);
 await rpc(1,'credit',{id:project,on:true});
 assert.deepEqual((await rpc(1)).projects[0].credits,[users[1]]);
 await rpc(1,'credit',{id:project,on:false});
 assert.deepEqual((await rpc(1)).projects[0].credits,[]);
 await assert.rejects(rpc(2,'apply',{id:project,role:'Diseño 3D',body:'Puedo ayudar con el modelado',availability:'Lunes y jueves'}),/no admite/);
});

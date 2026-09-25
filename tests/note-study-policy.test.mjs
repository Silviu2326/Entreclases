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
for(const name of ['202609090001_university_auth','202609090002_valencia_launch','202609090003_community','202609090004_community_storage','202609270029_note_study','202609270030_meet_games_gate'])await db.exec(await readFile(new URL('../supabase/migrations/'+name+'.sql',import.meta.url),'utf8'));
await db.exec("insert into public.universe_university_domains values('campus.example.test','Campus verificado',true,'valencia')");
const ids=[1,2,3].map(n=>'00000000-0000-4000-8000-00000000000'+n);
for(let i=0;i<3;i++)await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,$3)',[ids[i],`user${i}@campus.example.test`,i===2?null:new Date().toISOString()]);
const q=(sql,args=[])=>db.query(sql,args);
async function as(role,i,run){if(i!==null)await q("select set_config('request.jwt.claim.sub',$1,false)",[ids[i]]);await db.exec(`set role ${role}`);try{return await run();}finally{await db.exec('reset role');}}
const asUser=(i,run)=>as('authenticated',i,run);
for(let i=0;i<2;i++)await asUser(i,()=>q("insert into public.universe_profiles(user_id,name,university,campus,degree,year) values($1,$2,'x','Tarongers','Economía',2)",[ids[i],`Persona ${i}`]));
const notes=[];
for(let n=0;n<8;n++)notes.push((await asUser(0,()=>q("insert into public.universe_notes(author_id,title,subject,campus,file_name,file_path,file_size) values($1,$2,'Estadística','Tarongers','tema.pdf',$3,1000) returning id",[ids[0],`Tema ${n+1}`,`${ids[0]}/${crypto.randomUUID()}.pdf`]))).rows[0].id);
const request=(i,note)=>asUser(i,async()=>(await q('select public.universe_note_study_request($1) as r',[note])).rows[0].r);
const save=(note,status,source=null,content=null)=>as('service_role',null,()=>q('select public.universe_note_study_save($1,$2,$3,$4,$5,$6,$7)',[note,status,content,'es','gpt-6-luna',3,source]));
after(()=>db.close());

test('Solo un miembro verificado pide un estudio, y recibe la ruta del PDF una vez',async()=>{
 await assert.rejects(request(2,notes[0]),/STUDY_NOT_MEMBER/);
 await assert.rejects(request(1,'00000000-0000-4000-8000-000000000999'),/STUDY_NOT_FOUND/);
 const first=await request(1,notes[0]);
 assert.equal(first.status,'claimed');assert.match(first.file_path,/\.pdf$/);assert.equal(first.subject,'Estadística');
 assert.deepEqual(await request(0,notes[0]),{status:'working'},'mientras se prepara, nadie más gasta cupo');
});

test('El resultado se comparte; el texto extraído y quién lo pidió no salen',async()=>{
 await save(notes[0],'ready','Texto completo del apunte',JSON.stringify({summary:['a']}));
 assert.deepEqual(await request(1,notes[0]),{status:'ready'});
 const row=await asUser(1,()=>q('select note_id,status,content,language,model,pages from public.universe_note_study where note_id=$1',[notes[0]]));
 assert.equal(row.rows[0].status,'ready');assert.equal(row.rows[0].model,'gpt-6-luna');
 await asUser(1,()=>assert.rejects(q('select source_text from public.universe_note_study'),/permission denied/));
 await asUser(1,()=>assert.rejects(q('select requested_by from public.universe_note_study'),/permission denied/));
 await asUser(1,()=>assert.rejects(q("update public.universe_note_study set status='failed'"),/permission denied/));
 await asUser(1,()=>assert.rejects(q("select public.universe_note_study_save($1,'failed',null,null,null,null,null)",[notes[0]]),/permission denied/));
 await asUser(1,()=>assert.rejects(q('select public.universe_note_study_source($1)',[notes[0]]),/permission denied/));
 const source=await as('service_role',null,()=>q('select public.universe_note_study_source($1) as s',[notes[0]]));
 assert.equal(source.rows[0].s,'Texto completo del apunte');
 await asUser(1,()=>assert.rejects(q('select * from public.universe_ai_usage'),/permission denied/));
 await db.exec('set role anon');try{await assert.rejects(q('select note_id from public.universe_note_study'),/permission denied/);}finally{await db.exec('reset role');}
});

test('Un intento fallido se puede repetir; uno ilegible no vuelve a gastar',async()=>{
 await request(1,notes[1]);await save(notes[1],'failed');
 assert.equal((await request(1,notes[1])).status,'claimed');
 await save(notes[1],'unreadable');
 assert.deepEqual(await request(1,notes[1]),{status:'unreadable'});
});

test('Cada persona tiene seis estudios al día y treinta preguntas',async()=>{
 // La persona 1 ya ha gastado dos (notas 0 y 1, dos veces la 1): quedan tres.
 for(const note of notes.slice(2,5))assert.equal((await request(1,note)).status,'claimed');
 await assert.rejects(request(1,notes[5]),/STUDY_DAILY_LIMIT/);
 assert.equal((await request(0,notes[5])).status,'claimed','el cupo es por persona');
 await assert.rejects(asUser(1,()=>q('select public.universe_note_ask_request($1)',[notes[5]])),/STUDY_NOT_READY/);
 for(let n=0;n<30;n++)await asUser(1,()=>q('select public.universe_note_ask_request($1)',[notes[0]]));
 await assert.rejects(asUser(1,()=>q('select public.universe_note_ask_request($1)',[notes[0]])),/STUDY_DAILY_LIMIT/);
});

test('Borrar el apunte borra su estudio',async()=>{
 await asUser(0,()=>q('delete from public.universe_notes where id=$1',[notes[0]]));
 assert.equal((await q('select * from public.universe_note_study where note_id=$1',[notes[0]])).rows.length,0);
});

test('Los juegos de conocer gente se abren con 150 personas en tu campus, sin revelar el recuento',async()=>{
 const open=i=>asUser(i,async()=>(await q('select public.universe_meet_games_open() as o')).rows[0].o);
 assert.equal(await open(0),false);
 assert.equal(await open(2),false,'sin cuenta verificada, cerrado');
 for(let n=0;n<148;n++){const id=crypto.randomUUID();await q('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,`extra${n}@campus.example.test`]);await q("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');try{await q("insert into public.universe_profiles(user_id,name,university,campus,degree,year) values($1,$2,'x',$3,'Economía',1)",[id,`Extra ${n}`,n<147?'Tarongers':'Vera']);}finally{await db.exec('reset role');}}
 assert.equal(await open(0),false,'149 en Tarongers');
 const id=crypto.randomUUID();await q('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,'extra-last@campus.example.test']);await q("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');try{await q("insert into public.universe_profiles(user_id,name,university,campus,degree,year) values($1,'Última','x','Tarongers','Economía',1)",[id]);}finally{await db.exec('reset role');}
 assert.equal(await open(0),true);
 await db.exec('set role anon');try{await assert.rejects(q('select public.universe_meet_games_open()'),/permission denied/);}finally{await db.exec('reset role');}
});

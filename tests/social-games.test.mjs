import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { demoPlay } from '../lib/community/games/demo.ts';

const db = new PGlite();
await db.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create table public.universe_profiles(user_id uuid primary key, name text);
  create function public.universe_is_member() returns boolean language sql stable as $$select auth.uid() is not null and auth.uid()<>'00000000-0000-4000-8000-000000000099'::uuid$$;
  alter default privileges in schema public grant all on tables to authenticated;
`);
await db.exec(await readFile(new URL('../supabase/migrations/202609190007_social_games.sql',import.meta.url),'utf8'));
const ids = [1,2,3,99].map(n => '00000000-0000-4000-8000-'+String(n).padStart(12,'0'));
for(let i=0;i<4;i++) await db.query('insert into public.universe_profiles values($1,$2)',[ids[i],`Persona ${i}`]);
async function as(i, fn) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[i]]);
  await db.exec('set role authenticated');
  try { return await fn(); } finally { await db.exec('reset role'); }
}
async function play(i, game, command='read', input={}) {
  return as(i,async()=> (await db.query('select public.universe_play($1,$2,$3) as rooms',[game,command,JSON.stringify(input)])).rows[0].rooms);
}
const onlyMine = rooms => rooms.find(r=>r.mine);
after(()=>db.close());

test('Tables and internal projections are private even with permissive Supabase defaults',async()=>{
  for(const name of ['rooms','moves','reports','activity']) await as(0,()=>assert.rejects(db.query(`select * from public.universe_play_${name}`),/permission denied/));
  await as(0,()=>assert.rejects(db.query("select public.universe_play_snapshot('crush')"),/permission denied/));
  await assert.rejects(play(3,'truth'),/universitaria verificada/);
  await db.exec('set role anon');
  try { await assert.rejects(db.query("select public.universe_play('truth')"),/permission denied/); } finally { await db.exec('reset role'); }
  await assert.rejects(play(0,'truth','simulate'),/no disponible/);
});

test('Truth answer stays secret until a guess; guesses are immutable; only owner deletes',async()=>{
  const room = onlyMine(await play(0,'truth','create',{options:['Una','Dos','Tres'],choice:1}));
  assert.equal(room.answer,1);
  const before=(await play(1,'truth')).find(r=>r.id===room.id);
  assert.equal(before.answer,null); assert.equal(before.my_choice,null);
  await assert.rejects(play(1,'truth','vote',{id:room.id,choice:9}),/válida/);
  const after=(await play(1,'truth','vote',{id:room.id,choice:0})).find(r=>r.id===room.id);
  assert.equal(after.answer,1); assert.equal(after.my_choice,0);
  await assert.rejects(play(1,'truth','vote',{id:room.id,choice:1}),/Ya has elegido/);
  await assert.rejects(play(1,'truth','delete',{id:room.id}),/Solo quien/);
});

test('Attraction requires opt-in; incoming interests never leak; leaving revokes choices',async()=>{
  await assert.rejects(play(0,'crush','create'),/mayor de edad/);
  const a=onlyMine(await play(0,'crush','create',{adult:true}));
  const b=onlyMine(await play(1,'crush','create',{adult:true}));
  await assert.rejects(play(2,'crush','vote',{id:a.id,choice:1}),/participación/);
  await play(0,'crush','vote',{id:b.id,choice:1});
  const secret=(await play(1,'crush')).find(r=>r.id===b.id);
  assert.deepEqual(secret.moves,[]); assert.deepEqual(secret.votes,[]); assert.equal(secret.matched,false);
  const match=(await play(1,'crush','vote',{id:a.id,choice:1})).find(r=>r.id===a.id);
  assert.equal(match.matched,true); assert.equal(match.peer_id,ids[0]);
  await play(0,'crush','delete',{id:a.id});
  const again=onlyMine(await play(0,'crush','create',{adult:true}));
  assert.equal((await play(0,'crush')).find(r=>r.id===b.id).my_choice,null);
  await play(0,'crush','delete',{id:again.id});
});

test('Questions hide senders and unpublished messages; reporting preserves evidence and blocks sender',async()=>{
  const r=onlyMine(await play(0,'questions','create'));
  await play(1,'questions','say',{id:r.id,body:'¿Café o té?'});
  assert.deepEqual((await play(2,'questions'))[0].moves,[]);
  const inbox=(await play(0,'questions'))[0]; const m=inbox.moves[0];
  assert.equal(m.label,'Anónimo'); assert.ok(!JSON.stringify(m).includes(ids[1]));
  await assert.rejects(play(2,'questions','answer',{id:r.id,move:m.id,body:'Robo'}),/no es tuyo/);
  await play(0,'questions','answer',{id:r.id,move:m.id,body:'Té'});
  assert.equal((await play(2,'questions'))[0].moves[0].reply,'Té');
  await play(1,'questions','say',{id:r.id,body:'Pregunta denunciada'});
  const pending=(await play(0,'questions'))[0].moves.find(m=>!m.reply);
  await play(0,'questions','report',{id:r.id,move:pending.id});
  const report=(await db.query('select * from public.universe_play_reports')).rows[0];
  assert.equal(report.body,'Pregunta denunciada'); assert.equal(report.sender,ids[1]);
  await assert.rejects(play(1,'questions','say',{id:r.id,body:'Otra'}),/No puedes enviar/);
});

test('Hangout capacity, private conversation, leaving and expiry are enforced',async()=>{
  const r=onlyMine(await play(0,'hangout','create',{body:'Café',place:'Biblioteca',capacity:2,minutes:15}));
  await play(1,'hangout','join',{id:r.id});
  await assert.rejects(play(2,'hangout','join',{id:r.id}),/No quedan plazas/);
  await play(1,'hangout','say',{id:r.id,body:'Ya llego'});
  assert.deepEqual((await play(2,'hangout'))[0].moves,[]);
  await assert.rejects(play(2,'hangout','say',{id:r.id,body:'Espiar'}),/Únete/);
  await play(1,'hangout','leave',{id:r.id}); await play(2,'hangout','join',{id:r.id});
  assert.equal((await play(0,'hangout'))[0].count,2);
  await db.query("update public.universe_play_rooms set expires=now()-interval '1 second' where id=$1",[r.id]);
  assert.deepEqual(await play(0,'hangout'),[]);
  await assert.rejects(play(0,'hangout','say',{id:r.id,body:'Tarde'}),/terminado/);
});

test('Debate has exactly six alternating turns; participants cannot vote',async()=>{
  const r=onlyMine(await play(0,'debate','create',{body:'Madrugar es un deporte'}));
  await assert.rejects(play(0,'debate','say',{id:r.id,body:'Uno'}),/turno/);
  await play(1,'debate','join',{id:r.id});
  await assert.rejects(play(1,'debate','say',{id:r.id,body:'Me cuelo'}),/turno/);
  await assert.rejects(play(2,'debate','vote',{id:r.id,choice:0}),/seis turnos/);
  for(let n=0;n<6;n++) await play(n%2,'debate','say',{id:r.id,body:`Argumento ${n}`});
  await assert.rejects(play(0,'debate','say',{id:r.id,body:'Siete'}),/turno/);
  await assert.rejects(play(0,'debate','vote',{id:r.id,choice:0}),/jurado/);
  assert.deepEqual((await play(2,'debate','vote',{id:r.id,choice:1}))[0].votes,[0,1]);
});

test('Jury hides aggregate and discussion until voting',async()=>{
  const r=onlyMine(await play(0,'jury','create',{body:'¿Compartes los apuntes?',options:['Sí','No']}));
  await play(0,'jury','vote',{id:r.id,choice:0});
  await play(0,'jury','say',{id:r.id,body:'Compartir ayuda'});
  const hidden=(await play(1,'jury'))[0]; assert.deepEqual(hidden.votes,[]); assert.deepEqual(hidden.moves,[]);
  await assert.rejects(play(1,'jury','say',{id:r.id,body:'Primero opino'}),/Vota antes/);
  const visible=(await play(1,'jury','vote',{id:r.id,choice:1}))[0];
  assert.deepEqual(visible.votes,[1,1]); assert.equal(visible.moves[0].body,'Compartir ayuda');
});

test('Blind date needs open window and two consents; outsiders see no room or identities',async()=>{
  await db.exec('create or replace function public.universe_play_window() returns boolean language sql as $$select false$$');
  await assert.rejects(play(0,'blind','create',{adult:true}),/jueves/);
  await db.exec('create or replace function public.universe_play_window() returns boolean language sql as $$select true$$');
  await play(0,'blind','create',{adult:true});
  // Test the matching logic at any wall-clock hour; the real window is tested above.
  await db.exec("update public.universe_play_rooms set expires=now()+interval '15 minutes' where game='blind'");
  const waiting=(await play(0,'blind'))[0];
  const paired=(await play(1,'blind','create',{adult:true}))[0]; assert.equal(paired.id,waiting.id); assert.equal(paired.count,2);
  assert.equal(paired.peer_id,null); assert.equal(paired.owner_name,'Alguien del campus');
  assert.deepEqual(await play(2,'blind'),[]);
  await assert.rejects(play(2,'blind','say',{id:paired.id,body:'Espiar'}),/privada/);
  await play(0,'blind','say',{id:paired.id,body:'Hola'});
  const masked=(await play(1,'blind'))[0]; assert.equal(masked.moves[0].label,'Tu compañía');
  assert.ok(!JSON.stringify(masked).includes(ids[0]));
  assert.equal((await play(0,'blind','reveal',{id:paired.id}))[0].revealed,false);
  const revealed=(await play(1,'blind','reveal',{id:paired.id}))[0]; assert.equal(revealed.peer_id,ids[0]); assert.equal(revealed.revealed,true);
  await play(1,'blind','leave',{id:paired.id}); assert.deepEqual(await play(0,'blind'),[]);
});

test('Demo supports truth guessing, explicit match simulation and blind mutual consent',()=>{
  const user='demo-test',name='Test';
  let truth=demoPlay('truth','read',{},user,name)[0]; assert.equal(truth.answer,null);
  truth=demoPlay('truth','vote',{id:truth.id,choice:1},user,name)[0]; assert.equal(truth.answer,1);
  let crush=demoPlay('crush','create',{adult:true},user,name).find(r=>!r.mine);
  crush=demoPlay('crush','vote',{id:crush.id,choice:2},user,name).find(r=>!r.mine); assert.equal(crush.matched,false);
  crush=demoPlay('crush','simulate',{id:crush.id,choice:2},user,name).find(r=>!r.mine); assert.equal(crush.matched,true);
  let blind=demoPlay('blind','create',{adult:true},user,name)[0];
  blind=demoPlay('blind','simulate',{id:blind.id},user,name)[0]; assert.equal(blind.count,2); assert.equal(blind.revealed,false);
  blind=demoPlay('blind','reveal',{id:blind.id},user,name)[0]; assert.equal(blind.revealed,false);
  blind=demoPlay('blind','simulate',{id:blind.id},user,name)[0]; assert.equal(blind.revealed,true);
});

test('Demo runs anonymous answers, debate turns, a hangout conversation and jury results',()=>{
  const user='demo-all-games',name='Test';
  let box=demoPlay('questions','create',{},user,name).find(r=>r.mine);
  box=demoPlay('questions','simulate',{id:box.id},user,name).find(r=>r.mine);
  assert.equal(box.moves[0].reply,'');
  box=demoPlay('questions','answer',{id:box.id,move:box.moves[0].id,body:'Un café'},user,name).find(r=>r.mine);
  assert.equal(box.moves[0].reply,'Un café');
  let debate=demoPlay('debate','read',{},user,name)[0];
  debate=demoPlay('debate','join',{id:debate.id},user,name)[0];
  assert.equal(debate.capacity,2);
  for(let n=0;n<3;n++) {
    demoPlay('debate','simulate',{id:debate.id},user,name);
    debate=demoPlay('debate','say',{id:debate.id,body:'Mi réplica'},user,name)[0];
  }
  assert.equal(debate.moves.length,6);
  assert.throws(()=>demoPlay('debate','say',{id:debate.id,body:'Otra réplica'},user,name),/turno/);
  let hangout=demoPlay('hangout','create',{body:'Café',place:'Campus',capacity:2,minutes:15},user,name).find(r=>r.mine);
  hangout=demoPlay('hangout','say',{id:hangout.id,body:'Os espero aquí'},user,name).find(r=>r.mine);
  assert.equal(hangout.moves[0].body,'Os espero aquí');
  let jury=demoPlay('jury','read',{},user,name)[0]; assert.deepEqual(jury.votes,[]);
  jury=demoPlay('jury','vote',{id:jury.id,choice:0},user,name)[0]; assert.deepEqual(jury.votes,[1,0]);
  jury=demoPlay('jury','say',{id:jury.id,body:'Hablando se entiende la gente'},user,name)[0]; assert.equal(jury.moves.length,1);
});

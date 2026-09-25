// Server rules of universe_play_v2 (migration 202609270031) for the three games it
// serves: Dos verdades y una trola, El jurado del campus and Hay hueco. The numbers in
// the test names are the requirements of docs/juegos/08-servidor.md.
import { test, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
await db.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create table public.universe_profiles(user_id uuid primary key, name text not null, campus text not null, degree text not null, year smallint not null);
  create table public.universe_groups(id uuid primary key, name text not null);
  create table public.universe_group_members(group_id uuid references public.universe_groups(id), user_id uuid references public.universe_profiles(user_id), primary key(group_id,user_id));
  create table public.universe_threads(id uuid primary key default gen_random_uuid(), user_a uuid not null, user_b uuid not null, check(user_a<user_b), unique(user_a,user_b));
  create function public.universe_is_member() returns boolean language sql stable as $$select auth.uid() is not null and auth.uid()<>'00000000-0000-4000-8000-000000000099'::uuid$$;
  alter default privileges in schema public grant all on tables to authenticated;
  alter default privileges in schema public grant all on functions to authenticated;
`);
await db.exec(await readFile(new URL('../supabase/migrations/202609270031_play_v2.sql', import.meta.url), 'utf8'));

const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const ids = Array.from({ length: 13 }, (_, n) => id(n));
const outsider = id(99);
// 0 and 1: Derecho 2º in Tarongers. 2: Medicina in Blasco Ibáñez. 3: Derecho 2º in Vera.
// 4 to 9: Derecho 1º in Tarongers. 10 to 12: Medicina 3º in Vera.
const people = [
  ['Ana', 'Tarongers', 'Derecho', 2], ['Bruno', 'Tarongers', 'Derecho', 2], ['Carla', 'Blasco Ibáñez', 'Medicina', 1], ['Dani', 'Vera', ' derecho ', 2],
  ...[4, 5, 6, 7, 8, 9].map(n => [`Persona ${n}`, 'Tarongers', 'Derecho', 1]),
  ...[10, 11, 12].map(n => [`Persona ${n}`, 'Vera', 'Medicina', 3]),
];
for (const [n, [name, campus, degree, year]] of people.entries()) await db.query('insert into public.universe_profiles values($1,$2,$3,$4,$5)', [ids[n], name, campus, degree, year]);
const group = id(500), bigGroup = id(501);
await db.query("insert into public.universe_groups values($1,'Club de lectura'),($2,'Todo Derecho')", [group, bigGroup]);
for (const n of [0, 1, 2]) await db.query('insert into public.universe_group_members values($1,$2)', [group, ids[n]]);
for (let n = 0; n < 13; n++) await db.query('insert into public.universe_group_members values($1,$2)', [bigGroup, ids[n]]);
after(() => db.close());
// The 40-per-minute limit is tested on its own; the rest of the tests should not trip it.
beforeEach(() => db.exec('delete from public.universe_game_activity'));

async function as(who, fn) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [who]);
  await db.exec('set role authenticated');
  try { return await fn(); } finally { await db.exec('reset role'); }
}
const play = (n, game, command = 'read', input = {}) => as(typeof n === 'number' ? ids[n] : n,
  async () => (await db.query('select public.universe_play_v2($1,$2,$3) as s', [game, command, JSON.stringify(input)])).rows[0].s);
const sql = (text, params) => db.query(text, params);
// Moves an item back in time as a whole, as if it had been created that long ago.
const ago = (itemIds, interval) => sql(`update public.universe_game_items set created_at=created_at-interval '${interval}',starts_at=starts_at-interval '${interval}',ends_at=ends_at-interval '${interval}' where id=any($1::uuid[])`, [itemIds]);

test('Tables and helpers stay private; only members reach the function; inactive games point to the demo', async () => {
  for (const name of ['items', 'moves', 'blocks', 'reports', 'activity']) await as(ids[0], () => assert.rejects(sql(`select * from public.universe_game_${name}`), /permission denied/));
  await as(ids[0], () => assert.rejects(sql("select public.universe_game_truth_view($1,false)", [ids[0]]), /permission denied/));
  await as(ids[0], () => assert.rejects(sql("select public.universe_game_sweep()"), /permission denied/));
  await db.exec('set role anon');
  try { await assert.rejects(sql("select public.universe_play_v2('truth')"), /permission denied/); } finally { await db.exec('reset role'); }
  await assert.rejects(play(outsider, 'truth'), /universitaria verificada/);
  await assert.rejects(play(outsider, 'truth', 'read', { locale: 'va' }), /compte universitari verificat/);
  await assert.rejects(play(0, 'poker'), /Experiencia desconocida/);
  for (const game of ['crush', 'questions', 'debate', 'blind']) {
    const error = await play(0, game).then(() => null, e => e);
    assert.equal(error?.code, '42883'); assert.match(error.message, /demo/);
  }
  await assert.rejects(play(0, 'truth', 'simulate'), /Acción desconocida/);
  await assert.rejects(play(0, 'truth', 'demoPlay', { round: id(1) }), /solo existe en la demo/);
  await assert.rejects(play(0, 'hangout', 'read', []), /Datos no válidos/);
});

test('Truth: the lie never leaves before a guess (4); audiences filter on the server (1)', async () => {
  await assert.rejects(play(0, 'truth', 'create', { cards: [{ text: 'Una' }, { text: 'Dos' }], audience: { kind: 'campus' } }), /tres frases/);
  await assert.rejects(play(0, 'truth', 'create', { cards: [{ text: 'Una' }, { text: 'una ' }, { text: 'Tres', lie: true }], audience: { kind: 'campus' } }), /distintas/);
  await assert.rejects(play(0, 'truth', 'create', { cards: [{ text: 'Una', lie: true }, { text: 'Dos', lie: true }, { text: 'Tres' }], audience: { kind: 'campus' } }), /Da la vuelta/);
  await assert.rejects(play(0, 'truth', 'create', { cards: [{ text: 'Una' }, { text: 'Dos', lie: true }, { text: 'Tres' }], audience: { kind: 'site' } }), /Elige para quién/);
  await assert.rejects(play(0, 'truth', 'create', { cards: [{ text: 'Una' }, { text: 'Dos', lie: true }, { text: 'Tres' }], audience: { kind: 'campus' }, locale: 'va' }).then(() => play(0, 'truth', 'create', { cards: [{ text: 'A' }, { text: 'B', lie: true }, { text: 'C' }], audience: { kind: 'campus' }, locale: 'va' })), /Ja tens una ronda activa/);
  const mine = (await play(0, 'truth')).mine.find(round => round.audience.kind === 'campus');
  assert.equal(mine.cards[1].lie, true); assert.equal(mine.audienceLabel, 'Todo el campus');

  const deck = (await play(2, 'truth')).deck;
  const seen = deck.find(round => round.id === mine.id);
  assert.equal(seen.owner_name, 'Ana'); assert.equal(seen.played, false);
  assert.deepEqual(seen.cards, [{ text: 'Una' }, { text: 'Dos' }, { text: 'Tres' }]);
  assert.ok(!('correct' in seen)); assert.equal(seen.deceived, 0);

  await assert.rejects(play(0, 'truth', 'play', { round: mine.id, guess: 1 }), /propia ronda/);
  await assert.rejects(play(2, 'truth', 'play', { round: mine.id, guess: 7 }), /tres cartas/);
  const played = (await play(2, 'truth', 'play', { round: mine.id, guess: 0 })).deck.find(round => round.id === mine.id);
  assert.equal(played.played, true); assert.equal(played.correct, false);
  assert.equal(played.cards[1].lie, true); assert.equal(played.cards[0].picked, true); assert.equal(played.cards[0].share, 1);
  await assert.rejects(play(2, 'truth', 'play', { round: mine.id, guess: 1 }), /Ya has jugado/);
  const author = (await play(0, 'truth')).mine.find(round => round.id === mine.id);
  assert.equal(author.playedCount, 1); assert.equal(author.deceived, 1);

  // Degree audience: same degree (normalised) sees it, another degree cannot even play it by id.
  const degree = (await play(0, 'truth', 'create', { cards: [{ text: 'X' }, { text: 'Y' }, { text: 'Z', lie: true }], audience: { kind: 'degree' } })).mine.find(round => round.audience.kind === 'degree');
  assert.equal(degree.audienceLabel, 'Derecho');
  assert.ok((await play(3, 'truth')).deck.some(round => round.id === degree.id));
  assert.ok(!(await play(2, 'truth')).deck.some(round => round.id === degree.id));
  await assert.rejects(play(2, 'truth', 'play', { round: degree.id, guess: 2 }), /ya no existe/);

  // A direct challenge reaches one person only.
  const challenge = (await play(0, 'truth', 'create', { cards: [{ text: 'P' }, { text: 'Q', lie: true }, { text: 'R' }], audience: { kind: 'person', ref: ids[10] } })).mine.find(round => round.audience.kind === 'person');
  assert.equal((await play(10, 'truth')).deck.find(round => round.id === challenge.id).audienceLabel, 'Reto directo');
  assert.ok(!(await play(1, 'truth')).deck.some(round => round.id === challenge.id));
  await assert.rejects(play(0, 'truth', 'create', { cards: [{ text: 'P' }, { text: 'Q', lie: true }, { text: 'R' }], audience: { kind: 'person', ref: ids[0] } }), /Elige a una persona/);
});

test('Truth: group rounds, streaks and expiry kept by the server (6, 7)', async () => {
  await assert.rejects(play(10, 'truth', 'startGroupRound', { group }), /formes parte/);
  const state = await play(1, 'truth', 'startGroupRound', { group });
  const entry = state.groups.find(g => g.group === group);
  assert.equal(entry.members, 3); assert.equal(entry.active, true);
  await assert.rejects(play(2, 'truth', 'startGroupRound', { group }), /ya tiene una ronda/);
  await assert.rejects(play(10, 'truth', 'create', { cards: [{ text: 'a' }, { text: 'b', lie: true }, { text: 'c' }], audience: { kind: 'group', ref: group } }), /formes parte/);
  const round = (await play(1, 'truth', 'create', { cards: [{ text: 'a' }, { text: 'b', lie: true }, { text: 'c' }], audience: { kind: 'group', ref: group } })).mine.find(r => r.audience.kind === 'group');
  assert.equal(round.groupRound, entry.id); assert.equal(round.expires, entry.expires);
  assert.ok(!(await play(10, 'truth')).deck.some(r => r.id === round.id));
  await play(2, 'truth', 'play', { round: round.id, guess: 1 });
  assert.equal((await play(2, 'truth')).streak, 1);
  await play(0, 'truth', 'play', { round: round.id, guess: 0 });
  assert.equal((await play(0, 'truth')).streak, 0);
  await ago([round.id, entry.id], '4 days');
  const done = (await play(2, 'truth')).groups.find(g => g.id === entry.id);
  assert.equal(done.finished, true); assert.deepEqual(done.summary, { mostDeceiving: 'Bruno', mostAccurate: 'Carla' });
  assert.ok(!(await play(2, 'truth')).deck.some(r => r.id === round.id));
  await assert.rejects(play(3, 'truth', 'play', { round: round.id, guess: 1 }), /ya no existe|terminado/);
});

test('Jury: votes and arguments stay hidden until voting (4); anonymous authors never leave (2, 3)', async () => {
  await assert.rejects(play(0, 'jury', 'create', { dilemma: 'Corto', audienceKind: 'campus' }), /algo más larga/);
  await assert.rejects(play(0, 'jury', 'create', { dilemma: '¿Debería contar lo del suicidio de mi compi?', audienceKind: 'campus' }), /024/);
  await assert.rejects(play(0, 'jury', 'create', { dilemma: '¿Se pueden pedir los apuntes a mitad de curso?', audienceKind: 'contacts' }), /quién juzga/);
  // Derecho 2º has two other people: too few to hide an author. Derecho has eight.
  await assert.rejects(play(0, 'jury', 'create', { dilemma: '¿Se pueden pedir los apuntes a mitad de curso?', audienceKind: 'course', anon: true }), /8 personas/);
  const created = await play(0, 'jury', 'create', { dilemma: '¿Se pueden pedir los apuntes a mitad de curso?', stanceA: 'Sí', stanceB: 'No', audienceKind: 'degree', anon: true });
  const c = created.mine[0];
  assert.equal(c.mine, true); assert.equal(c.ownerId, ''); assert.equal(c.audienceLabel, 'Derecho');
  await play(0, 'jury', 'vote', { caseId: c.id, choice: 'a' });
  await play(0, 'jury', 'argue', { caseId: c.id, side: 'a', text: 'Compartir ayuda a todo el mundo' });

  assert.ok(!(await play(2, 'jury')).deck.some(x => x.id === c.id));
  await assert.rejects(play(2, 'jury', 'vote', { caseId: c.id, choice: 'a' }), /ya no está disponible/);
  const blind = (await play(1, 'jury')).deck.find(x => x.id === c.id);
  assert.equal(blind.ownerName, 'Alguien de tu carrera pregunta');
  assert.equal(blind.totalVotes, 0); assert.deepEqual(blind.argumentsA, []); assert.equal(blind.myVote, null);
  await assert.rejects(play(1, 'jury', 'argue', { caseId: c.id, side: 'b', text: 'Primero opino' }), /Vota primero/);
  const voted = (await play(1, 'jury', 'vote', { caseId: c.id, choice: 'b' })).deck.find(x => x.id === c.id);
  assert.equal(voted.totalVotes, 2); assert.equal(voted.shareA, 0.5); assert.equal(voted.breakdownDegree, null);
  assert.equal(voted.argumentsA[0].authorName, 'Quien abrió el caso'); assert.equal(voted.argumentsA[0].authorId, '');
  assert.ok(!JSON.stringify(await play(1, 'jury')).includes(ids[0]));
  await assert.rejects(play(1, 'jury', 'argue', { caseId: c.id, side: 'a', text: 'Del otro lado' }), /lado que has votado/);
  await play(1, 'jury', 'argue', { caseId: c.id, side: 'b', text: 'Cada cual estudia lo suyo' });
  const arg = (await play(3, 'jury', 'vote', { caseId: c.id, choice: 'a' })).deck.find(x => x.id === c.id).argumentsB[0];
  assert.equal(arg.authorName, 'Bruno'); assert.equal(arg.authorId, ids[1]);
  assert.equal((await play(3, 'jury', 'support', { caseId: c.id, argumentId: arg.id })).deck.find(x => x.id === c.id).argumentsB[0].supports, 1);
  const switched = (await play(3, 'jury', 'switch', { caseId: c.id, choice: 'b' })).deck.find(x => x.id === c.id);
  assert.equal(switched.switched, true); assert.equal(switched.canSwitch, false);
  await assert.rejects(play(3, 'jury', 'switch', { caseId: c.id, choice: 'a' }), /una vez/);

  // Breakdown by degree appears only from eight votes of that degree.
  for (const n of [4, 5, 6, 7, 8]) await play(n, 'jury', 'vote', { caseId: c.id, choice: 'b' });
  const breakdown = (await play(1, 'jury')).deck.find(x => x.id === c.id).breakdownDegree;
  assert.equal(breakdown.total, 8); assert.equal(breakdown.label, 'Derecho');

  // Closes at 72 hours with a verdict, still without the author.
  await ago([c.id], '73 hours');
  await assert.rejects(play(9, 'jury', 'vote', { caseId: c.id, choice: 'a' }), /cerrado/);
  const closed = (await play(9, 'jury')).deck.find(x => x.id === c.id);
  assert.equal(closed.status, 'closed'); assert.equal(closed.verdict.result, 'b'); assert.equal(closed.verdict.switchedToB, 1);
  assert.equal(closed.verdict.bestArgumentB.authorName, 'Bruno');
  assert.ok(!JSON.stringify(closed).includes(ids[0]));
});

test('Jury: two open cases at most (7); withdrawing hides a case; groups stay inside the group (1)', async () => {
  await play(2, 'jury', 'create', { dilemma: '¿Es raro estudiar en la cafetería?', audienceKind: 'group', audienceRef: group });
  const second = (await play(2, 'jury', 'create', { dilemma: '¿Cambiamos el día de quedar del club?', audienceKind: 'campus' })).mine[0];
  await assert.rejects(play(2, 'jury', 'create', { dilemma: '¿Y un tercer caso a la vez?', audienceKind: 'campus' }), /dos casos abiertos/);
  assert.equal((await play(2, 'jury')).canCreate, false);
  const inGroup = (await play(1, 'jury')).deck.filter(x => x.audienceLabel === 'Club de lectura');
  assert.equal(inGroup.length, 1);
  assert.ok(!(await play(10, 'jury')).deck.some(x => x.audienceLabel === 'Club de lectura'));
  await assert.rejects(play(1, 'jury', 'withdraw', { caseId: second.id }), /tus propios casos/);
  await play(2, 'jury', 'withdraw', { caseId: second.id });
  assert.ok(!(await play(1, 'jury')).deck.some(x => x.id === second.id));
  assert.equal((await play(2, 'jury')).openMineCount, 1);
});

test('Hangout: audience, seats, one at a time, private chat (1, 4, 7)', async () => {
  await assert.rejects(play(0, 'hangout', 'create', { what: 'otra', place: 'cafeteria' }), /qué plan/);
  await assert.rejects(play(0, 'hangout', 'create', { what: 'cafe', place: 'cafeteria', audienceKind: 'group', audienceRef: bigGroup.replace('501', '777') }), /formes parte/);
  await assert.rejects(play(0, 'hangout', 'create', { what: 'cafe', place: 'cafeteria', startMode: 'at', startsAt: '2001-01-01T10:00:00Z' }), /hora de hoy/);
  const mine = (await play(0, 'hangout', 'create', { what: 'cafe', place: 'cafeteria', startMode: 'now', duration: 999, capacity: 2, note: 'Mesa del fondo' })).active;
  assert.equal(mine.mine, true); assert.equal(mine.capacity, 2); assert.equal(mine.runTotal, 120 * 60000); assert.equal(mine.audience.kind, 'site');
  await assert.rejects(play(0, 'hangout', 'create', { what: 'cafe', place: 'cafeteria' }), /Ya estás en un hueco/);

  // Site audience: Tarongers only.
  assert.ok(!(await play(2, 'hangout')).discover.some(x => x.id === mine.id));
  await assert.rejects(play(2, 'hangout', 'join', { id: mine.id }), /ya no existe/);
  const card = (await play(1, 'hangout')).discover.find(x => x.id === mine.id);
  assert.equal(card.whatLabel, 'Café'); assert.ok(!('messages' in card)); assert.ok(!('note' in card));
  assert.equal((await play(1, 'hangout', 'read', { locale: 'va' })).discover.find(x => x.id === mine.id).whatLabel, 'Cafè');

  const joined = (await play(1, 'hangout', 'join', { id: mine.id })).active;
  assert.equal(joined.full, true); assert.equal(joined.messages.at(-1).text, 'Bruno se ha apuntado.');
  await assert.rejects(play(4, 'hangout', 'join', { id: mine.id }), /completo/);
  await play(1, 'hangout', 'message', { id: mine.id, text: 'Voy de camino' });
  await assert.rejects(play(4, 'hangout', 'message', { id: mine.id, text: 'Espiar' }), /apuntarte/);
  await assert.rejects(play(0, 'hangout', 'leave', { id: mine.id }), /Usa «Cerrar»/);
  await assert.rejects(play(1, 'hangout', 'extend', { id: mine.id }), /Solo quien abrió/);
  const moved = (await play(0, 'hangout', 'move', { id: mine.id, place: 'otro', placeText: 'Puerta norte' })).active;
  assert.equal(moved.placeLabel, 'Puerta norte');
  const va = (await play(1, 'hangout', 'read', { locale: 'va' })).active;
  assert.equal(va.messages.at(-1).text, 'Nou lloc: Puerta norte.'); assert.equal(va.messages.at(-1).from, 'system');
  await play(1, 'hangout', 'leave', { id: mine.id });
  assert.equal((await play(4, 'hangout')).discover.find(x => x.id === mine.id).spotsLeft, 1);
  await play(0, 'hangout', 'close', { id: mine.id });
  assert.ok(!(await play(4, 'hangout')).discover.some(x => x.id === mine.id));
  assert.equal((await play(0, 'hangout')).active.closed, true);
  await play(0, 'hangout', 'leave', { id: mine.id });
  assert.equal((await play(0, 'hangout')).active, null);
});

test('Hangout: the end is read from the clock; repeat, mutual taps and chat retention (6)', async () => {
  const room = (await play(4, 'hangout', 'create', { what: 'estudiar', place: 'biblioteca', capacity: 4, audienceKind: 'degree' })).active;
  await play(5, 'hangout', 'join', { id: room.id });
  await play(6, 'hangout', 'join', { id: room.id });
  for (const n of [4, 5, 6]) await play(n, 'hangout', 'here', { id: room.id });
  await assert.rejects(play(4, 'hangout', 'repeatTap', { id: room.id, person: ids[5] }), /al terminar/);
  await ago([room.id], '3 hours');
  await assert.rejects(play(5, 'hangout', 'message', { id: room.id, text: 'Tarde' }), /terminado/);
  const repeat = (await play(4, 'hangout')).repeat;
  assert.equal(repeat.id, room.id); assert.equal(repeat.others.length, 2); assert.equal(repeat.canGroup, false);
  await assert.rejects(play(4, 'hangout', 'repeatTap', { id: room.id, person: ids[9] }), /no estuvo/);
  await play(4, 'hangout', 'repeatTap', { id: room.id, person: ids[5] });
  const mutual = (await play(5, 'hangout', 'repeatTap', { id: room.id, person: ids[4] })).repeat;
  assert.equal(mutual.others.find(o => o.id === ids[4]).mutual, true);
  assert.equal((await sql('select count(*)::int n from public.universe_threads where user_a=$1 and user_b=$2', [ids[4], ids[5]])).rows[0].n, 1);
  assert.equal((await play(6, 'hangout', 'repeatTap', { id: room.id })).repeat.canGroup, true);
  assert.equal((await play(6, 'hangout', 'repeatDone', { id: room.id })).repeat, null);
  assert.equal(await sql('select public.universe_game_sweep() n').then(r => r.rows[0].n >= 1), true);
  assert.ok((await sql("select count(*)::int n from public.universe_game_moves where item=$1 and kind='message'", [room.id])).rows[0].n > 0);
  await ago([room.id], '1 day');
  await sql('select public.universe_game_sweep()');
  assert.equal((await sql("select count(*)::int n from public.universe_game_moves where item=$1 and kind='message'", [room.id])).rows[0].n, 0);
});

test('One block list for every game, including an anonymous author (8)', async () => {
  const round = (await play(10, 'truth', 'create', { cards: [{ text: 'uno' }, { text: 'dos', lie: true }, { text: 'tres' }], audience: { kind: 'campus' } })).mine[0];
  const room = (await play(10, 'hangout', 'create', { what: 'cafe', place: 'cafeteria', audienceKind: 'campus' })).active;
  const anon = (await play(11, 'jury', 'create', { dilemma: '¿Es de mala educación comer en clase?', audienceKind: 'campus', anon: true })).mine[0];
  assert.ok((await play(12, 'truth')).deck.some(r => r.id === round.id));
  await play(12, 'truth', 'block', { person: ids[10] });
  assert.ok(!(await play(12, 'truth')).deck.some(r => r.id === round.id));
  assert.ok(!(await play(12, 'hangout')).discover.some(r => r.id === room.id));
  await assert.rejects(play(12, 'hangout', 'join', { id: room.id }), /ya no existe/);
  // The block works both ways: the blocked person does not see the blocker either.
  const theirs = (await play(12, 'truth', 'create', { cards: [{ text: 'mi' }, { text: 'tu', lie: true }, { text: 'su' }], audience: { kind: 'campus' } })).mine[0];
  assert.ok(!(await play(10, 'truth')).deck.some(r => r.id === theirs.id));

  assert.ok((await play(12, 'jury')).deck.some(c => c.id === anon.id));
  const state = await play(12, 'jury', 'block', { item: anon.id });
  assert.ok(!state.deck.some(c => c.id === anon.id)); assert.ok(!JSON.stringify(state).includes(ids[11]));
  assert.equal((await sql('select count(*)::int n from public.universe_game_blocks where blocker=$1 and blocked=$2', [ids[12], ids[11]])).rows[0].n, 1);
  await play(12, 'truth', 'unblock', { person: ids[10] });
  assert.ok((await play(12, 'truth')).deck.some(r => r.id === round.id));

  await play(12, 'truth', 'report', { item: round.id, reason: 'Habla de otra persona' });
  const report = (await sql('select * from public.universe_game_reports')).rows[0];
  assert.equal(report.accused, ids[10]); assert.equal(report.game, 'truth');
  assert.ok(!(await play(12, 'truth')).deck.some(r => r.id === round.id));
});

test('Actions per minute are counted on the server (7)', async () => {
  await sql("insert into public.universe_game_activity(actor,game,command) select $1,'truth','play' from generate_series(1,40)", [ids[7]]);
  await assert.rejects(play(7, 'truth', 'block', { person: ids[8] }), /Espera un minuto/);
  assert.ok(Array.isArray((await play(7, 'truth')).deck));
});

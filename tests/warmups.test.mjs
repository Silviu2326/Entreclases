// Rondas de calentamiento propuestas por la IA: su forma y quién las publica.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url), cache = new Map();
function load(relative) {
 let filename = resolve(root, relative);
 if (!extname(filename)) filename = ['.ts', '.tsx', '/index.ts'].map(ext => filename + ext).find(existsSync);
 if (cache.has(filename)) return cache.get(filename).exports;
 const loaded = { exports: {} }; cache.set(filename, loaded);
 const code = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
 new Function('require', 'module', 'exports', code)(path => path.startsWith('@/') ? load(path.slice(2)) : path.startsWith('.') ? load(resolve(dirname(filename), path)) : require(path), loaded, loaded.exports);
 return loaded.exports;
}
const { normalizeWarmup, warmupGames, warmupSchema, warmupShapes } = load('supabase/functions/warmup-writer/warmups.ts');
const { approvedWarmups, warmupOfDay } = load('lib/community/games/warmups.ts');
const { openings } = load('lib/community/games/openings.ts');

const p = (es, va = es + ' (va)') => ({ es, va });
test('Cada juego cambia solo lo que su tarjeta admite, con el mismo número de opciones', () => {
 for (const game of warmupGames) {
  const shape = warmupShapes[game], card = openings[game].card;
  assert.equal(shape.results, card.results.length, game);
  if (shape.options) assert.equal(shape.options, card.options.length, game);
  else assert.equal(card.options.length, shape.results, `${game}: las opciones fijas casan con los resultados`);
 }
});

test('Lo que devuelve el modelo se normaliza a pares [es, va]; lo que no encaja se descarta', () => {
 const truth = normalizeWarmup('truth', { options: [p('Uno'), p('Dos'), p('Tres')], results: [p('a'), p('b'), p('c')] });
 assert.deepEqual(truth.options[0], ['Uno', 'Uno (va)']);
 assert.equal(truth.title, undefined);
 assert.equal(normalizeWarmup('truth', { options: [p('Uno'), p('Uno'), p('Tres')], results: [p('a'), p('b'), p('c')] }), null, 'opciones repetidas');
 assert.equal(normalizeWarmup('truth', { options: [p('Uno'), p('Dos')], results: [p('a'), p('b'), p('c')] }), null);
 assert.equal(normalizeWarmup('debate', { results: [p('a'), p('b')] }), null, 'debate necesita tema');
 assert.deepEqual(normalizeWarmup('debate', { title: p('La siesta es obligatoria.'), results: [p('a'), p('b')] }).title, ['La siesta es obligatoria.', 'La siesta es obligatoria. (va)']);
 assert.equal(normalizeWarmup('jury', { title: { es: 'Algo', va: '' }, results: [p('a'), p('b')] }), null, 'falta el valenciano');
 assert.equal(normalizeWarmup('crush', { results: [] }), null, 'los juegos de conocer gente no tienen rondas de IA');
 const stored = normalizeWarmup('debate', { title: ['Tema', 'Tema va'], results: [['a', 'a va'], ['b', 'b va']] });
 assert.deepEqual(normalizeWarmup('debate', stored), stored, 'lo guardado vuelve a pasar igual');
});

test('Los esquemas son estrictos y sin maxLength', () => {
 const walk = node => {
  if (node.type === 'object') { assert.equal(node.additionalProperties, false); assert.deepEqual([...node.required].sort(), Object.keys(node.properties).sort()); Object.values(node.properties).forEach(walk); }
  if (node.type === 'array') walk(node.items);
  assert.equal('maxLength' in node, false);
 };
 for (const game of warmupGames) walk(warmupSchema(game));
});

test('La ronda del día es la misma todo el día y cambia entre días', () => {
 const pool = ['a', 'b', 'c', 'd', 'e'];
 assert.equal(warmupOfDay(pool, '2026-10-01'), warmupOfDay(pool, '2026-10-01'));
 assert.ok(new Set(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06'].map(day => warmupOfDay(pool, day))).size > 1);
 assert.equal(warmupOfDay([], '2026-10-01'), null);
 assert.equal(approvedWarmups('debate', [{ content: { title: ['x', 'y'], results: [['a', 'b'], ['c', 'd']] } }, { content: { results: [] } }]).length, 1);
 assert.deepEqual(approvedWarmups('hangout', [{ content: {} }]), []);
});

// La base de datos: solo el equipo publica, y los miembros solo ven lo aprobado.
const db = new PGlite();
await db.exec(`
 create role anon; create role authenticated; create role service_role;
 create schema auth; grant usage on schema auth to authenticated, anon;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table public.universe_profiles(user_id uuid primary key);
 create function public.universe_is_member() returns boolean language sql stable as $$select auth.uid() is not null$$;
 create function public.universe_backoffice_can(required_role text) returns boolean language sql stable as $$select auth.uid()='00000000-0000-4000-8000-000000000001'::uuid$$;
 alter default privileges in schema public grant all on tables to authenticated;
`);
await db.exec(await readFile(new URL('../supabase/migrations/202609270032_warmups.sql', import.meta.url), 'utf8'));
const [editor, member] = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'];
for (const id of [editor, member]) await db.query('insert into public.universe_profiles values($1)', [id]);
const q = (sql, args = []) => db.query(sql, args);
async function as(role, id, run) { await q("select set_config('request.jwt.claim.sub',$1,false)", [id ?? '']); await db.exec(`set role ${role}`); try { return await run(); } finally { await db.exec('reset role'); } }
const add = (game = 'debate') => as('service_role', null, async () => (await q("select public.universe_warmup_add($1,$2,'gpt-6-luna') as ok", [game, JSON.stringify({ title: ['T', 'T'], results: [['a', 'a'], ['b', 'b']] })])).rows[0].ok);
after(() => db.close());

test('La IA propone, el equipo decide y los miembros ven solo lo aprobado', async () => {
 await as('authenticated', member, () => assert.rejects(q("select public.universe_warmup_add('debate','{}','x')"), /permission denied/));
 await as('authenticated', member, () => assert.rejects(q("insert into public.universe_warmups(game,content) values('debate','{}')"), /permission denied/));
 assert.equal(await add(), true); assert.equal(await add(), true);
 await as('authenticated', member, () => assert.rejects(q('select public.universe_warmups_pending()'), /BACKOFFICE_ACCESS_REQUIRED/));
 const pending = await as('authenticated', editor, async () => (await q('select public.universe_warmups_pending() as p')).rows[0].p);
 assert.equal(pending.length, 2);
 assert.equal((await as('authenticated', member, () => q('select id from public.universe_warmups'))).rows.length, 0, 'nada visible sin aprobar');
 await as('authenticated', member, () => assert.rejects(q('select public.universe_warmup_review($1,true)', [pending[0].id]), /BACKOFFICE_ACCESS_REQUIRED/));
 await as('authenticated', editor, () => q('select public.universe_warmup_review($1,true)', [pending[0].id]));
 await as('authenticated', editor, () => q('select public.universe_warmup_review($1,false)', [pending[1].id]));
 await as('authenticated', editor, () => assert.rejects(q('select public.universe_warmup_review($1,true)', [pending[1].id]), /WARMUP_NOT_PENDING/));
 const visible = await as('authenticated', member, () => q('select id,game,content from public.universe_warmups'));
 assert.deepEqual(visible.rows.map(row => row.id), [pending[0].id]);
 await as('authenticated', member, () => assert.rejects(q('select reviewed_by from public.universe_warmups'), /permission denied/));
 await db.exec('set role anon'); try { await assert.rejects(q('select id from public.universe_warmups'), /permission denied/); } finally { await db.exec('reset role'); }
});

test('La cola de pendientes no crece sin fin', async () => {
 for (let n = 0; n < 12; n++) await add('jury');
 assert.equal(await add('jury'), false);
 assert.equal(await add('truth'), true, 'el tope es por juego');
});

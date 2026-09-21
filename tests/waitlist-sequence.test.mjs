import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile as read } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite(); after(() => db.close());
const migration = (name) => read(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');");
await db.exec(await migration('202609220019_scheduled_launch.sql'));
await db.exec(await migration('202609230020_waitlist.sql'));
await db.exec(await migration('202609240021_waitlist_sequence.sql'));
await db.exec(await migration('202609240022_waitlist_full_sequence.sql'));

const OPENS = '2026-09-28T00:00:00+02:00';
async function join(email, joined, locale = 'es') {
 const { rows } = await db.query(
  'insert into public.universe_waitlist(email,locale,created_at) values($1,$2,$3) returning id,unsubscribe_token', [email, locale, joined]);
 return rows[0];
}
const steps = async (id) => (await db.query(
 "select step, to_char(send_after at time zone 'Europe/Madrid','YYYY-MM-DD HH24:MI') as madrid from public.universe_waitlist_emails where waitlist_id=$1 order by step", [id])).rows;

test('Joining schedules the welcome now and seven mornings at 09:00 in Madrid', async () => {
 const { id } = await join('paula@alumni.uv.es', '2026-09-21T18:43:00+02:00');
 const scheduled = await steps(id);
 assert.equal(scheduled.length, 8, 'bienvenida más siete');
 assert.equal(scheduled[0].step, 0);
 // The welcome carries the moment of joining, not tomorrow morning.
 assert.equal(scheduled[0].madrid, '2026-09-21 18:43');
 assert.deepEqual(scheduled.slice(1).map(row => row.madrid), [
  '2026-09-22 09:00', '2026-09-23 09:00', '2026-09-24 09:00', '2026-09-25 09:00',
  '2026-09-26 09:00', '2026-09-27 09:00', '2026-09-28 09:00',
 ]);
 // Joining on a Monday puts day one on Tuesday, as the campaign promises.
 assert.equal(new Date('2026-09-22T09:00:00+02:00').getUTCDay(), 2);
});

test('The seven arrive whoever you are and whenever you joined', async () => {
 // Days before the opening, and months after it, the sequence is the same one.
 const late = await join('nico@alumni.uv.es', '2026-09-25T10:00:00+02:00');
 assert.deepEqual((await steps(late.id)).map(row => row.step), [0, 1, 2, 3, 4, 5, 6, 7]);
 assert.equal((await steps(late.id)).at(-1).madrid, '2026-10-02 09:00', 'nadie se queda a medias por la fecha de apertura');

 const after = await join('aina@alumni.uv.es', '2026-09-19T12:00:00+02:00');
 assert.deepEqual((await steps(after.id)).map(row => row.step), [0, 1, 2, 3, 4, 5, 6, 7]);
 const due = await db.query('select step from public.universe_waitlist_due(50) where address=$1', ['aina@alumni.uv.es']);
 assert.ok(due.rows.length >= 1);
 // Claiming is not repeatable: a second sender, a second later, finds nothing
 // of hers. This is what stops the minute cron writing to her twice.
 const again = await db.query('select 1 from public.universe_waitlist_due(50) where address=$1', ['aina@alumni.uv.es']);
 assert.equal(again.rows.length, 0, 'ya reclamado: no se entrega dos veces');
 // A sender that died holding it gets it back once the lease runs out.
 const held = (await db.query('select count(*)::int as n from public.universe_waitlist_emails where waitlist_id=$1 and claimed_at is not null', [after.id])).rows[0].n;
 await db.query("update public.universe_waitlist_emails set claimed_at = now() - interval '11 minutes' where waitlist_id=$1", [after.id]);
 const recovered = await db.query('select 1 from public.universe_waitlist_due(50) where address=$1', ['aina@alumni.uv.es']);
 assert.equal(recovered.rows.length, held, 'una entrega huérfana vuelve a la cola');
});

test('Summer time is handled by the calendar, not by adding hours', async () => {
 // Spain leaves summer time on 25/10/2026: the mornings either side are 09:00.
 await db.exec("update public.universe_signup_launch set opens_at='2026-12-01T00:00:00+01:00'");
 const { id } = await join('marc@alumni.uv.es', '2026-10-22T20:00:00+02:00');
 const mornings = await steps(id);
 assert.deepEqual(mornings.slice(1).map(row => row.madrid.slice(-5)), Array(7).fill('09:00'));
 assert.equal(mornings[4].madrid, '2026-10-26 09:00');
 // Same wall clock, different offset: the 23rd is CEST and the 26th is CET.
 const utc = (await db.query("select to_char(send_after at time zone 'UTC','HH24:MI') as at from public.universe_waitlist_emails where waitlist_id=$1 and step in (1,4) order by step", [id])).rows;
 assert.deepEqual(utc.map(row => row.at), ['07:00', '08:00']);
 await db.exec(`update public.universe_signup_launch set opens_at='${OPENS}'`);
});

test('A claimed send is reported once, retried a few times, and then left alone', async () => {
 const { id } = await join('laia@alumni.uv.es', '2026-09-20T09:00:00+02:00');
 const queued = (await db.query('select id from public.universe_waitlist_emails where waitlist_id=$1 and step=0', [id])).rows[0].id;
 const owed = async () => (await db.query('select queue_id from public.universe_waitlist_due(50) where address=$1', ['laia@alumni.uv.es'])).rows.map(row => row.queue_id);
 await db.query('select public.universe_waitlist_sent($1,$2)', [queued, 'resend 429']);
 let row = (await db.query('select sent_at, attempts, last_error from public.universe_waitlist_emails where id=$1', [queued])).rows[0];
 assert.equal(row.sent_at, null, 'un fallo no cuenta como enviado');
 assert.match(row.last_error, /429/);
 await db.query('select public.universe_waitlist_sent($1)', [queued]);
 row = (await db.query('select sent_at, last_error from public.universe_waitlist_emails where id=$1', [queued])).rows[0];
 assert.ok(row.sent_at, 'el reintento sí queda enviado');
 assert.equal(row.last_error, null);
 // Five attempts is where a dead address stops being retried for ever, while
 // the other mornings it is owed keep their turn.
 await db.query('update public.universe_waitlist_emails set sent_at=null, attempts=5 where id=$1', [queued]);
 const pending = await owed();
 assert.ok(pending.length > 0, 'los demás pasos vencidos siguen en cola');
 assert.ok(!pending.includes(queued), 'el que agotó los intentos ya no vuelve');
});

test('Unsubscribing stops everything still owed, and the queue stays private', async () => {
 const { id, unsubscribe_token } = await join('unai@alumni.uv.es', '2026-09-20T09:00:00+02:00');
 assert.equal((await db.query('select public.universe_waitlist_unsubscribe($1) as ok', [unsubscribe_token])).rows[0].ok, true);
 const due = await db.query('select 1 from public.universe_waitlist_due(50) where address=$1', ['unai@alumni.uv.es']);
 assert.equal(due.rows.length, 0, 'nada pendiente para quien se ha dado de baja');
 assert.equal((await db.query('select count(*)::int as n from public.universe_waitlist_emails where waitlist_id=$1 and sent_at is null', [id])).rows[0].n > 0, true, 'la cola se conserva como prueba');
 // An invented token must not report success.
 assert.equal((await db.query("select public.universe_waitlist_unsubscribe('00000000-0000-4000-8000-000000000000') as ok")).rows[0].ok, false);
 for (const role of ['anon', 'authenticated']) {
  await db.exec('set role ' + role);
  try {
   await assert.rejects(db.query('select * from public.universe_waitlist_emails'), /permission denied/);
   await assert.rejects(db.query('select public.universe_waitlist_due(1)'), /permission denied/);
   await assert.rejects(db.query("select public.universe_waitlist_unsubscribe('00000000-0000-4000-8000-000000000000')"), /permission denied/);
  } finally { await db.exec('reset role'); }
 }
});

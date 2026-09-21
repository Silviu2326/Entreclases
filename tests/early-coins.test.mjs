import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite(); after(() => db.close());
const sql = (name) => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');

// Only what the wallet touches: the community schema is exercised elsewhere.
await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key, email text);
 create table public.universe_profiles(user_id uuid primary key references auth.users(id) on delete cascade);
 create function public.universe_is_member() returns boolean language sql as $$ select true $$;
 create function auth.uid() returns uuid language sql as $$ select null::uuid $$;`);
await db.exec(await sql('202609220019_scheduled_launch.sql'));
// The opening gate belongs to another test: here auth.users is only a fixture.
await db.exec('drop trigger universe_00_scheduled_launch on auth.users');
await db.exec(await sql('202609230020_waitlist.sql'));
const coins = (await sql('202609090005_unicoins.sql'))
 .split('create function public.universe_coin_spend')[0]
 .replace(/create trigger universe_coin_profile_created[\s\S]*$/, '');
await db.exec(coins);
await db.exec(await sql('202609240023_early_coins.sql'));

const OPENS = Date.parse('2026-09-28T00:00:00+02:00');
let next = 1;
async function member(email, joined) {
 const id = `00000000-0000-4000-8000-${String(next++).padStart(12, '0')}`;
 await db.query('insert into auth.users(id,email) values($1,$2)', [id, email]);
 await db.query('insert into public.universe_profiles(user_id) values($1)', [id]);
 if (joined) await db.query('insert into public.universe_waitlist(email,created_at) values($1,$2)', [email.toLowerCase(), joined]);
 return id;
}
const balance = async (id) => (await db.query('select balance from public.universe_coin_wallets where user_id=$1', [id])).rows[0]?.balance;

test('Being on the list before the opening is worth thirty coins on top of the welcome', async () => {
 const early = await member('paula@alumni.uv.es', '2026-09-21T18:00:00+02:00');
 await db.query('select public.universe_coin_ensure($1)', [early]);
 assert.equal(await balance(early), 50);
 const entry = (await db.query("select reason, delta, label from public.universe_coin_ledger where user_id=$1", [early])).rows[0];
 assert.equal(entry.delta, 50);
 assert.match(entry.label, /lista/, 'el apunte dice de dónde viene el saldo');

 const plain = await member('nico@alumni.uv.es');
 await db.query('select public.universe_coin_ensure($1)', [plain]);
 assert.equal(await balance(plain), 20, 'quien no estaba en la lista empieza donde siempre');
});

test('Joining the list after the doors opened is not an early signup', async () => {
 const late = await member('aina@alumni.uv.es', '2026-10-05T10:00:00+02:00');
 assert.ok(Date.parse('2026-10-05T10:00:00+02:00') > OPENS);
 await db.query('select public.universe_coin_ensure($1)', [late]);
 assert.equal(await balance(late), 20);
});

test('The bonus is granted once and the address has to match the account', async () => {
 const twice = await member('laia@alumni.uv.es', '2026-09-20T09:00:00+02:00');
 for (let i = 0; i < 3; i++) await db.query('select public.universe_coin_ensure($1)', [twice]);
 assert.equal(await balance(twice), 50, 'llamarlo tres veces no regala tres bonos');
 assert.equal((await db.query('select count(*)::int as n from public.universe_coin_ledger where user_id=$1', [twice])).rows[0].n, 1);

 // The list stores addresses in lower case; an account written otherwise is
 // still the same person and must not miss its bonus.
 const shouting = await member('MARC@alumni.uv.es', '2026-09-20T09:00:00+02:00');
 await db.query('select public.universe_coin_ensure($1)', [shouting]);
 assert.equal(await balance(shouting), 50);

 // Somebody else's address on the list earns nothing for this account.
 const stranger = await member('unai@alumni.uv.es');
 await db.query("insert into public.universe_waitlist(email) values('ajeno@alumni.uv.es')");
 await db.query('select public.universe_coin_ensure($1)', [stranger]);
 assert.equal(await balance(stranger), 20);
});

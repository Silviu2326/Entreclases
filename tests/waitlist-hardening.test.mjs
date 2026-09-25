import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite(); after(() => db.close());
const migration = (name) => read(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8');
const read = (url, encoding) => readFile(url, encoding);
await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');");
for (const name of ['202609220019_scheduled_launch.sql','202609230020_waitlist.sql','202609240021_waitlist_sequence.sql','202609240022_waitlist_full_sequence.sql','202609260028_waitlist_blog_source.sql','202609260029_waitlist_hardening.sql']) {
 await db.exec(await migration(name));
}
async function asVisitor(query, values = []) {
 await db.exec('set role anon');
 try { return await db.query(query, values); } finally { await db.exec('reset role'); }
}

test('Anonymous clients can only join through the throttled function', async () => {
 await assert.rejects(asVisitor("insert into public.universe_waitlist(email) values('direct@alumni.uv.es')"), /permission denied/);
 const result = await asVisitor("select public.universe_join_waitlist('visitor@alumni.uv.es','es','blog') as value");
 assert.deepEqual(result.rows[0].value, { status: 'saved' });
 const duplicate = await asVisitor("select public.universe_join_waitlist('visitor@alumni.uv.es','es','landing') as value");
 assert.deepEqual(duplicate.rows[0].value, { status: 'saved' });
 assert.equal((await db.query("select count(*)::int as n from public.universe_waitlist")).rows[0].n, 1);
});

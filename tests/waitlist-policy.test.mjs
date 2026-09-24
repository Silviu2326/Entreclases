import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite(); after(() => db.close());
await db.exec("create role anon;create role authenticated;");
await db.exec(await readFile(new URL('../supabase/migrations/202609230020_waitlist.sql', import.meta.url), 'utf8'));
await db.exec(await readFile(new URL('../supabase/migrations/202609260028_waitlist_blog_source.sql', import.meta.url), 'utf8'));

async function asVisitor(role, query) {
 await db.exec('set role ' + role);
 try { return await db.query(query); } finally { await db.exec('reset role'); }
}

test('The blog is an admitted origin; anything else is not', async () => {
 await asVisitor('anon', "insert into public.universe_waitlist(email,locale,source) values('lector@alumni.uv.es','es','blog')");
 await assert.rejects(asVisitor('anon', "insert into public.universe_waitlist(email,locale,source) values('otro@alumni.uv.es','es','instagram')"), /check constraint/);
 await db.query("delete from public.universe_waitlist where email='lector@alumni.uv.es'");
});

test('A visitor can leave one address and nothing else', async () => {
 for (const role of ['anon', 'authenticated']) {
  await asVisitor(role, `insert into public.universe_waitlist(email,locale,source) values('${role}@alumni.uv.es','va','roadmap')`);
  // Reading the list, editing it or deleting from it are not visitor operations.
  await assert.rejects(asVisitor(role, 'select * from public.universe_waitlist'), /permission denied/);
  await assert.rejects(asVisitor(role, "update public.universe_waitlist set email='otro@alumni.uv.es'"), /permission denied/);
  await assert.rejects(asVisitor(role, 'delete from public.universe_waitlist'), /permission denied/);
  // The timestamp and the identifier belong to the server, not to the form.
  await assert.rejects(asVisitor(role, `insert into public.universe_waitlist(email,created_at) values('stamp.${role}@alumni.uv.es','2000-01-01')`), /permission denied/);
 }
 const { rows } = await db.query('select email,locale,source from public.universe_waitlist order by email');
 assert.deepEqual(rows, [
  { email: 'anon@alumni.uv.es', locale: 'va', source: 'roadmap' },
  { email: 'authenticated@alumni.uv.es', locale: 'va', source: 'roadmap' },
 ]);
});

test('The stored address is normalised, unique and shaped like an address', async () => {
 await assert.rejects(asVisitor('anon', "insert into public.universe_waitlist(email) values('anon@alumni.uv.es')"), /duplicate key/);
 for (const invalid of ['Paula@alumni.uv.es', 'paula alumni.uv.es', 'paula@uv', 'paula@alumni uv.es', 'a@b.c'])
  await assert.rejects(asVisitor('anon', `insert into public.universe_waitlist(email) values('${invalid}')`), /violates check constraint/, invalid);
 await assert.rejects(asVisitor('anon', "insert into public.universe_waitlist(email,locale) values('otra@alumni.uv.es','en')"), /violates check constraint/);
 await assert.rejects(asVisitor('anon', "insert into public.universe_waitlist(email,source) values('otra@alumni.uv.es','instagram')"), /violates check constraint/);
 // A personal address is welcome on the list; the door is what asks for a university.
 await asVisitor('anon', "insert into public.universe_waitlist(email) values('paula@gmail.com')");
 assert.equal((await db.query("select count(*)::int as n from public.universe_waitlist where source='landing'")).rows[0].n, 1);
});

// The browser half: what the form sends, and what it does with each answer.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), require = createRequire(import.meta.url), cache = new Map();
function load(relative) { let filename = resolve(root, relative); if (!extname(filename)) filename = ['.tsx', '.ts'].map(ext => filename + ext).find(existsSync); if (cache.has(filename)) return cache.get(filename).exports; const m = { exports: {} }; cache.set(filename, m); const code = ts.transpileModule(readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText; new Function('require', 'module', 'exports', code)(path => path.startsWith('@/') ? load(path.slice(2)) : path.startsWith('.') ? load(resolve(dirname(filename), path)) : require(path), m, m.exports); return m.exports; }

let sent, answer;
cache.set(resolve(root, 'lib/auth/client.ts'), { exports: { getPublicClient: () => ({ from: (table) => ({ insert: (row) => { sent = { table, row }; return Promise.resolve(answer); } }) }) } });
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_' + 'x'.repeat(24);

test('The form writes the address the migration expects and never invents a success', async () => {
 const { joinWaitlist, waitlistConfigured, waitlistMailto } = load('lib/launch/waitlist');
 assert.equal(waitlistConfigured, true, 'a reachable project is enough; Auth may still be closed');

 answer = { error: null };
 assert.equal(await joinWaitlist('  Paula@Alumni.UV.es ', 'va', 'roadmap'), 'saved');
 assert.deepEqual(sent, { table: 'universe_waitlist', row: { email: 'paula@alumni.uv.es', locale: 'va', source: 'roadmap' } });

 // A repeated address answers exactly like a new one: the form never reveals who signed up.
 answer = { error: { code: '23505' } };
 assert.equal(await joinWaitlist('paula@alumni.uv.es', 'es', 'landing'), 'saved');
 // A missing table is not a saved address.
 for (const code of ['42P01', 'PGRST205']) { answer = { error: { code } }; assert.equal(await joinWaitlist('otra@alumni.uv.es', 'es', 'landing'), 'unavailable'); }
 answer = { error: { code: '42501' } };
 assert.equal(await joinWaitlist('otra@alumni.uv.es', 'es', 'landing'), 'failed');

 const mailto = waitlistMailto(' Paula@Alumni.UV.es ', 'va');
 assert.match(mailto, /^mailto:hola@entreclases\.com\?subject=/);
 assert.match(decodeURIComponent(mailto), /paula@alumni\.uv\.es/);
});

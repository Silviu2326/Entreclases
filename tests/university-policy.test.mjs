import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Real PostgreSQL semantics in memory. No external users or email are created.
const db = new PGlite();
await db.exec(`
  create role anon; create role authenticated; create role supabase_auth_admin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz,
    raw_user_meta_data jsonb default '{}', is_anonymous boolean default false);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
`);
await db.exec(await readFile(new URL('../supabase/migrations/202609090001_university_auth.sql', import.meta.url), 'utf8'));
await db.exec("insert into public.universe_university_domains values ('unreviewed.example.test', 'Universidad sin revisión', true)");
await db.exec(await readFile(new URL('../supabase/migrations/202609090002_valencia_launch.sql', import.meta.url), 'utf8'));
await db.exec("insert into public.universe_university_domains values ('campus.example.test', 'Universidad de prueba', true, 'valencia'), ('other.example.test', 'Universidad fuera del lanzamiento', true, 'madrid')");
const userId='00000000-0000-4000-8000-000000000001';
after(async () => { await db.close(); });

async function asRole(role, run) {
  await db.exec(`set role ${role}`);
  try { return await run(); } finally { await db.exec('reset role'); }
}

test('Server hook accepts exact approved domains and rejects suffix lookalikes, metadata and unknown domains', async () => {
  await asRole('supabase_auth_admin', async () => {
    for (const email of ['a@gmail.com','a@campus.example.test.evil.test','a@sub.campus.example.test','a@other.example.test','a@unreviewed.example.test','a@alumni.uv.es']) {
      const r=await db.query('select public.universe_before_user_created($1::jsonb) as result',[JSON.stringify({user:{email,user_metadata:{university_verified:true,launch_region:'valencia',locale:'va'}}})]);
      assert.equal(r.rows[0].result.error.http_code,403);
    }
    const r=await db.query('select public.universe_before_user_created($1::jsonb) as result',[JSON.stringify({user:{email:'a@CAMPUS.EXAMPLE.TEST'}})]);
    assert.deepEqual(r.rows[0].result,{});
  });
});
test('Anonymous and signed-in clients cannot change domains or invoke the signup hook', async () => {
  for (const role of ['anon','authenticated']) await asRole(role, async () => {
    await assert.rejects(db.query('select * from public.universe_university_domains'), /permission denied/i);
    await assert.rejects(db.query("select public.universe_before_user_created('{}')"), /permission denied/i);
  });
  await asRole('anon', () => assert.rejects(db.query('select public.universe_current_member()'), /permission denied/i));
});
test('Database rejects direct signups and email changes that bypass the form', async () => {
  await assert.rejects(db.query('insert into auth.users(id,email) values ($1,$2)',[userId,'a@gmail.com']), /UNIVERSE_UNIVERSITY_REQUIRED/);
  await assert.rejects(db.query('insert into auth.users(id,email) values ($1,$2)',[userId,'a@other.example.test']), /UNIVERSE_UNIVERSITY_REQUIRED/);
  await db.query('insert into auth.users(id,email,raw_user_meta_data) values ($1,$2,$3)',[userId,'ana@campus.example.test',JSON.stringify({full_name:'Ana',email_verified:true,university_verified:true})]);
  await assert.rejects(db.query('update auth.users set email=$1 where id=$2',['ana@evil.test',userId]), /UNIVERSE_UNIVERSITY_REQUIRED/);
});
test('An unverified account gets no membership even with forged profile metadata', async () => {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[userId]);
  const r=await asRole('authenticated', () => db.query('select public.universe_current_member() as member'));
  assert.equal(r.rows[0].member,null);
});
test('Verified access returns only the current account and reflects domain revocation', async () => {
  await db.query('update auth.users set email_confirmed_at=now() where id=$1',[userId]);
  const valid=await asRole('authenticated', () => db.query('select public.universe_current_member() as member'));
  assert.equal(valid.rows[0].member.email,'ana@campus.example.test');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",['00000000-0000-4000-8000-000000000002']);
  const other=await asRole('authenticated', () => db.query('select public.universe_current_member() as member'));
  assert.equal(other.rows[0].member,null);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[userId]);
  await db.exec("update public.universe_university_domains set launch_region='madrid' where domain='campus.example.test'");
  const outside=await asRole('authenticated', () => db.query('select public.universe_current_member() as member'));
  assert.equal(outside.rows[0].member,null);
  await db.exec("update public.universe_university_domains set launch_region='valencia', enabled=false where domain='campus.example.test'");
  const revoked=await asRole('authenticated', () => db.query('select public.universe_current_member() as member'));
  assert.equal(revoked.rows[0].member,null);
});

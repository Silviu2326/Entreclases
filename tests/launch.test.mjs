import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { LAUNCH_TIMESTAMP, countdown, launchPhase, launchDate } from '../lib/launch/config.ts';
import { authErrorMessage } from '../lib/auth/validation.ts';

const db=new PGlite();after(()=>db.close());
await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');alter default privileges in schema public grant all on tables to authenticated;insert into auth.users(id,email) values('00000000-0000-4000-8000-000000000001','existing@example.test');`);
await db.exec(await readFile(new URL('../supabase/migrations/202609220019_scheduled_launch.sql',import.meta.url),'utf8'));
const signup=()=>db.query("insert into auth.users(id,email,raw_user_meta_data) values('00000000-0000-4000-8000-000000000002','new@example.test','{\"launch_open\":true,\"plus_one_token\":\"spoof\"}')");

test('Countdown uses the Madrid instant, clamps at zero and does not open an unready service',()=>{
 assert.equal(LAUNCH_TIMESTAMP,Date.parse('2026-09-27T22:00:00Z'));
 assert.match(launchDate('es'),/28 de septiembre/);assert.match(launchDate('va'),/28 de setembre/);
 assert.equal(countdown(null),null);assert.equal(launchPhase(null,true),'scheduled');
 assert.deepEqual(countdown(LAUNCH_TIMESTAMP-((2*86400+3*3600+4*60+5)*1000)),{days:2,hours:3,minutes:4,seconds:5});
 assert.equal(launchPhase(LAUNCH_TIMESTAMP-1,true),'scheduled');assert.equal(launchPhase(LAUNCH_TIMESTAMP,false),'pending');assert.equal(launchPhase(LAUNCH_TIMESTAMP,true),'open');
 assert.deepEqual(countdown(LAUNCH_TIMESTAMP+86400000),{days:0,hours:0,minutes:0,seconds:0});
 assert.match(authErrorMessage({message:'UNIVERSE_REGISTRATION_NOT_OPEN',code:'23514'}),/registro aún no está abierto/);
});

test('Calendar download has the same UTC start and does not claim a confirmed launch',async()=>{
 const ics=await readFile(new URL('../public/entreclases-lanzamiento.ics',import.meta.url),'utf8');
 assert.match(ics,/DTSTART:20260927T220000Z\r\n/);assert.match(ics,/STATUS:TENTATIVE/);assert.match(ics,/URL:https:\/\/www.entreclases.com\//);
 assert.ok(ics.endsWith('END:VCALENDAR\r\n'));assert.ok(ics.split('\r\n').every(line=>Buffer.byteLength(line)<=75));
});

test('Database starts closed; clients cannot enable the launch or bypass it with metadata',async()=>{
 const {rows}=await db.query('select enabled,opens_at from public.universe_signup_launch');assert.equal(rows[0].enabled,false);assert.equal(new Date(rows[0].opens_at).getTime(),LAUNCH_TIMESTAMP);
 await assert.rejects(signup(),/UNIVERSE_REGISTRATION_NOT_OPEN/);
 for(const role of ['anon','authenticated']){
  await db.exec('set role '+role);
  try{await assert.rejects(db.query('update public.universe_signup_launch set enabled=true'),/permission denied/);await assert.rejects(db.query('select * from public.universe_signup_launch'),/permission denied/);}finally{await db.exec('reset role');}
 }
});
test('The date and operator switch are both required; existing account updates remain possible',async()=>{
 await db.exec("update public.universe_signup_launch set enabled=true,opens_at=now()+interval '1 day'");await assert.rejects(signup(),/UNIVERSE_REGISTRATION_NOT_OPEN/);
 await db.exec("update public.universe_signup_launch set enabled=false,opens_at=now()-interval '1 day'");await assert.rejects(signup(),/UNIVERSE_REGISTRATION_NOT_OPEN/);
 await db.exec("update auth.users set email='updated@example.test' where id='00000000-0000-4000-8000-000000000001'");
 await db.exec('update public.universe_signup_launch set enabled=true');await signup();
 assert.equal((await db.query('select count(*)::int as n from auth.users')).rows[0].n,2);
});

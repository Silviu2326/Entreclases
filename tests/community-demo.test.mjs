import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
// Compile only local pure TypeScript modules; no browser, network or auth SDK.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function load(relative){const filename=resolve(root,relative);const source=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const module={exports:{}};new Function('require','module','exports',source)((path)=>{assert.ok(path.startsWith('.'));return load(resolve(dirname(filename),path)+'.ts');},module,module.exports);return module.exports;}
const {createDemoRepository,demoUserId}=load('lib/community/demo.ts');
const {validatePdf}=load('lib/community/validation.ts');
test('Demo changes stay in a repository instance; posts, likes and comments work without real accounts',async()=>{
 const repo=createDemoRepository('es');const other=createDemoRepository('es');const initial=await repo.read();await repo.publish('Mi primer hola','post',null);let data=await repo.read();const own=data.posts[0];assert.equal(own.author_id,demoUserId);await repo.like(own.id,true);await repo.like(own.id,true);await repo.comment(own.id,'¿Bajamos?');data=await repo.read();assert.equal(data.likes.filter(l=>l.post_id===own.id).length,1);assert.equal(data.comments.filter(c=>c.post_id===own.id).length,1);assert.equal((await other.read()).posts.length,initial.posts.length);await repo.removePost(own.id);assert.equal((await repo.read()).comments.filter(c=>c.post_id===own.id).length,0);repo.dispose();other.dispose();
});
test('Joining a plan is idempotent, leaving works, and a creator can cancel their plan',async()=>{
 const repo=createDemoRepository('va');let data=await repo.read();const plan=data.plans.find(p=>p.id==='plan-coffee');await repo.joinPlan(plan.id,true);await repo.joinPlan(plan.id,true);assert.equal((await repo.read()).planMembers.filter(m=>m.plan_id===plan.id&&m.user_id===demoUserId).length,1);await repo.joinPlan(plan.id,false);assert.equal((await repo.read()).planMembers.filter(m=>m.plan_id===plan.id&&m.user_id===demoUserId).length,0);await repo.removePlan('plan-project');assert.ok(!(await repo.read()).planMembers.some(m=>m.plan_id==='plan-project'));repo.dispose();
});
test('Demonstration conversations retain sent text and never invent replies',async()=>{
 const repo=createDemoRepository('es');const thread=await repo.openThread('demo-aina');assert.equal((await repo.messages(thread)).length,0);await repo.sendMessage(thread,'¡Hola!');const messages=await repo.messages(thread);assert.equal(messages.length,1);assert.equal(messages[0].sender_id,demoUserId);assert.equal(messages[0].body,'¡Hola!');assert.equal(await repo.openThread('demo-aina'),thread);repo.dispose();
});
test('PDF validation checks extension, MIME, size and file signature; demo downloads contain actual text',async()=>{
 await assert.rejects(validatePdf(new File(['plain text'],'fake.pdf',{type:'application/pdf'})),e=>e.code==='invalid_file');await assert.rejects(validatePdf(new File(['%PDF-1.7'],'wrong.txt',{type:'text/plain'})),e=>e.code==='invalid_file');await validatePdf(new File(['%PDF-1.7\n%%EOF'],'example.pdf',{type:'application/pdf'}));const repo=createDemoRepository('va');const note=(await repo.read()).notes[0];const url=await repo.downloadNote(note);const file=await (await fetch(url)).text();assert.match(file,/DOCUMENT D’EXEMPLE/);assert.equal(new Blob([file]).size,note.file_size);repo.dispose();await assert.rejects(fetch(url));
});

test('Unicoins debit successful creations once and keep failed actions and deleted content out of the balance',async()=>{
 const repo=createDemoRepository('es');assert.equal((await repo.read()).wallet.balance,20);
 const action=crypto.randomUUID();await repo.publish('Primer hilo con monedas','post',null,action);await repo.publish('Primer hilo con monedas','post',null,action);assert.equal((await repo.read()).wallet.balance,15);
 await repo.comment(action,'Mi respuesta no me da monedas');assert.equal((await repo.read()).wallet.balance,15);
 await repo.removePost(action);assert.equal((await repo.read()).wallet.balance,15);
 await repo.publish('Segundo hilo','post',null);await repo.publish('Tercer hilo','post',null);await repo.publish('Cuarto hilo','post',null);
 const before=await repo.read();await assert.rejects(repo.publish('Sin saldo','post',null),e=>e.message==='UNICOINS_INSUFFICIENT');assert.equal((await repo.read()).posts.length,before.posts.length);assert.equal((await repo.read()).wallet.balance,0);
 await repo.comment('post-laia','Ahora sí, una respuesta para otra persona');assert.equal((await repo.read()).wallet.balance,2);await repo.comment('post-laia','Repetir no suma');assert.equal((await repo.read()).wallet.balance,2);repo.dispose();
});
test('Unicoins reward a first event signup without paying again for leaving and rejoining',async()=>{
 const repo=createDemoRepository('va');await repo.joinPlan('plan-coffee',true);assert.equal((await repo.read()).wallet.balance,23);await repo.joinPlan('plan-coffee',false);await repo.joinPlan('plan-coffee',true);assert.equal((await repo.read()).wallet.balance,23);
 await repo.joinPlan('plan-beach',true);await repo.joinPlan('plan-albufera',true);const w=(await repo.read()).wallet;assert.equal(w.balance,26);assert.equal(w.today.events,2);assert.ok(w.claimed_events.includes('plan-albufera'));repo.dispose();
});

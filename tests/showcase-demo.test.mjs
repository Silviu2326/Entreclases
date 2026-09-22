import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'), cache=new Map();
function load(relative){const filename=resolve(root,relative.endsWith('.ts')?relative:relative+'.ts');if(cache.has(filename))return cache.get(filename).exports;const source=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const m={exports:{}};cache.set(filename,m);new Function('require','module','exports',source)(p=>p.startsWith('.')?load(resolve(dirname(filename),p).replace(root+'/','')):require(p),m,m.exports);return m.exports;}
const {createDemoRepository,demoUserId}=load('lib/community/demo');
const {youtubeId,linkHost}=load('lib/community/showcase');
const {validateShowcase}=load('lib/community/validation');
const pdf=()=>new File(['%PDF-1.7\n%%EOF'],'esquema.pdf',{type:'application/pdf'});
const png=()=>new File([new Uint8Array(64)],'foto.png',{type:'image/png'});

test('The demo hands Álex exactly what the database would: own pieces, then by audience',async()=>{
 const {showcase,profiles}=await createDemoRepository('es').read();
 const ids=showcase.map(p=>p.id);
 for(const own of ['sc-alex-yt','sc-alex-note','sc-alex-story','sc-alex-file'])assert.ok(ids.includes(own),own+' es suya y la ve');
 assert.ok(ids.includes('sc-paula-story'),'contacts: ha hablado con Paula');
 assert.ok(!ids.includes('sc-paula-note'),'only_me de Paula no se ve');
 assert.ok(ids.includes('sc-marc-note')&&ids.includes('sc-nico-link')&&ids.includes('sc-aina-media'),'everyone');
 assert.ok(!ids.includes('sc-nico-note'),'campus de Vera, Álex es de Tarongers');
 assert.ok(ids.includes('sc-laia-note'),'chosen: Laia lo eligió');
 assert.equal(ids.length,10);
 assert.equal(profiles.find(p=>p.user_id===demoUserId).showcase_frame,'madera');
 assert.equal(profiles.find(p=>p.user_id==='demo-nico').showcase_frame,'neon');
});

test('Pieces are added, edited and removed in the tab, each kind with what it needs',async()=>{
 const repo=createDemoRepository('es');
 const link=await repo.addShowcaseItem({kind:'link',title:'Un vídeo',body:'',url:'https://youtu.be/dQw4w9WgXcQ',audience:'everyone',viewers:[]});
 assert.equal(link.owner_id,demoUserId);assert.equal((await repo.read()).showcase[0].id,link.id,'lo nuevo va delante');
 await assert.rejects(repo.addShowcaseItem({kind:'story',title:'x',body:'',audience:'everyone',viewers:[]}),e=>e.code==='validation','una historia sin archivo');
 await assert.rejects(repo.addShowcaseItem({kind:'note',title:'x',body:'',audience:'everyone',viewers:[]}),e=>e.code==='validation','una nota vacía');
 await assert.rejects(repo.addShowcaseItem({kind:'link',title:'x',body:'',url:'http://inseguro.test',audience:'everyone',viewers:[]}),e=>e.code==='validation','solo https');
 const file=await repo.addShowcaseItem({kind:'file',title:'Esquema',body:'',audience:'only_me',viewers:[]},pdf());
 assert.equal(file.media_kind,'pdf');assert.match(await repo.openShowcaseFile(file),/^blob:/);
 await assert.rejects(repo.addShowcaseItem({kind:'file',title:'x',body:'',audience:'only_me',viewers:[]},new File(['no es pdf'],'x.pdf',{type:'application/pdf'})),e=>e.code==='invalid_file');
 const photo=await repo.addShowcaseItem({kind:'media',title:'',body:'',audience:'campus',viewers:[]},png());
 assert.equal(photo.media_kind,'image');assert.match(photo.media_url,/^blob:/);
 const chosen=await repo.updateShowcaseItem(link.id,{audience:'chosen',viewers:['demo-paula']});
 assert.deepEqual(chosen.viewers,['demo-paula']);
 await assert.rejects(repo.updateShowcaseItem(link.id,{audience:'chosen',viewers:[]}),e=>e.code==='validation','elegir a nadie no es elegir');
 const back=await repo.updateShowcaseItem(link.id,{audience:'everyone'});assert.deepEqual(back.viewers,[],'al salir de «elegidos» la lista se vacía');
 await assert.rejects(repo.removeShowcaseItem({...link,owner_id:'demo-paula'}),e=>e.code==='validation');
 await repo.removeShowcaseItem(photo);assert.ok(!(await repo.read()).showcase.some(p=>p.id===photo.id));
 assert.equal((await createDemoRepository('es').read()).showcase.length,10,'otra instancia no se entera');
 repo.dispose();
});

test('The finish is one of three and is saved on the profile',async()=>{
 const repo=createDemoRepository('va');
 assert.equal((await repo.saveShowcaseFrame('neon')).showcase_frame,'neon');
 assert.equal((await repo.read()).profiles[0].showcase_frame,'neon');
 await assert.rejects(repo.saveShowcaseFrame('terciopelo'),e=>e.code==='validation');
});

test('YouTube links are recognised in the shapes people paste, and nothing else is',()=>{
 for(const url of ['https://www.youtube.com/watch?v=aircAruvnKk','https://youtu.be/aircAruvnKk','https://m.youtube.com/watch?v=aircAruvnKk&t=30s','https://www.youtube.com/shorts/aircAruvnKk','https://youtube.com/embed/aircAruvnKk'])assert.equal(youtubeId(url),'aircAruvnKk',url);
 for(const url of ['https://vimeo.com/123','https://youtube.com/watch?v=short','https://notyoutube.com/watch?v=aircAruvnKk','no es una url',''])assert.equal(youtubeId(url),null,url);
 assert.equal(linkHost('https://www.github.com/x'),'github.com');
 assert.doesNotThrow(()=>validateShowcase({kind:'link',title:'',body:'',url:'https://x.test/a',audience:'everyone',viewers:[]}));
 assert.throws(()=>validateShowcase({kind:'note',title:'',body:'x',url:'https://x.test',audience:'everyone',viewers:[]}),'una nota no lleva url');
 assert.throws(()=>validateShowcase({kind:'note',title:'',body:'x',audience:'chosen',viewers:['a','a']}),'sin repetidos');
});

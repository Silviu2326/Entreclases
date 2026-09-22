import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'), cache=new Map();
function load(relative){const filename=resolve(root,relative.endsWith('.ts')?relative:relative+'.ts');if(cache.has(filename))return cache.get(filename).exports;const source=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const m={exports:{}};cache.set(filename,m);new Function('require','module','exports',source)(p=>p.startsWith('.')?load(resolve(dirname(filename),p).replace(root+'/','')):require(p),m,m.exports);return m.exports;}
const {createDemoRepository,demoUserId}=load('lib/community/demo');
const {readSpace,validateSpace,orderedBlocks,profileBlocks,visitorBlocks,defaultPlacement,clampPlacement}=load('lib/community/space');
const {removeBackground}=load('lib/community/cutout');

test('Whatever the column holds becomes a complete space; the app validates what it writes',()=>{
 assert.deepEqual(readSpace(undefined),{background:'papel',hidden:[],order:[...profileBlocks]});
 const odd=readSpace({background:'terciopelo',hidden:['network','nada','network'],order:['games','games','shelf',7]});
 assert.equal(odd.background,'papel');assert.deepEqual(odd.hidden,['network']);
 assert.deepEqual(odd.order.slice(0,2),['games','shelf']);assert.equal(odd.order.length,profileBlocks.length,'los que faltan van al final');
 assert.deepEqual(orderedBlocks(odd,visitorBlocks),['games','shelf','showcase','picks']);
 assert.throws(()=>validateSpace({background:'papel',hidden:[],order:['shelf']}),'un orden incompleto no se guarda');
 assert.throws(()=>validateSpace({background:'papel',hidden:['x'],order:[...profileBlocks]}));
 assert.doesNotThrow(()=>validateSpace({background:'noche',hidden:['plusone'],order:[...profileBlocks].reverse()}));
 assert.deepEqual(clampPlacement({x:120,y:-3,scale:9,rotation:200,z:150}),{x:100,y:0,scale:3,rotation:-160,z:99});
});

test('The demo saves the space and hands it back with the profile',async()=>{
 const repo=createDemoRepository('es');
 const before=readSpace((await repo.read()).profiles[0].space);assert.equal(before.background,'cuaderno');
 const next={background:'corcho',hidden:['network','achievements'],order:['shelf',...profileBlocks.filter(b=>b!=='shelf')]};
 assert.equal(readSpace((await repo.saveSpace(next)).space).background,'corcho');
 const after=readSpace((await repo.read()).profiles[0].space);
 assert.deepEqual(after.hidden,['network','achievements']);assert.equal(after.order[0],'shelf');
 assert.deepEqual(orderedBlocks(after).slice(0,2),['shelf','showcase']);
 await assert.rejects(repo.saveSpace({...next,background:'terciopelo'}),e=>e.code==='validation');
 assert.equal(readSpace((await repo.read()).profiles.find(p=>p.user_id==='demo-nico').space).background,'noche');
});

test('Stickers: shipped ones and own webps, moved, peeled, twelve at most',async()=>{
 const repo=createDemoRepository('es');
 assert.equal((await repo.read()).stickers.filter(s=>s.owner_id===demoUserId).length,2);
 const sun=await repo.addSticker('sol',defaultPlacement());
 assert.equal(sun.path,'builtin:sol');assert.equal(sun.url,'/stickers/sol.svg');
 await assert.rejects(repo.addSticker('dragon',defaultPlacement()),e=>e.code==='validation');
 const own=await repo.addSticker(new Blob([new Uint8Array(200)],{type:'image/webp'}),{x:10,y:20,scale:1.5,rotation:-30,z:4});
 assert.match(own.url,/^blob:/);assert.equal(own.rotation,-30);
 await assert.rejects(repo.addSticker(new Blob([new Uint8Array(200)],{type:'image/png'}),defaultPlacement()),e=>e.code==='invalid_image');
 const moved=await repo.moveSticker(sun.id,{x:90,y:80,scale:0.5,rotation:15,z:9});assert.equal(moved.x,90);
 await assert.rejects(repo.moveSticker(sun.id,{x:150,y:80,scale:0.5,rotation:15,z:9}),e=>e.code==='validation');
 await assert.rejects(repo.moveSticker('st-paula-planta',defaultPlacement()),e=>e.code==='validation','no se mueve lo ajeno');
 await assert.rejects(repo.removeSticker({...sun,owner_id:'demo-paula'}),e=>e.code==='validation');
 await repo.removeSticker(own);assert.ok(!(await repo.read()).stickers.some(s=>s.id===own.id));
 while((await repo.read()).stickers.filter(s=>s.owner_id===demoUserId).length<12)await repo.addSticker('estrella',defaultPlacement());
 await assert.rejects(repo.addSticker('sol',defaultPlacement()),e=>/STICKER_LIMIT/.test(e.message));
 repo.dispose();
});

test('The cutout removes what touches the edges and keeps what is enclosed',()=>{
 // 20×20: white paper, a red 8×8 square in the middle with a white 2×2 hole inside it.
 const w=20,h=20,data=new Uint8ClampedArray(w*h*4).fill(255);
 const set=(x,y,r,g,b)=>{const o=(y*w+x)*4;data[o]=r;data[o+1]=g;data[o+2]=b;data[o+3]=255;};
 for(let y=6;y<14;y++)for(let x=6;x<14;x++)set(x,y,200,30,30);
 for(let y=9;y<11;y++)for(let x=9;x<11;x++)set(x,y,255,255,255);
 const removed=removeBackground(data,w,h,32);
 const alpha=(x,y)=>data[(y*w+x)*4+3];
 assert.equal(alpha(0,0),0,'la esquina se va');assert.equal(alpha(19,19),0);assert.equal(alpha(2,10),0,'el papel que toca el borde se va');
 assert.equal(alpha(10,7),255,'el rojo se queda');
 assert.equal(alpha(9,9),255,'el hueco blanco encerrado no toca el borde: se queda');
 assert.equal(alpha(6,10),150,'el borde del rojo queda suavizado');
 assert.equal(removed,w*h-64,'se quita todo el papel menos el hueco');
 // A photo with a busy edge: nothing close to the seed colour, nothing removed.
 const noisy=new Uint8ClampedArray(w*h*4);for(let i=0;i<w*h;i++){noisy[i*4]=(i*37)%256;noisy[i*4+1]=(i*91)%256;noisy[i*4+2]=(i*53)%256;noisy[i*4+3]=255;}
 assert.ok(removeBackground(noisy,w,h,10)<w*h/4,'con un fondo que no es liso apenas recorta');
});

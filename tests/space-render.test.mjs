import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'), require=createRequire(import.meta.url), cache=new Map();
function load(relative){let filename=resolve(root,relative);if(!extname(filename)){filename=['.tsx','.ts','/index.ts','/index.tsx'].map(ext=>filename+ext).find(existsSync);}if(extname(filename)==='.css')return {};if(extname(filename)==='.json')return JSON.parse(readFileSync(filename,'utf8'));if(cache.has(filename))return cache.get(filename).exports;const m={exports:{}};cache.set(filename,m);const code=ts.transpileModule(readFileSync(filename,'utf8'),{fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;new Function('require','module','exports',code)(p=>p.startsWith('@/')?load(p.slice(2)):p.startsWith('.')?load(resolve(dirname(filename),p)):require(p),m,m.exports);return m.exports;}
const {CommunityContext}=load('components/community/context');
const {StudioProvider}=load('components/community/studio-context');
const {MyProfile}=load('components/community/people-profile');
const {StickerLayer}=load('components/community/space');
const {createDemoRepository,demoUserId}=load('lib/community/demo');
const {communityCopy}=load('lib/community/copy');
const {profileBlocks}=load('lib/community/space');
function render(locale,repo,data,element){const me=data.profiles.find(p=>p.user_id===demoUserId);const context={locale,c:communityCopy(locale),demo:true,member:{id:me.user_id,name:me.name,university:me.university,email:''},data,me,repo,busy:false,feedback:null,query:'',view:'profile',project:'hub',groupId:null,threadId:null,go(){},run:async()=>true,refresh:async()=>data};return renderToStaticMarkup(React.createElement(CommunityContext.Provider,{value:context},React.createElement(StudioProvider,null,element)));}

test('My profile wears its background, shows its stickers and offers the two doors to decorate',async()=>{
 const repo=createDemoRepository('es'),data=await repo.read();
 const html=render('es',repo,data,React.createElement(MyProfile));
 assert.match(html,/class="u-my-profile u-space u-space-cuaderno"/);
 assert.equal((html.match(/class="sp-sticker/g)||[]).length,2);assert.match(html,/\/stickers\/cafe\.svg/);
 assert.ok(!html.includes('sp-tools'),'sin decorar no hay herramientas');
 assert.match(html,/Personalizar mi espacio/);assert.match(html,/Decorar la portada/);
 assert.ok(html.indexOf('class="u-card sc ')<html.indexOf('network-title'),'orden por defecto: escaparate antes que tu gente');
 assert.match(render('va',createDemoRepository('va'),await createDemoRepository('va').read(),React.createElement(MyProfile)),/Personalitzar el meu espai/);
 repo.dispose();
});

test('Hidden blocks disappear and the order is the owner order',async()=>{
 const repo=createDemoRepository('es');
 await repo.saveSpace({background:'noche',hidden:['network','achievements'],order:['shelf',...profileBlocks.filter(b=>b!=='shelf')]});
 const data=await repo.read();
 const html=render('es',repo,data,React.createElement(MyProfile));
 assert.match(html,/u-space-noche/);
 assert.ok(!html.includes('network-title'),'Tu gente oculto');assert.ok(!html.includes('achievements-title'),'Logros oculto');
 assert.ok(html.indexOf('u-shelf')<html.indexOf('class="u-card sc '),'la estantería va primero');
 repo.dispose();
});

test('A visitor sees the stickers of the person; decorating mode adds the help and the grab',async()=>{
 const repo=createDemoRepository('es'),data=await repo.read();
 const paula=data.profiles.find(p=>p.user_id==='demo-paula');
 const quiet=render('es',repo,data,React.createElement(StickerLayer,{profile:paula}));
 assert.equal((quiet.match(/class="sp-sticker/g)||[]).length,1);assert.match(quiet,/\/stickers\/planta\.svg/);assert.ok(!quiet.includes('is-active'));
 const me=data.profiles.find(p=>p.user_id===demoUserId);
 const active=render('es',repo,data,React.createElement(StickerLayer,{profile:me,active:true}));
 assert.match(active,/sp-layer is-active/);assert.match(active,/Arrastra un sticker/);
 const empty=render('es',repo,{...data,stickers:[]},React.createElement(StickerLayer,{profile:paula}));
 assert.equal(empty,'','sin stickers y sin decorar, no hay capa');
 repo.dispose();
});

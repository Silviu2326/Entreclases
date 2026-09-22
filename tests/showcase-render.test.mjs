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
const {Showcase}=load('components/community/showcase');
const {createDemoRepository,demoUserId}=load('lib/community/demo');
const {communityCopy}=load('lib/community/copy');
async function page(locale,ownerId,editable,frame){
 const repo=createDemoRepository(locale),data=await repo.read(),me=data.profiles.find(p=>p.user_id===demoUserId);
 const profile={...data.profiles.find(p=>p.user_id===ownerId),...(frame?{showcase_frame:frame}:{})};
 const context={locale,c:communityCopy(locale),demo:true,member:{id:me.user_id,name:me.name,university:me.university,email:''},data,me,repo,busy:false,feedback:null,query:'',view:'profile',project:'hub',groupId:null,threadId:null,go(){},run:async()=>true,refresh:async()=>data};
 const html=renderToStaticMarkup(React.createElement(CommunityContext.Provider,{value:context},React.createElement(StudioProvider,null,React.createElement(Showcase,{profile,editable}))));
 repo.dispose();return html;
}

test('The window renders in its three finishes and shows every kind of piece without loading a player',async()=>{
 for(const frame of ['madera','cristal','neon']){
  const html=await page('es',demoUserId,true,frame);
  assert.match(html,new RegExp(`class="u-card sc sc-${frame}"`));
  assert.ok(!html.includes('[object Object]'));
  assert.match(html,/sc-awning/);assert.match(html,/sc-glass/);assert.match(html,/sc-sill/);
 }
 const html=await page('es',demoUserId,true);
 for(const kind of ['link','note','story','file'])assert.match(html,new RegExp(`sc-piece sc-piece-${kind}`),kind);
 assert.match(html,/i\.ytimg\.com\/vi\/aircAruvnKk\/hqdefault\.jpg/,'el vídeo muestra su miniatura');
 assert.ok(!html.includes('<iframe'),'nada de YouTube se carga antes de pulsar');
 assert.match(html,/Reproducir: El vídeo que le pongo a todo el mundo/);
 assert.match(html,/Abrir el PDF/,'la dueña ve su archivo aunque sea solo para ella');
 assert.match(html,/Un café con alguien nuevo cada jueves/);
 assert.match(html,/campus-walk\.webp/,'la historia lleva su imagen');
});

test('The owner gets the finish picker and the audience tools; a visitor gets neither',async()=>{
 const mine=await page('es',demoUserId,true);
 assert.equal((mine.match(/sc-swatch /g)||[]).length,3,'tres acabados');
 assert.ok((mine.match(/aria-label="Quién lo ve"/g)||[]).length>=4,'una audiencia por pieza');
 assert.match(mine,/Añadir pieza/);
 const theirs=await page('es','demo-paula',false);
 assert.ok(!theirs.includes('sc-swatch'));assert.ok(!theirs.includes('Quién lo ve'));assert.ok(!theirs.includes('Añadir pieza'));
 assert.match(theirs,/sc-cristal/,'Paula eligió cristal');
 assert.match(theirs,/Benimaclet, jueves/,'la historia para contactos: Álex ha hablado con ella');
 assert.ok(!theirs.includes('Ideas que no enseño'),'lo que es solo para ella no viaja');
 const nico=await page('es','demo-nico',false);
 assert.match(nico,/sc-neon/);assert.match(nico,/github\.com/);assert.ok(!nico.includes('Solo para Vera'));
});

test('Empty windows and the Valencian copy',async()=>{
 const repo=createDemoRepository('va'),data=await repo.read();data.showcase=[];
 const me=data.profiles[0];
 const context={locale:'va',c:communityCopy('va'),demo:true,member:{id:me.user_id,name:me.name,university:me.university,email:''},data,me,repo,busy:false,feedback:null,query:'',view:'profile',project:'hub',groupId:null,threadId:null,go(){},run:async()=>true,refresh:async()=>data};
 const html=renderToStaticMarkup(React.createElement(CommunityContext.Provider,{value:context},React.createElement(StudioProvider,null,React.createElement(Showcase,{profile:me,editable:true}))));
 assert.match(html,/L’aparador està buit\./);assert.match(html,/Fusta/);assert.match(html,/Negre i vidre/);
 repo.dispose();
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url),cache=new Map();
function load(relative){let filename=resolve(root,relative);if(!extname(filename)){filename=['.tsx','.ts','/index.ts'].map(ext=>filename+ext).find(existsSync);}if(extname(filename)==='.css')return {};if(cache.has(filename))return cache.get(filename).exports;const module={exports:{}};cache.set(filename,module);const code=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;new Function('require','module','exports',code)(path=>path.startsWith('@/')?load(path.slice(2)):path.startsWith('.')?load(resolve(dirname(filename),path)):require(path),module,module.exports);return module.exports;}
const {CommunityContext}=load('components/community/context');
const {StudioProvider}=load('components/community/studio-context');
const {createDemoRepository,demoUserId}=load('lib/community/demo');
const {communityCopy}=load('lib/community/copy');
const screens=[['home','Home'],['projects','Projects'],['magazine','Magazine'],['feed','Feed'],['plans','Plans'],['groups','Groups'],['campus','Campus'],['people-profile','People'],['people-profile','MyProfile'],['messages','Messages'],['unicoins','Unicoins']];
test('Every community screen renders in both languages with the actual UI primitives',async()=>{
 for(const locale of ['es','va']){const repo=createDemoRepository(locale),data=await repo.read(),me=data.profiles.find(p=>p.user_id===demoUserId);const context={locale,c:communityCopy(locale),demo:true,member:{id:me.user_id,name:me.name,university:me.university,email:''},data,me,repo,busy:false,feedback:null,query:'',view:'home',groupId:null,threadId:null,go(){},run:async()=>true,refresh:async()=>{}};
  for(const [file,name] of screens){const Component=load('components/community/'+file)[name];const html=renderToStaticMarkup(React.createElement(CommunityContext.Provider,{value:context},React.createElement(StudioProvider,null,React.createElement(Component))));assert.ok(html.length>100,`${name} rendered`);assert.ok(!html.includes('[object Object]'),`${name} has valid text`);if(name==='Unicoins'){assert.match(html,locale==='va'?/No es compren/:/No se compran/);assert.match(html,/ClasiCoins/);}}
  const {IconAction}=load('components/community/controls');const button=renderToStaticMarkup(React.createElement(IconAction,{label:'Enviar',type:'submit'},React.createElement('span',null,'→')));assert.match(button,/type="submit"/);assert.match(button,/aria-label="Enviar"/);
  repo.dispose();
 }
});

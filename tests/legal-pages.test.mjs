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
function load(relative){let filename=resolve(root,relative);if(!extname(filename))filename=['.tsx','.ts','/index.ts','/index.tsx'].map(ext=>filename+ext).find(existsSync);if(cache.has(filename))return cache.get(filename).exports;const loadedModule={exports:{}};cache.set(filename,loadedModule);const code=ts.transpileModule(readFileSync(filename,'utf8'),{fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;new Function('require','module','exports',code)(path=>path.startsWith('@/')?load(path.slice(2)):path.startsWith('.')?load(resolve(dirname(filename),path)):require(path),loadedModule,loadedModule.exports);return loadedModule.exports;}
const {LegalPage}=load('components/entreclase/legal-page');
const {legalTitles}=load('lib/legal/config');
const {routes}=load('lib/i18n/routes');
const {registrationLegalIssues,registrationLegalMetadata}=load('lib/legal/registration');

test('Every legal document is readable without a session, linked and available in both languages',()=>{
 for(const locale of ['es','va'])for(const kind of Object.keys(legalTitles)){
  const html=renderToStaticMarkup(React.createElement(LegalPage,{locale,kind}));
  assert.match(html,/<h1>/);assert.ok(html.length>1500);assert.ok(!html.includes('[object Object]'));
  const linked=[...html.matchAll(/href="([^"]+)"/g)].map(m=>m[1].replace(/\/$/,""));
  for(const target of Object.keys(legalTitles))assert.ok(linked.includes(routes[locale][target].replace(/\/$/,"")),`${kind} links to ${target}`);
  assert.ok(existsSync(resolve(root,`app/(${locale})${routes[locale][kind]}page.tsx`)));
  if(kind==='reports'||kind==='rights'){assert.match(html,/mailto:hola@entreclases.com\?subject=/);assert.match(html,locale==='va'?/no l’envia per tu/:/no lo envía por ti/);}
 }
});
test('Marking reviewed cannot hide missing operator information; user text is escaped',()=>{
 const names=['LEGAL_CONTROLLER_NAME','LEGAL_CONTROLLER_ADDRESS','LEGAL_CONTROLLER_TAX_ID','LEGAL_CONTROLLER_REGISTRY','LEGAL_PROVIDER_DETAILS','LEGAL_RETENTION_DETAILS','LEGAL_REVIEW_COMPLETED'];
 const saved=names.map(name=>[name,process.env[name]]);
 try{
  names.forEach(name=>delete process.env[name]);process.env.LEGAL_REVIEW_COMPLETED='true';
  assert.match(renderToStaticMarkup(React.createElement(LegalPage,{locale:'es',kind:'privacy'})),/Borrador preparado/);
  for(const name of names.filter(name=>name!=='LEGAL_REVIEW_COMPLETED'))process.env[name]='Dato ficticio de prueba';
  process.env.LEGAL_CONTROLLER_NAME='<script>test</script>';
  const html=renderToStaticMarkup(React.createElement(LegalPage,{locale:'es',kind:'legal'}));
  assert.ok(!html.includes('Borrador preparado'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>test'));
  process.env.LEGAL_REVIEW_COMPLETED='false';assert.match(renderToStaticMarkup(React.createElement(LegalPage,{locale:'va',kind:'terms'})),/Esborrany preparat/);
 }finally{for(const [name,value]of saved){if(value===undefined)delete process.env[name];else process.env[name]=value;}}
});
test('Signup requires separate terms and adult declarations, without marketing consent',()=>{
 const form=new FormData();assert.equal(Object.keys(registrationLegalIssues(form,'es')).length,2);
 form.set('termsAccepted','on');assert.deepEqual(Object.keys(registrationLegalIssues(form,'va')),['adultDeclared']);
 form.set('adultDeclared','on');assert.deepEqual(registrationLegalIssues(form,'es'),{});
 const metadata=registrationLegalMetadata();assert.equal(metadata.adult_declaration,true);assert.equal(metadata.terms_version,metadata.privacy_notice_version);assert.ok(!('marketing_consent'in metadata));
});

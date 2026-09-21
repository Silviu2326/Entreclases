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
function load(relative){let filename=resolve(root,relative);if(!extname(filename))filename=['.tsx','.ts','/index.ts','/index.tsx'].map(ext=>filename+ext).find(existsSync);if(extname(filename)==='.css')return {};if(cache.has(filename))return cache.get(filename).exports;const loadedModule={exports:{}};cache.set(filename,loadedModule);const code=ts.transpileModule(readFileSync(filename,'utf8'),{fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;new Function('require','module','exports',code)(path=>path.startsWith('@/')?load(path.slice(2)):path.startsWith('.')?load(resolve(dirname(filename),path)):path==='next/navigation'?router:require(path),loadedModule,loadedModule.exports);return loadedModule.exports;}
// The landing carries client forms: static rendering only needs the router to exist.
const router={useRouter:()=>({push(){},replace(){}}),useSearchParams:()=>new URLSearchParams(),usePathname:()=>'/'};
const {milestones,milestoneDate,milestoneState,nextMilestone,PROJECTS_AT,ANNOUNCEMENT_AT}=load('lib/launch/roadmap');
const {LAUNCH_TIMESTAMP}=load('lib/launch/config');
const {routes}=load('lib/i18n/routes');

test('The three announced dates are the ones the campaign promised',()=>{
 const [launch,projects,announcement]=milestones;
 assert.equal(launch.timestamp,LAUNCH_TIMESTAMP);
 // Two weeks after the opening, to the same minute.
 assert.equal(projects.timestamp-launch.timestamp,14*86400*1000);
 // The last Monday of October 2026: a Monday in October with no Monday left after it.
 const madrid=(value,options)=>new Intl.DateTimeFormat('es-ES',{timeZone:'Europe/Madrid',...options}).format(value);
 assert.equal(madrid(announcement.timestamp,{weekday:'long'}),'lunes');
 assert.equal(madrid(announcement.timestamp,{month:'numeric'}),'10');
 assert.equal(madrid(announcement.timestamp+7*86400*1000,{month:'numeric'}),'11');
 assert.equal(madrid(projects.timestamp,{weekday:'long'}),'lunes');
 // Written with the offset in force: Spain leaves summer time on 25/10/2026.
 assert.equal(Date.parse(PROJECTS_AT),Date.parse('2026-10-11T22:00:00Z'));
 assert.equal(Date.parse(ANNOUNCEMENT_AT),Date.parse('2026-10-25T23:00:00Z'));
 assert.match(milestoneDate(PROJECTS_AT,'es',true),/12 de octubre de 2026/);
 assert.match(milestoneDate(ANNOUNCEMENT_AT,'va',true),/26 d.octubre del? 2026/);
});

test('Without a clock nothing is announced as done; afterwards each date lands in order',()=>{
 assert.equal(nextMilestone(null).id,'launch');
 for(const milestone of milestones)assert.equal(milestoneState(null,milestone.timestamp),'later');
 assert.equal(milestoneState(LAUNCH_TIMESTAMP-1,LAUNCH_TIMESTAMP),'next');
 assert.equal(milestoneState(LAUNCH_TIMESTAMP,LAUNCH_TIMESTAMP),'done');
 const afterLaunch=LAUNCH_TIMESTAMP+1000;
 assert.equal(nextMilestone(afterLaunch).id,'projects');
 assert.equal(milestoneState(afterLaunch,milestones[1].timestamp),'next');
 assert.equal(milestoneState(afterLaunch,milestones[2].timestamp),'later');
 assert.equal(nextMilestone(milestones[2].timestamp+1),null);
});

test('The roadmap page exists in both languages with its three dates and the address form',()=>{
 const {RoadmapPage}=load('components/entreclase/roadmap-page');
 for(const locale of ['es','va']){
  const html=renderToStaticMarkup(React.createElement(RoadmapPage,{locale}));
  assert.ok(!html.includes('[object Object]'));
  assert.ok(existsSync(resolve(root,`app/(${locale})${routes[locale].roadmap}page.tsx`)));
  for(const milestone of milestones){
   assert.match(html,new RegExp(`dateTime="${milestone.at.replace('+','\\+')}"`,'i'),`${milestone.id} carries its date`);
   assert.ok(html.includes(milestone.heading[locale==='va'?1:0]),`${milestone.id} is readable in ${locale}`);
  }
  // A visitor without JavaScript still reads the dates and finds the field.
  assert.match(html,/type="email"/);
  assert.match(html,locale==='va'?/Reservar el meu lloc/:/Reservar mi sitio/);
  assert.match(html,new RegExp(`href="${routes[locale].privacy.replace(/\/$/,'')}/?"`));
  assert.ok(!/href="[^"]*\/demo\//.test(html),'the roadmap never links to the demo');
 }
});

test('No public page offers a way into the product before it opens',()=>{
 const {LandingPage}=load('components/entreclase/landing-page');
 for(const locale of ['es','va']){
  const html=renderToStaticMarkup(React.createElement(LandingPage,{locale}));
  assert.ok(!/href="[^"]*\/demo\/?[?"]/.test(html),`the ${locale} landing never links to the demo`);
  assert.match(html,new RegExp(`href="${routes[locale].roadmap.replace(/\/$/,'')}/?["#]`));
  assert.match(html,/id="entrar"/);
  assert.match(html,/type="email"/);
 }
 const sources=['components/entreclase/landing-page.tsx','components/entreclase/launch-campaign.tsx','components/entreclase/unicoins-section.tsx','components/entreclase/auth-controls.tsx','components/entreclase/signup-form.tsx','components/entreclase/landing-sections.tsx','components/entreclase/mobile-navigation.tsx'];
 for(const file of sources)assert.ok(!/["'`][^"'`]*\/demo\//.test(readFileSync(resolve(root,file),'utf8')),`${file} has no demo address`);
});

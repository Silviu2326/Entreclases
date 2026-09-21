import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), require = createRequire(import.meta.url), cache = new Map();
const router = { useRouter: () => ({ push() {}, replace() {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/' };
function load(relative) { let filename = resolve(root, relative); if (!extname(filename)) filename = ['.tsx', '.ts', '/index.ts'].map(ext => filename + ext).find(existsSync); if (extname(filename) === '.css') return {}; if (cache.has(filename)) return cache.get(filename).exports; const m = { exports: {} }; cache.set(filename, m); const code = ts.transpileModule(readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText; new Function('require', 'module', 'exports', code)(path => path.startsWith('@/') ? load(path.slice(2)) : path.startsWith('.') ? load(resolve(dirname(filename), path)) : path === 'next/navigation' ? router : require(path), m, m.exports); return m.exports; }
const { PrelaunchPage } = load('components/entreclase/prelaunch-page');
const { EARLY_COINS, WELCOME_COINS } = load('lib/community/unicoins');
const { routes } = load('lib/i18n/routes');
const pages = ['es', 'va'].map(locale => [locale, renderToStaticMarkup(React.createElement(PrelaunchPage, { locale }))]);

test('The only thing the prelaunch page asks for is an address, and it asks twice', () => {
 for (const [locale, html] of pages) {
  assert.ok(!html.includes('[object Object]'), locale);
  assert.equal(html.split('type="email"').length - 1, 2, 'el formulario está arriba y al final');
  assert.match(html, /id="entrar"/);
  // Nothing else competes for the click: no demo, no tour, no screenshots.
  assert.ok(!/href="[^"]*\/demo\/?[?"]/.test(html), 'ninguna entrada a la demo');
  assert.ok(!/href="[^"]*\/registro|href="[^"]*\/registre/.test(html), 'el registro todavía no existe para nadie');
 }
});

test('It promises the coins it can actually grant', () => {
 for (const [locale, html] of pages) {
  assert.match(html, new RegExp(`${EARLY_COINS + WELCOME_COINS} ClasiCoins`), locale);
  assert.match(html, new RegExp(`${WELCOME_COINS}`));
  // The number comes from the same module the database mirrors in migration 023.
  assert.equal(EARLY_COINS + WELCOME_COINS, 50);
  assert.match(html, locale === 'va' ? /moneda oficial/ : /moneda oficial/);
  assert.match(html, locale === 'va' ? /Per a què servixen ho descobriràs/ : /Para qué sirven lo descubrirás/);
 }
});

test('It keeps the product to itself: no feature tour, no screens, no prices', () => {
 const forbidden = [/ClasiCoins de bienvenida/, /Probar las ClasiCoins/, /pestañas/, /Crear mi cuenta/, /preguntas frecuentes/i];
 for (const [locale, html] of pages) {
  for (const pattern of forbidden) assert.ok(!pattern.test(html), `${locale} no enseña ${pattern}`);
  // The dates page is the one place that says more, and it is one click away.
  assert.match(html, new RegExp(`href="${routes[locale].roadmap.replace(/\/$/, '')}/?"`));
 }
});

test('The finished landing comes back with the opening, without touching the code', () => {
 const mode = readFileSync(resolve(root, 'lib/launch/landing-mode.ts'), 'utf8');
 assert.match(mode, /NEXT_PUBLIC_LAUNCH_OPEN/, 'la apertura devuelve la portada completa');
 for (const locale of ['es', 'va']) {
  const page = readFileSync(resolve(root, `app/(${locale})${routes[locale].home}page.tsx`), 'utf8');
  assert.match(page, /LandingPage/);
  assert.match(page, /PrelaunchPage/);
 }
 // The full landing is untouched and still renders.
 const { LandingPage } = load('components/entreclase/landing-page');
 assert.ok(renderToStaticMarkup(React.createElement(LandingPage, { locale: 'es' })).length > 5000);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), cache = new Map();
function load(relative) { let filename = resolve(root, relative); if (!existsSync(filename)) filename = ['.ts'].map(ext => filename + ext).find(existsSync); if (cache.has(filename)) return cache.get(filename).exports; const m = { exports: {} }; cache.set(filename, m); const code = ts.transpileModule(readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText; new Function('require', 'module', 'exports', code)(path => load(resolve(dirname(filename), path)), m, m.exports); return m.exports; }
const { letterFor, render } = load('supabase/functions/waitlist-mailer/render.ts');
const ORIGIN = 'https://www.entreclases.com', AWAY = 'https://ref.functions.supabase.co/waitlist-mailer';
const TOKEN = '11111111-2222-4333-8444-555555555555';

test('Every step has a letter in both languages, signed and long enough to be a letter', () => {
 for (const language of ['es', 'va']) {
  for (let step = 0; step <= 7; step++) {
   const letter = letterFor(language, step, false);
   assert.ok(letter, `${language} paso ${step}`);
   assert.ok(letter.subject.length > 8 && letter.subject.length <= 60, `asunto de ${language}/${step}: ${letter.subject.length} caracteres`);
   assert.ok(letter.body.trimEnd().endsWith('Silviu') || letter.body.includes('\nSilviu\n'), `${language}/${step} va firmado`);
   assert.ok(letter.body.length > 400, `${language}/${step} tiene cuerpo`);
  }
  assert.equal(letterFor(language, 8, false), null, 'no hay un octavo paso');
  // The welcome knows whether a sequence follows it.
  const alone = letterFor(language, 0, true), accompanied = letterFor(language, 0, false);
  assert.notEqual(alone.subject, accompanied.subject);
  assert.ok(/siete|set/.test(accompanied.body), 'la bienvenida normal anuncia los siete');
  assert.ok(!/siete matins|siete mañanas|set matins/.test(alone.body), 'la bienvenida tardía no promete lo que no habrá');
 }
});

test('Both languages tell the same story, in their own words', () => {
 const es = letterFor('es', 7, false), va = letterFor('va', 7, false);
 assert.notEqual(es.body, va.body);
 for (const letter of [es, va]) assert.match(letter.body, /28/);
 assert.match(letterFor('va', 3, false).body, /Túria|Malva-rosa/, 'los topónimos van en valenciano');
 assert.match(letterFor('es', 3, false).body, /Turia|Malvarrosa/);
 // No leftover placeholder reaches an inbox.
 for (const language of ['es', 'va']) for (let step = 0; step <= 7; step++) {
  const mail = render(letterFor(language, step, false), language, ORIGIN, AWAY, TOKEN);
  assert.ok(!mail.text.includes('{{'), `${language}/${step} sin marcadores sin sustituir`);
  assert.ok(!mail.html.includes('{{'));
 }
});

test('Every message carries a working way out and escapes what it prints', () => {
 for (const language of ['es', 'va']) {
  const mail = render(letterFor(language, 1, false), language, ORIGIN, AWAY, TOKEN);
  assert.equal(mail.away, `${AWAY}?baja=${TOKEN}&l=${language}`);
  assert.ok(mail.text.includes(mail.away), 'la versión de texto también lleva la baja');
  assert.ok(mail.html.includes(`href="${mail.away.replace(/&/g, '&amp;')}"`), 'el enlace va escapado en el HTML');
  assert.match(mail.html, language === 'va' ? /lang="ca-ES-valencia"/ : /lang="es"/);
  assert.ok(mail.html.startsWith('<!doctype html>'));
 }
 // A letter is never injected into its own HTML.
 const hostile = render({ subject: 'x', body: 'Hola <script>alert(1)</script> & "comillas"' }, 'es', ORIGIN, AWAY, TOKEN);
 assert.ok(!hostile.html.includes('<script>'));
 assert.match(hostile.html, /&lt;script&gt;/);
 assert.match(hostile.html, /&amp;/);
});

test('The site link points at the reader own language', () => {
 assert.match(render(letterFor('es', 0, true), 'es', ORIGIN, AWAY, TOKEN).text, new RegExp(ORIGIN + '/\\n'));
 assert.match(render(letterFor('va', 0, true), 'va', ORIGIN, AWAY, TOKEN).text, new RegExp(ORIGIN + '/va/'));
});

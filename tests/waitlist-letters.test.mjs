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

test('Every step has a letter in both languages, unsigned and long enough to be a letter', () => {
 for (const language of ['es', 'va']) {
  for (let step = 0; step <= 7; step++) {
   const letter = letterFor(language, step);
   assert.ok(letter, `${language} paso ${step}`);
   assert.ok(letter.subject.length > 8 && letter.subject.length <= 60, `asunto de ${language}/${step}: ${letter.subject.length} caracteres`);
   // Las cartas no van firmadas: el remitente ya dice quién escribe.
   assert.ok(!/Silviu/.test(letter.body + letter.subject), `${language}/${step} sin firma`);
   assert.ok(!/\n\n\n/.test(letter.body), `${language}/${step} sin huecos dobles donde estaba la firma`);
   assert.match(letter.body.trimEnd(), /[.!?»]$/, `${language}/${step} cierra en una frase acabada`);
   assert.ok(letter.body.length > 400, `${language}/${step} tiene cuerpo`);
  }
  assert.equal(letterFor(language, 8), null, 'no hay un octavo paso');
  // The welcome promises the seven and the coins, and that promise is true
  // for everyone: the sequence no longer depends on the calendar.
  const welcome = letterFor(language, 0);
  assert.ok(/siete|set/.test(welcome.body), 'la bienvenida anuncia los siete');
  assert.match(welcome.body, /50/, 'y el saldo de quien se apunta antes');
  assert.match(welcome.body, /ClasiCoins/);
 }
});

test('Both languages tell the same story, in their own words', () => {
 const es = letterFor('es', 7), va = letterFor('va', 7);
 assert.notEqual(es.body, va.body);
 // No letter hangs on a date that will have passed by the time somebody reads
 // it: these introduce the platform, they are not a countdown.
 for (const language of ['es', 'va']) for (let step = 0; step <= 7; step++) {
  const { subject, body } = letterFor(language, step);
  assert.ok(!/28 de sep|28 de set|12 de oct|12 d.oct|26 de oct|26 d.oct/.test(body + subject), `${language}/${step} sin fechas que caduquen`);
 }
 assert.match(letterFor('va', 3).body, /Túria|Malva-rosa/, 'los topónimos van en valenciano');
 assert.match(letterFor('es', 3).body, /Turia|Malvarrosa/);
 // No leftover placeholder reaches an inbox.
 for (const language of ['es', 'va']) for (let step = 0; step <= 7; step++) {
  const mail = render(letterFor(language, step), language, ORIGIN, AWAY, TOKEN);
  assert.ok(!mail.text.includes('{{'), `${language}/${step} sin marcadores sin sustituir`);
  assert.ok(!mail.html.includes('{{'));
 }
});

test('Every message carries a working way out and escapes what it prints', () => {
 for (const language of ['es', 'va']) {
  const mail = render(letterFor(language, 1), language, ORIGIN, AWAY, TOKEN);
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
 assert.match(render(letterFor('es', 7), 'es', ORIGIN, AWAY, TOKEN).text, new RegExp(ORIGIN + '/\\n'));
 assert.match(render(letterFor('va', 7), 'va', ORIGIN, AWAY, TOKEN).text, new RegExp(ORIGIN + '/va/'));
});

// Lo que devuelve la IA se comprueba antes de guardarlo y antes de pintarlo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';

// El mismo cargador que tests/game-demos.test.mjs: solo módulos locales y puros.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url), cache = new Map();
function load(relative) {
 let filename = resolve(root, relative);
 if (!extname(filename)) filename = ['.ts', '.tsx', '/index.ts'].map(ext => filename + ext).find(existsSync);
 if (cache.has(filename)) return cache.get(filename).exports;
 const loaded = { exports: {} }; cache.set(filename, loaded);
 const code = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
 new Function('require', 'module', 'exports', code)(path => path.startsWith('@/') ? load(path.slice(2)) : path.startsWith('.') ? load(resolve(dirname(filename), path)) : require(path), loaded, loaded.exports);
 return loaded.exports;
}
const { normalizeStudy, sourceVerdict, studySchema, tidySource } = load('supabase/functions/note-study/study.ts');
const { challengeText, demoNoteStudy, studyLink, toNoteStudy } = load('lib/community/study.ts');

const question = n => ({ question: `Pregunta ${n}`, options: ['A', 'B', 'C', 'D'], answer: n % 4, why: 'Porque sí.' });
const good = { language: 'es', summary: ['Uno', 'Dos', 'Tres'], cards: [1, 2, 3, 4, 5, 6].map(n => ({ front: `F${n}`, back: `B${n}` })), quiz: [1, 2, 3, 4, 5].map(question) };

test('Un estudio completo pasa tal cual', () => {
 assert.deepEqual(normalizeStudy(good), good);
});

test('Las piezas rotas se descartan y, si queda poco, no se guarda', () => {
 const broken = { ...good, quiz: [...good.quiz, { ...question(6), options: ['A', 'A', 'B', 'C'] }, { ...question(7), answer: 4 }, { ...question(8), options: ['A', 'B', 'C'] }] };
 assert.equal(normalizeStudy(broken).quiz.length, 5);
 assert.equal(normalizeStudy({ ...good, quiz: good.quiz.slice(0, 4) }), null);
 assert.equal(normalizeStudy({ ...good, summary: ['Uno', ''] }), null);
 assert.equal(normalizeStudy('texto'), null);
 assert.equal(normalizeStudy({ ...good, language: 'fr' }).language, 'other');
});

test('Los textos se recortan y los espacios se compactan', () => {
 const long = normalizeStudy({ ...good, summary: ['  Uno \n dos  ', 'x'.repeat(900), 'Tres'] });
 assert.equal(long.summary[0], 'Uno dos');
 assert.equal(long.summary[1].length, 400);
});

test('El esquema es estricto: todo obligatorio y sin campos extra', () => {
 const walk = node => {
  if (node.type === 'object') { assert.equal(node.additionalProperties, false); assert.deepEqual([...node.required].sort(), Object.keys(node.properties).sort()); Object.values(node.properties).forEach(walk); }
  if (node.type === 'array') walk(node.items);
  assert.equal('maxLength' in node, false);
 };
 walk(studySchema);
});

test('Un PDF sin texto o demasiado largo no llega a la IA', () => {
 assert.equal(sourceVerdict(3, ' \n '.repeat(50)), 'unreadable');
 assert.equal(sourceVerdict(81, 'x'.repeat(1000)), 'too_long');
 assert.equal(sourceVerdict(10, 'x'.repeat(1000)), 'ok');
 assert.equal(tidySource(['a   b\n\n\n\nc', '', 'd']), 'a b\n\nc\n\n---\n\nd');
});

test('El cliente no pinta un estudio «listo» con contenido roto', () => {
 assert.deepEqual(toNoteStudy({ status: 'ready', content: { summary: [] } }), { status: 'failed', content: null });
 assert.deepEqual(toNoteStudy({ status: 'working', content: null }), { status: 'working', content: null });
 assert.equal(toNoteStudy({ status: 'otro' }), null);
 assert.equal(toNoteStudy(null), null);
});

test('El reto enlaza al apunte en Campus, en cada idioma', () => {
 assert.equal(studyLink('es', false, 'abc', 'https://www.entreclases.com'), 'https://www.entreclases.com/app/?view=campus&nota=abc');
 assert.match(studyLink('va', true, 'abc', 'https://www.entreclases.com'), /\/va\/demo\/\?view=campus&nota=abc$/);
 assert.match(challengeText('va', 'Tema 4', 7, 10), /He fet 7\/10/);
 assert.match(challengeText('es', 'Tema 4', 7, 10), /He sacado 7\/10 en el test de «Tema 4»/);
});

test('La demo trae un estudio válido en los dos idiomas', () => {
 for (const locale of ['es', 'va']) assert.ok(normalizeStudy(demoNoteStudy(locale).content));
});

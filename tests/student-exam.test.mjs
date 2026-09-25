import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { renderToStaticMarkup } from 'react-dom/server';

// Same TS-over-CommonJS loader as game-summary.test.mjs: notes.ts is plain
// logic plus a couple of React hooks, so it can be transpiled and required
// directly, without a bundler and without touching the browser-only bits
// (they only run inside the hook, never at module load time).
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

const { gradeQuiz, wrongQuestionIds, shareText, combineNotes, renderMarkdown } = load('lib/community/student/notes.ts');

const t = (es, va) => es; // the tests only check the Spanish copy that gradeQuiz produces

function sampleQuiz() {
  return [
    { id: 'q1', topic: 'Tema 1', question: '¿Capital de Francia?', options: ['Madrid', 'París', 'Roma'], answer: 1, explanation: 'París es la capital.' },
    { id: 'q2', topic: 'Tema 1', question: '¿La Tierra es plana?', options: ['Verdadero', 'Falso'], answer: 1, explanation: 'Es un geoide.' },
    { id: 'q3', topic: 'Tema 2', question: 'Explica la fotosíntesis.', answer: 'Las plantas convierten luz en energía.', explanation: 'Ocurre en los cloroplastos.' },
  ];
}

test('gradeQuiz scores options by index and short questions by self-assessment', () => {
  const quiz = sampleQuiz();
  // q1 right, q2 wrong (picks "Verdadero", index 0, but the correct index is 1), q3 self-graded as known.
  const answers = { q1: 1, q2: 0, q3: 1 };
  const result = gradeQuiz(quiz, answers, t);
  assert.equal(result.total, 3);
  assert.equal(result.correct, 2);
  assert.equal(result.score, 67); // round(2/3 * 100)
  assert.equal(result.review.length, 1);
  assert.equal(result.review[0].id, 'q2');
  assert.equal(result.review[0].yours, 'Verdadero');
  assert.equal(result.review[0].right, 'Falso');
  assert.equal(result.review[0].explanation, 'Es un geoide.');
});

test('gradeQuiz groups by topic and levels dominado/bien/flojo correctly', () => {
  const quiz = sampleQuiz();
  const result = gradeQuiz(quiz, { q1: 1, q2: 0, q3: 1 }, t);
  const tema1 = result.byTopic.find(topic => topic.topic === 'Tema 1');
  const tema2 = result.byTopic.find(topic => topic.topic === 'Tema 2');
  assert.deepEqual(tema1, { topic: 'Tema 1', correct: 1, total: 2, level: 'ok' });
  assert.deepEqual(tema2, { topic: 'Tema 2', correct: 1, total: 1, level: 'strong' });

  const allWrong = gradeQuiz(quiz, {}, t);
  assert.equal(allWrong.byTopic.find(topic => topic.topic === 'Tema 1').level, 'weak');
});

test('gradeQuiz treats an unanswered short question as "no lo sabía", not a crash', () => {
  const quiz = sampleQuiz();
  const result = gradeQuiz(quiz, { q1: 1, q2: 1 }, t);
  const short = result.review.find(item => item.id === 'q3');
  assert.ok(short, 'the unanswered short question shows up in the review');
  assert.equal(short.yours, 'Autoevaluación: no lo sabías');
  assert.equal(short.right, 'Las plantas convierten luz en energía.');
});

test('wrongQuestionIds matches exactly what gradeQuiz put in the review, for "repetir solo los fallos"', () => {
  const quiz = sampleQuiz();
  const answers = { q1: 1, q2: 0, q3: 0 };
  const result = gradeQuiz(quiz, answers, t);
  assert.deepEqual(wrongQuestionIds(quiz, answers), result.review.map(item => item.id));
  assert.deepEqual(wrongQuestionIds(quiz, answers), ['q2', 'q3']);
});

test('shareText reads like a share-worthy brag, in both languages, with and without a subject', () => {
  const result = { score: 84, correct: 8, total: 10, byTopic: [], review: [] };
  assert.equal(shareText(result, 'Derecho Penal', 'es'), 'He sacado un 8,4 en el simulacro de Derecho Penal de Entreclases. ¿Lo superas?');
  assert.equal(shareText(result, 'Dret Penal', 'va'), 'He tret un 8,4 en el simulacre de Dret Penal d’Entreclases. El superes?');
  assert.equal(shareText(result, '  ', 'es'), 'He sacado un 8,4 en el simulacro de Entreclases. ¿Lo superas?');
});

test('combineNotes concatenates selected docs under "## name" headers and caps at 4 images', () => {
  const img = data => ({ media_type: 'image/jpeg', data });
  const docs = [
    { id: 'a', name: 'Tema 1', text: 'Texto A', images: [img('1'), img('2'), img('3')], chars: 7, addedAt: '' },
    { id: 'b', name: 'Tema 2', text: 'Texto B', images: [img('4'), img('5')], chars: 7, addedAt: '' },
    { id: 'c', name: 'Sin marcar', text: 'No debe salir', images: [], chars: 13, addedAt: '' },
  ];
  const { notes, images } = combineNotes(docs, ['a', 'b']);
  assert.equal(notes, '## Tema 1\n\nTexto A\n\n## Tema 2\n\nTexto B');
  assert.ok(!notes.includes('No debe salir'));
  assert.equal(images.length, 4);
  assert.deepEqual(images.map(image => image.data), ['1', '2', '3', '4']);

  assert.deepEqual(combineNotes(docs, []), { notes: '', images: [] });
});

test('renderMarkdown turns headings, bold and lists into real elements, and escapes everything else as text', () => {
  const html = renderToStaticMarkup(renderMarkdown('# Título\n\nEsto es **importante** y *esto no*.\n\n- uno\n- dos\n\n1. primero\n2. segundo'));
  assert.match(html, /<h4>Título<\/h4>/);
  assert.match(html, /<strong>importante<\/strong>/);
  assert.match(html, /esto no/);
  assert.ok(!html.includes('<strong>esto no</strong>'), 'single asterisks are not bold');
  assert.match(html, /<ul><li>uno<\/li><li>dos<\/li><\/ul>/);
  assert.match(html, /<ol><li>primero<\/li><li>segundo<\/li><\/ol>/);

  const escaped = renderToStaticMarkup(renderMarkdown('<script>alert(1)</script>'));
  assert.ok(!escaped.includes('<script>'), 'stray HTML-looking text is rendered as text, never as markup');
  assert.match(escaped, /&lt;script&gt;/);
});

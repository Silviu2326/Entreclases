import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';

// Same loader as game-summary.test.mjs: grades.ts is plain TypeScript with no React.
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
const { weightSum, validate, currentGrade, neededGrade, formatGrade, summaryText, partTemplates } = load('lib/community/student/grades.ts');

const part = (id, name, weight, grade, minimum = null) => ({ id, name, weight, grade, minimum });
const subject = (parts, target = 5, name = 'Estadística II') => ({ id: 's1', name, target, parts });

test('weightSum adds every part\'s weight, ignoring nothing but non-finite values', () => {
  assert.equal(weightSum(subject([part('a', 'Examen', 60, null), part('b', 'Prácticas', 20, null)])), 80);
  assert.equal(weightSum(subject([])), 0);
});

test('validate flags weights that do not add up to 100, grades outside 0-10 and grades below their minimum', () => {
  assert.deepEqual(validate(subject([part('a', 'Examen', 100, 8)])), []);
  assert.deepEqual(validate(subject([part('a', 'Examen', 70, 8), part('b', 'Prácticas', 20, null)])), [{ kind: 'weight', total: 90 }]);
  assert.deepEqual(validate(subject([part('a', 'Examen', 100, 11)])), [{ kind: 'grade', partId: 'a' }]);
  assert.deepEqual(validate(subject([part('a', 'Examen', 100, -1)])), [{ kind: 'grade', partId: 'a' }]);
  assert.deepEqual(validate(subject([part('a', 'Examen', 80, 5, 6), part('b', 'Prácticas', 20, 7)])), [{ kind: 'minimum', partId: 'a' }]);
  assert.deepEqual(validate(subject([])), []);
});

test('currentGrade averages what is graded and accumulates the rest as zero, proportionally when weights do not sum to 100', () => {
  const withPending = subject([part('a', 'Examen', 60, 8), part('b', 'Prácticas', 20, 7), part('c', 'Trabajo', 20, null)]);
  const summary = currentGrade(withPending);
  assert.equal(summary.graded, 7.75); // (60*8 + 20*7) / 80
  assert.equal(summary.accumulated, 6.2); // (60*8 + 20*7) / 100

  const skewed = subject([part('a', 'Examen', 70, 8), part('b', 'Prácticas', 20, null)]); // weights sum to 90
  const skewedSummary = currentGrade(skewed);
  assert.equal(skewedSummary.graded, 8); // only the graded part counts
  assert.ok(Math.abs(skewedSummary.accumulated - 560 / 90) < 1e-9);

  const untouched = subject([part('a', 'Examen', 100, null)]);
  assert.equal(currentGrade(untouched).graded, null);
  assert.equal(currentGrade(untouched).accumulated, 0);

  assert.deepEqual(currentGrade(subject([])), { graded: null, accumulated: 0 });
});

test('neededGrade finds the single grade needed across every pending part', () => {
  const s = subject([part('a', 'Examen', 60, 8), part('b', 'Prácticas', 20, 7), part('c', 'Trabajo', 20, null)], 5);
  const result = neededGrade(s, 5);
  assert.equal(result.needed, -6); // already passing even with a 0
  assert.equal(result.possible, true);
  assert.ok(Math.abs(result.maxReachable - 8.2) < 1e-9);

  const impossible = neededGrade(s, 10);
  assert.ok(impossible.needed > 10);
  assert.equal(impossible.possible, false);
  assert.ok(Math.abs(impossible.maxReachable - 8.2) < 1e-9);

  const exact = subject([part('a', 'Único', 100, null)], 7);
  assert.equal(neededGrade(exact, 7).needed, 7);
});

test('neededGrade with no pending parts reports the final grade instead of a target to reach', () => {
  const done = subject([part('a', 'Examen', 60, 6), part('b', 'Prácticas', 20, 5), part('c', 'Trabajo', 20, 7)]);
  const passed = neededGrade(done, 5);
  assert.equal(passed.needed, null);
  assert.equal(passed.possible, true);
  assert.equal(passed.maxReachable, 6);
  const failed = neededGrade(done, 8);
  assert.equal(failed.needed, null);
  assert.equal(failed.possible, false);
});

test('neededGrade on a subject with no weight at all is neither possible nor crashes', () => {
  const empty = subject([]);
  assert.deepEqual(neededGrade(empty, 5), { needed: null, possible: false, maxReachable: 0 });
});

test('formatGrade writes Spanish-style numbers with a decimal comma and at most one decimal', () => {
  assert.equal(formatGrade(7, 'es'), '7');
  assert.equal(formatGrade(7.5, 'es'), '7,5');
  assert.equal(formatGrade(0, 'es'), '0');
  assert.equal(formatGrade(7.5, 'va'), '7,5');
});

test('summaryText tells the whole story: parts, what is pending, and what is needed', () => {
  const s = subject([part('a', 'Examen', 60, 8), part('b', 'Prácticas', 20, 7), part('c', 'Trabajo', 20, null)], 8, 'Estadística II');
  const es = summaryText(s, 'es');
  assert.match(es, /Estadística II/);
  assert.match(es, /Examen \(60%\): 8/);
  assert.match(es, /Trabajo \(20%\): pendiente/);
  assert.match(es, /Necesitas un/);
  const va = summaryText(s, 'va');
  assert.match(va, /pendent/);
  assert.match(va, /Necessites un/);
});

test('summaryText covers the already-passed, impossible and already-final cases in both languages', () => {
  const passed = subject([part('a', 'Examen', 60, 8), part('b', 'Prácticas', 20, 7), part('c', 'Trabajo', 20, null)], 5);
  assert.match(summaryText(passed, 'es'), /Ya has aprobado/);
  assert.match(summaryText(passed, 'va'), /Ja has aprovat/);

  const impossible = subject([part('a', 'Examen', 60, 8), part('b', 'Prácticas', 20, 7), part('c', 'Trabajo', 20, null)], 10);
  assert.match(summaryText(impossible, 'es'), /No es posible llegar/);
  assert.match(summaryText(impossible, 'va'), /No és possible arribar/);

  const final = subject([part('a', 'Examen', 100, 9)], 5);
  assert.match(summaryText(final, 'es'), /Ya tienes la nota hecha/);
  assert.match(summaryText(final, 'va'), /Ja tens la nota feta/);
});

test('partTemplates cover the three quick templates and their weights always add up to 100', () => {
  assert.equal(partTemplates.length, 3);
  for (const template of partTemplates) {
    const total = template.parts.reduce((sum, part) => sum + part.weight, 0);
    assert.equal(total, 100, `${template.id} sums to 100`);
    for (const part of template.parts) assert.equal(part.name.length, 2);
  }
});
